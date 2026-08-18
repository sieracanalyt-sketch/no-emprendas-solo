-- ─────────────────────────────────────────────────────────────────────────────
-- Núcleos y Equipos — modelo de datos, RLS y RPCs.
--
-- Núcleo y Equipo son EL MISMO objeto (`public.groups`) con distinto `type`:
--   nucleo  → 6-8 personas, cada una con su proyecto. Lo tiene el 100 % de los
--             usuarios. Se ASIGNA (`assign_nucleo`), nunca se busca.
--             Eje de agrupación: `stage` (ideacion | aplicacion | facturacion).
--   equipo  → 2+ personas construyendo UNA sola cosa. Opcional. Nace de una
--             propuesta dentro de un chat 1:1 y crece por invitación.
--
-- `team_invites` es un solo objeto para las dos cosas:
--   group_id null      → propuesta de equipo nuevo, con el acuerdo de arranque
--                        de quien propone dentro. NO existe equipo todavía.
--   group_id presente  → invitación a un equipo que ya existe.
-- El equipo nace entero, `active`, en la transacción de `accept_team_invite`.
-- Cero equipos huérfanos.
--
-- Esto es un SPA (Vite): no hay servidor y el cliente es inspeccionable entero.
-- Por eso RLS deniega TODO insert directo en groups, group_members,
-- team_invites y team_charters, y la membresía solo se toca desde funciones
-- SECURITY DEFINER. Lo que compruebe React es decoración.
--
-- Adaptaciones al esquema real del repo (regla 0.1: no duplicar, extender):
--   · La tabla de perfiles es `public.users`, no `public.profiles`.
--     `public.profiles` existe (9 filas) pero está muerta: cero referencias.
--   · `public.groups` YA EXISTE (`id, name, description, members uuid[],
--     updated_at`). No se recrea: se extiende con ALTER.
--   · Mensajería 1:1 real: `chats(id text, user1_id, user2_id)` +
--     `messages(chat_id, from_uid, to_uid, created_at)`. Es sobre eso sobre lo
--     que cuenta `dm_active_days`.
--   · No hay tabla `teams`. `public.team_members` existe con 0 filas, sin FK y
--     sin uso: el bloque de migración de datos es un no-op. Se marca deprecada,
--     no se borra.
--   · `groups.members uuid[]` sigue vivo como PUENTE de LECTURA temporal: las
--     políticas RLS de `group_messages` y varias pantallas lo leen. Un trigger
--     lo mantiene al día desde `group_members`. Se retira en el bloque 12.
--
-- Idempotente: se puede aplicar varias veces sin efectos secundarios.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Tipos ────────────────────────────────────────────────────────────────
-- Un bloque por tipo: si se agrupan, el primer `duplicate_object` aborta el
-- bloque entero y los tipos siguientes no llegan a crearse.

do $$ begin create type group_type    as enum ('nucleo','equipo');
exception when duplicate_object then null; end $$;

do $$ begin create type group_status  as enum ('forming','active','at_risk','archived');
exception when duplicate_object then null; end $$;

do $$ begin create type stage         as enum ('ideacion','aplicacion','facturacion');
exception when duplicate_object then null; end $$;

do $$ begin create type member_role   as enum ('member','steward','founder');
exception when duplicate_object then null; end $$;

do $$ begin create type invite_status as enum ('pending','accepted','declined','expired');
exception when duplicate_object then null; end $$;


-- ── 2. Perfil (public.users) ────────────────────────────────────────────────

alter table public.users
  add column if not exists has_project        boolean not null default false,
  add column if not exists project_stage      stage,
  add column if not exists operating_level    stage,
  add column if not exists seeking_partner    boolean not null default false,
  add column if not exists open_to_join       boolean not null default false,
  add column if not exists sector             text,
  add column if not exists onboarding_done_at timestamptz;

comment on column public.users.operating_level is
  'Nivel al que la persona opera. Determina el núcleo. Nunca null tras el onboarding.';

-- Backfill conservador desde los campos antiguos. Solo marca `has_project`
-- cuando se puede deducir la fase; si no, lo preguntará el onboarding (nadie
-- tiene `onboarding_done_at`, así que todos pasan por él igualmente).
update public.users
   set project_stage = case proyecto_stage
                         when 'idea'    then 'ideacion'::stage
                         when 'mvp'     then 'aplicacion'::stage
                         when 'lanzado' then 'facturacion'::stage
                       end
 where project_stage is null
   and proyecto_stage is not null;

update public.users
   set has_project = true,
       operating_level = coalesce(operating_level, project_stage)
 where project_stage is not null
   and has_project = false;

alter table public.users
  drop constraint if exists profile_stage_coherent;
alter table public.users
  add constraint profile_stage_coherent
  check (
    (has_project = false and project_stage is null)
    or (has_project = true and project_stage is not null)
  );


-- ── 3. Grupos (núcleos y equipos, misma tabla) ──────────────────────────────
-- La tabla ya existe: se extiende.

alter table public.groups
  add column if not exists type             group_type   not null default 'equipo',
  add column if not exists status           group_status not null default 'forming',
  add column if not exists stage            stage,
  add column if not exists spawned_from     uuid references public.groups(id) on delete set null,
  add column if not exists season_ends_at   timestamptz,
  add column if not exists last_activity_at timestamptz  not null default now(),
  add column if not exists created_by       uuid references auth.users(id),
  add column if not exists created_at       timestamptz  not null default now();

-- Los grupos que ya existían los creó un usuario a mano: son equipos activos.
update public.groups
   set status = 'active'
 where type = 'equipo' and status = 'forming' and array_length(members, 1) >= 2;

update public.groups
   set created_by = members[1]
 where created_by is null and array_length(members, 1) >= 1;

alter table public.groups
  drop constraint if exists nucleo_needs_stage;
alter table public.groups
  add constraint nucleo_needs_stage check (type <> 'nucleo' or stage is not null);

alter table public.groups
  drop constraint if exists equipo_has_no_stage;
alter table public.groups
  add constraint equipo_has_no_stage check (type <> 'equipo' or stage is null);

create index if not exists groups_nucleo_slot_idx
  on public.groups(type, stage, status) where type = 'nucleo';

comment on column public.groups.members is
  'DEPRECADO. Puente de lectura hacia group_members mientras se refactoriza la interfaz. No escribir desde código nuevo.';


-- ── 4. Miembros ─────────────────────────────────────────────────────────────

create table if not exists public.group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id)   on delete cascade,
  type      group_type  not null,          -- desnormalizado, ver trigger
  role      member_role not null default 'member',
  joined_at timestamptz not null default now(),
  left_at   timestamptz
);

create unique index if not exists gm_one_active_per_group
  on public.group_members(group_id, user_id) where left_at is null;

-- Invariante duro: un solo núcleo activo por usuario.
create unique index if not exists gm_one_active_nucleo_per_user
  on public.group_members(user_id) where left_at is null and type = 'nucleo';

create index if not exists gm_user_active_idx
  on public.group_members(user_id) where left_at is null;

create or replace function public.sync_member_type() returns trigger
language plpgsql as $fn$
begin
  select g.type into new.type from public.groups g where g.id = new.group_id;
  return new;
end $fn$;

drop trigger if exists trg_sync_member_type on public.group_members;
create trigger trg_sync_member_type
  before insert or update of group_id on public.group_members
  for each row execute function public.sync_member_type();

-- Backfill desde el array que ya estaba en uso.
insert into public.group_members (group_id, user_id, type, role)
select g.id, m.user_id, g.type, 'founder'::member_role
  from public.groups g
  cross join lateral unnest(g.members) as m(user_id)
 where m.user_id is not null
   and not exists (
     select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = m.user_id and gm.left_at is null
   );


-- ── 5. Invitaciones: propuesta de equipo nuevo Y crecimiento ────────────────

create table if not exists public.team_invites (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid references public.groups(id) on delete cascade,
  invited_user uuid not null references auth.users(id) on delete cascade,
  invited_by   uuid not null references auth.users(id),
  message      text,
  status       invite_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

-- Si la tabla ya existía de una versión anterior, se relaja `group_id`.
alter table public.team_invites alter column group_id drop not null;

alter table public.team_invites
  add column if not exists proposer_contribution   text,
  add column if not exists proposer_hours_per_week int,
  add column if not exists proposer_exit_clause    text;

-- La forma se exige mientras la invitación está viva. Al aceptarla, una
-- propuesta de equipo nuevo recibe su `group_id` y conserva los `proposer_*`
-- como rastro: sin la primera rama, ese UPDATE violaría la restricción.
alter table public.team_invites
  drop constraint if exists invite_shape;
alter table public.team_invites
  add constraint invite_shape check (
    status = 'accepted'
    or (group_id is not null and proposer_contribution is null)
    or (group_id is null
        and proposer_contribution   is not null
        and proposer_hours_per_week is not null
        and proposer_exit_clause    is not null)
  );

alter table public.team_invites
  drop constraint if exists team_invites_no_self;
alter table public.team_invites
  add constraint team_invites_no_self check (invited_by <> invited_user);

drop index if exists ti_one_pending;

create unique index if not exists ti_one_pending_growth
  on public.team_invites(group_id, invited_user)
  where status = 'pending' and group_id is not null;

create unique index if not exists ti_one_pending_formation
  on public.team_invites(invited_by, invited_user)
  where status = 'pending' and group_id is null;

create index if not exists ti_invited_user_idx
  on public.team_invites(invited_user, status);


-- ── 6. Acuerdo de arranque ──────────────────────────────────────────────────

create table if not exists public.team_charters (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups(id) on delete cascade,
  user_id        uuid not null references auth.users(id)   on delete cascade,
  contribution   text not null check (length(trim(contribution)) >= 80),
  hours_per_week int  not null check (hours_per_week between 1 and 80),
  exit_clause    text not null check (length(trim(exit_clause)) >= 80),
  signed_at      timestamptz not null default now(),
  unique (group_id, user_id)
);


-- ── 7. Equipos antiguos ─────────────────────────────────────────────────────
-- No existe `public.teams` y `public.team_members` tiene 0 filas: no hay nada
-- que migrar. Se marca deprecada; se elimina en una migración posterior.

do $$ begin
  if to_regclass('public.team_members') is not null then
    comment on table public.team_members is
      'DEPRECADA. Huérfana (0 filas, sin FK, sin uso). Sustituida por public.group_members. Eliminar en una migración posterior.';
  end if;
end $$;


-- ── 8. Puente de lectura hacia `groups.members` ─────────────────────────────

create or replace function public.sync_group_members_array()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_group   uuid := coalesce(new.group_id, old.group_id);
  v_members uuid[];
begin
  select coalesce(array_agg(gm.user_id order by gm.joined_at), '{}'::uuid[])
    into v_members
    from public.group_members gm
   where gm.group_id = v_group and gm.left_at is null;

  update public.groups g
     set members = v_members
   where g.id = v_group
     and g.members is distinct from v_members;

  return null;
end $fn$;

drop trigger if exists group_members_sync_array on public.group_members;
create trigger group_members_sync_array
  after insert or update or delete on public.group_members
  for each row execute function public.sync_group_members_array();

-- Sentido inverso: solo para ediciones con privilegios (admin, service_role).
-- `authenticated` tiene revocado el UPDATE de esa columna, más abajo.
create or replace function public.sync_group_members_table()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.group_members gm
     set left_at = now()
   where gm.group_id = new.id
     and gm.left_at is null
     and not (gm.user_id = any (coalesce(new.members, '{}'::uuid[])));

  insert into public.group_members (group_id, user_id, type)
  select new.id, m.user_id, new.type
    from unnest(coalesce(new.members, '{}'::uuid[])) as m(user_id)
   where m.user_id is not null
     and not exists (
       select 1 from public.group_members gm
        where gm.group_id = new.id and gm.user_id = m.user_id and gm.left_at is null
     );

  return null;
end $fn$;

drop trigger if exists groups_sync_members_table on public.groups;
create trigger groups_sync_members_table
  after insert or update of members on public.groups
  for each row when (pg_trigger_depth() < 2)
  execute function public.sync_group_members_table();


-- ── 9. Salud y estado del núcleo ────────────────────────────────────────────

create or replace function public.next_nucleo_name(p_stage stage)
returns text
language plpgsql
stable
set search_path = public
as $fn$
declare
  v_pool text[] := array[
    'Vera','Sostre','Aurora','Brío','Cauce','Duna','Ería','Faro','Gala','Hito',
    'Iris','Jara','Lumen','Mira','Norte','Onda','Pauta','Quilla','Rada','Savia',
    'Tesela','Umbría','Vela','Zenit'];
  v_name text;
begin
  select 'Núcleo ' || n into v_name
    from unnest(v_pool) as n
   where not exists (
     select 1 from public.groups g
      where g.type = 'nucleo' and g.name = 'Núcleo ' || n
   )
   limit 1;

  if v_name is not null then
    return v_name;
  end if;

  return 'Núcleo '
    || (case p_stage
          when 'ideacion'    then 'Ideación'
          when 'aplicacion'  then 'Aplicación'
          when 'facturacion' then 'Facturación'
        end)
    || ' '
    || (select count(*) + 1 from public.groups g
         where g.type = 'nucleo' and g.stage = p_stage);
end $fn$;

-- 1-3 → forming (chat bloqueado) · 4-5 → forming (chat abierto) · 6-8 → active.
-- `archived` no se toca aquí: lo gestiona el cron de salud. `at_risk` sí se
-- recalcula, porque un alta o una baja ES actividad.
create or replace function public.refresh_nucleo_status(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_type   group_type;
  v_status group_status;
  v_count  int;
  v_next   group_status;
begin
  select g.type, g.status into v_type, v_status
    from public.groups g where g.id = p_group;

  if v_type is distinct from 'nucleo' or v_status = 'archived' then
    return;
  end if;

  select count(*) into v_count
    from public.group_members gm
   where gm.group_id = p_group and gm.left_at is null;

  v_next := case when v_count >= 6 then 'active'::group_status else 'forming'::group_status end;

  update public.groups g
     set status = v_next
   where g.id = p_group and g.status is distinct from v_next;
end $fn$;

create or replace function public.trg_refresh_nucleo_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.refresh_nucleo_status(coalesce(new.group_id, old.group_id));
  return null;
end $fn$;

drop trigger if exists group_members_refresh_status on public.group_members;
create trigger group_members_refresh_status
  after insert or delete or update of left_at on public.group_members
  for each row execute function public.trg_refresh_nucleo_status();

-- El cron de salud mide silencio: hay que registrar cuándo se habla.
create or replace function public.trg_touch_group_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.groups g
     set last_activity_at = greatest(g.last_activity_at, new.created_at)
   where g.id = new.group_id;
  return null;
end $fn$;

drop trigger if exists group_messages_touch_activity on public.group_messages;
create trigger group_messages_touch_activity
  after insert on public.group_messages
  for each row execute function public.trg_touch_group_activity();


-- ── 10. Asignación de núcleo ────────────────────────────────────────────────

create or replace function public.assign_nucleo(p_user uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_level  stage;
  v_sector text;
  v_group  uuid;
begin
  if p_user is null then
    raise exception 'assign_nucleo: no hay usuario';
  end if;

  -- Solo puedes asignarte a ti mismo. Admin y service_role (auth.uid() nulo)
  -- pasan.
  if p_user <> auth.uid()
     and not coalesce((select u.is_admin from public.users u where u.id = auth.uid()), false)
  then
    raise exception 'assign_nucleo: sin permiso para asignar a otra persona';
  end if;

  select u.operating_level, u.sector into v_level, v_sector
    from public.users u where u.id = p_user;

  if v_level is null then
    raise exception 'operating_level requerido antes de asignar núcleo';
  end if;

  select gm.group_id into v_group
    from public.group_members gm
   where gm.user_id = p_user and gm.type = 'nucleo' and gm.left_at is null;
  if v_group is not null then
    return v_group;
  end if;

  -- Serializa por fase: sin esto, dos altas simultáneas se cuelan las dos en
  -- la última plaza y el núcleo acaba con 9.
  perform pg_advisory_xact_lock(hashtext('nucleo:' || v_level::text));

  -- Buscar hueco: misma fase, no lleno, no archivado.
  -- Orden: primero el que menos repite tu sector (diversidad, preferencia
  -- blanda), luego el más lleno (para cerrarlo antes).
  select g.id into v_group
    from public.groups g
    left join public.group_members m on m.group_id = g.id and m.left_at is null
   where g.type = 'nucleo'
     and g.stage = v_level
     and g.status in ('forming','active')
   group by g.id
  having count(m.id) < 8
   order by
     (select count(*) from public.group_members m2
        join public.users p2 on p2.id = m2.user_id
       where m2.group_id = g.id and m2.left_at is null
         and p2.sector is not distinct from v_sector) asc,
     count(m.id) desc
   limit 1;

  if v_group is null then
    insert into public.groups (type, name, description, status, stage, season_ends_at, members)
    values ('nucleo', public.next_nucleo_name(v_level), '', 'forming', v_level,
            now() + interval '8 weeks', '{}'::uuid[])
    returning id into v_group;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group, p_user, 'member');

  perform public.refresh_nucleo_status(v_group);
  return v_group;
end $fn$;


-- ── 11. Requisitos para formar equipo ───────────────────────────────────────

-- Réplica en SQL del gate de src/lib/profileCompletion.ts. La interfaz puede
-- mentir; esto no.
create or replace function public.profile_complete(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((
    select length(trim(coalesce(u.nombre, ''))) > 0
       and length(trim(coalesce(u.biografia, ''))) >= 250
       and (
         u.project_status in ('no_project', 'looking')
         or (u.project_status = 'has_project' and length(trim(coalesce(u.proyecto, ''))) > 0)
         or (u.project_status is null and length(trim(coalesce(u.proyecto, ''))) > 0)
       )
       and exists (select 1 from unnest(coalesce(u.buscando, '{}'::text[])) t
                    where trim(t) <> '')
      from public.users u where u.id = p_user
  ), false);
$fn$;

-- Días naturales distintos (Europe/Madrid) en los que LOS DOS han escrito en
-- su chat directo. Los días en que solo escribe uno no cuentan.
create or replace function public.dm_active_days(a uuid, b uuid)
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(count(*), 0)::int
    from (
      select (m.created_at at time zone 'Europe/Madrid')::date as d
        from public.messages m
        join public.chats c on c.id = m.chat_id
       where ((c.user1_id = a and c.user2_id = b)
           or (c.user1_id = b and c.user2_id = a))
         and m.from_uid in (a, b)
       group by 1
      having count(distinct m.from_uid) = 2
    ) both_wrote;
$fn$;

-- { ok: boolean, checks: [{ key, ok, label }] }
create or replace function public.can_form_team(a uuid, b uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_profiles boolean;
  v_days     int;
  v_depth    boolean;
begin
  v_profiles := public.profile_complete(a) and public.profile_complete(b);
  v_days     := public.dm_active_days(a, b);
  v_depth    := v_days >= 3;

  return jsonb_build_object(
    'ok', v_profiles and v_depth,
    'checks', jsonb_build_array(
      jsonb_build_object(
        'key',   'profiles_complete',
        'ok',    v_profiles,
        'label', case when v_profiles
                      then 'Los dos perfiles están completos'
                      else 'Falta completar un perfil' end
      ),
      jsonb_build_object(
        'key',   'conversation_depth',
        'ok',    v_depth,
        'label', 'Habéis hablado ' || least(v_days, 3) || ' de los 3 días necesarios'
      )
    )
  );
end $fn$;


-- ── 12. RPCs de equipo ──────────────────────────────────────────────────────

-- Propuesta de equipo nuevo. No crea ningún grupo: solo la invitación, con el
-- acuerdo de arranque de quien propone dentro.
create or replace function public.propose_team(
  p_invited_user uuid,
  p_contribution text,
  p_hours        int,
  p_exit         text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invite uuid;
begin
  if auth.uid() is null then
    raise exception 'Necesitas sesión';
  end if;
  if p_invited_user = auth.uid() then
    raise exception 'No puedes proponerte equipo a ti mismo';
  end if;

  if length(trim(coalesce(p_contribution, ''))) < 80
     or length(trim(coalesce(p_exit, ''))) < 80 then
    raise exception 'El acuerdo de arranque necesita al menos 80 caracteres en cada respuesta';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 80 then
    raise exception 'Las horas por semana deben estar entre 1 y 80';
  end if;

  if not (public.can_form_team(auth.uid(), p_invited_user)->>'ok')::boolean then
    raise exception 'Todavía no cumplís los requisitos para formar equipo';
  end if;

  -- Ya compartís un equipo activo
  if exists (
    select 1
      from public.group_members ga
      join public.group_members gb on gb.group_id = ga.group_id and gb.left_at is null
      join public.groups g on g.id = ga.group_id
     where ga.user_id = auth.uid() and ga.left_at is null
       and gb.user_id = p_invited_user
       and g.type = 'equipo' and g.status <> 'archived'
  ) then
    raise exception 'Ya tenéis un equipo juntos';
  end if;

  -- Propuesta viva en cualquiera de los dos sentidos: si no, dos propuestas
  -- cruzadas aceptadas crearían dos equipos con las mismas dos personas.
  select ti.id into v_invite
    from public.team_invites ti
   where ti.status = 'pending' and ti.group_id is null
     and ((ti.invited_by = auth.uid() and ti.invited_user = p_invited_user)
       or (ti.invited_by = p_invited_user and ti.invited_user = auth.uid()));
  if v_invite is not null then
    raise exception 'Ya hay una propuesta de equipo pendiente entre vosotros';
  end if;

  insert into public.team_invites (
    group_id, invited_user, invited_by,
    proposer_contribution, proposer_hours_per_week, proposer_exit_clause
  )
  values (null, p_invited_user, auth.uid(), p_contribution, p_hours, p_exit)
  returning id into v_invite;

  return v_invite;
end $fn$;

-- Invitación a un equipo que ya existe. Solo desde dentro, y con mensaje.
create or replace function public.invite_to_team(
  p_group        uuid,
  p_invited_user uuid,
  p_message      text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invite uuid;
begin
  if not public.is_active_member(p_group, auth.uid()) then
    raise exception 'No perteneces a ese equipo';
  end if;
  if (select g.type from public.groups g where g.id = p_group) <> 'equipo' then
    raise exception 'A un núcleo no se invita: se asigna';
  end if;
  if (select g.status from public.groups g where g.id = p_group) = 'archived' then
    raise exception 'Ese equipo ya no está activo';
  end if;
  if public.is_active_member(p_group, p_invited_user) then
    raise exception 'Esa persona ya está en el equipo';
  end if;
  if length(trim(coalesce(p_message, ''))) = 0 then
    raise exception 'La invitación necesita un mensaje';
  end if;

  select ti.id into v_invite
    from public.team_invites ti
   where ti.group_id = p_group and ti.invited_user = p_invited_user and ti.status = 'pending';
  if v_invite is not null then
    raise exception 'Esa persona ya tiene una invitación pendiente de este equipo';
  end if;

  insert into public.team_invites (group_id, invited_user, invited_by, message)
  values (p_group, p_invited_user, auth.uid(), p_message)
  returning id into v_invite;

  return v_invite;
end $fn$;

-- Aceptar. Una sola transacción: o nace el equipo entero, o no pasa nada.
create or replace function public.accept_team_invite(
  p_invite       uuid,
  p_contribution text,
  p_hours        int,
  p_exit         text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_inv   public.team_invites;
  v_group uuid;
  v_name  text;
begin
  select * into v_inv from public.team_invites where id = p_invite for update;

  if v_inv.id is null then
    raise exception 'Esa invitación no existe';
  end if;
  if v_inv.invited_user <> auth.uid() then
    raise exception 'Esa invitación no es tuya';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'Esa invitación ya está resuelta';
  end if;
  if v_inv.created_at < now() - interval '14 days' then
    update public.team_invites
       set status = 'expired', responded_at = now()
     where id = p_invite;
    raise exception 'Esa invitación ha caducado';
  end if;

  if length(trim(coalesce(p_contribution, ''))) < 80
     or length(trim(coalesce(p_exit, ''))) < 80 then
    raise exception 'El acuerdo de arranque necesita al menos 80 caracteres en cada respuesta';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 80 then
    raise exception 'Las horas por semana deben estar entre 1 y 80';
  end if;

  if v_inv.group_id is null then
    -- ── Formación: el equipo nace aquí, entero y activo ──
    if not (public.can_form_team(v_inv.invited_by, v_inv.invited_user)->>'ok')::boolean then
      raise exception 'Todavía no cumplís los requisitos para formar equipo';
    end if;

    v_name := left(
      'Equipo de '
      || coalesce((select u.nombre from public.users u where u.id = v_inv.invited_by), 'alguien')
      || ' y '
      || coalesce((select u.nombre from public.users u where u.id = v_inv.invited_user), 'alguien'),
      80);

    insert into public.groups (type, name, description, status, stage, created_by, members)
    values ('equipo', v_name, '', 'active', null, v_inv.invited_by, '{}'::uuid[])
    returning id into v_group;

    insert into public.group_members (group_id, user_id, role) values
      (v_group, v_inv.invited_by,   'founder'),
      (v_group, v_inv.invited_user, 'founder');

    insert into public.team_charters (group_id, user_id, contribution, hours_per_week, exit_clause) values
      (v_group, v_inv.invited_by,   v_inv.proposer_contribution, v_inv.proposer_hours_per_week, v_inv.proposer_exit_clause),
      (v_group, v_inv.invited_user, p_contribution, p_hours, p_exit);

    update public.team_invites
       set status = 'accepted', group_id = v_group, responded_at = now()
     where id = p_invite;
  else
    -- ── Crecimiento: el equipo ya existe ──
    select g.id into v_group
      from public.groups g
     where g.id = v_inv.group_id and g.type = 'equipo' and g.status <> 'archived';
    if v_group is null then
      raise exception 'Ese equipo ya no está activo';
    end if;

    insert into public.group_members (group_id, user_id, role)
    values (v_group, v_inv.invited_user, 'founder');

    insert into public.team_charters (group_id, user_id, contribution, hours_per_week, exit_clause)
    values (v_group, v_inv.invited_user, p_contribution, p_hours, p_exit);

    update public.team_invites
       set status = 'accepted', responded_at = now()
     where id = p_invite;
  end if;

  return v_group;
end $fn$;

create or replace function public.decline_team_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.team_invites
     set status = 'declined', responded_at = now()
   where id = p_invite
     and invited_user = auth.uid()
     and status = 'pending';

  if not found then
    raise exception 'Esa invitación no existe, no es tuya o ya está resuelta';
  end if;
end $fn$;

-- Para el cron de salud: 14 días sin respuesta → caducada. Cero huérfanos.
create or replace function public.expire_team_invites()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
declare v_n int;
begin
  update public.team_invites
     set status = 'expired', responded_at = now()
   where status = 'pending'
     and created_at < now() - interval '14 days';
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;


-- ── 13. Ayudantes de RLS ────────────────────────────────────────────────────
-- SECURITY DEFINER: se saltan las políticas, así que no hay recursión al
-- usarlos dentro de las propias políticas.

create or replace function public.is_active_member(p_group uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.group_members gm
     where gm.group_id = p_group and gm.user_id = p_user and gm.left_at is null
  );
$fn$;

-- El chat de un núcleo se abre a partir de 4 miembros (NUCLEO.CHAT_UNLOCK_AT).
-- Los equipos y los grupos heredados no tienen puerta.
create or replace function public.chat_unlocked(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select case
    when (select g.type from public.groups g where g.id = p_group) = 'nucleo'
    then (select count(*) from public.group_members gm
           where gm.group_id = p_group and gm.left_at is null) >= 4
    else true
  end;
$fn$;

-- Conteos de núcleo sin nombres ni miembros: lo que necesita el asignador,
-- nunca la interfaz. Sin `security_invoker` a propósito: debe poder contar
-- plazas de núcleos a los que no perteneces.
create or replace view public.nucleo_slots as
  select g.id,
         g.stage,
         g.status,
         (select count(*) from public.group_members gm
           where gm.group_id = g.id and gm.left_at is null) as member_count
    from public.groups g
   where g.type = 'nucleo';


-- ── 14. RLS ─────────────────────────────────────────────────────────────────
-- Ningún INSERT directo en las cuatro tablas: todo pasa por RPC.

alter table public.group_members enable row level security;
alter table public.team_invites  enable row level security;
alter table public.team_charters enable row level security;

-- groups: se ve el grupo del que eres miembro activo (antes: `select true`,
-- cualquiera veía todos los grupos del producto).
drop policy if exists groups_select_authenticated on public.groups;
drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups
  for select using (public.is_active_member(id, auth.uid()));

drop policy if exists groups_insert_auth on public.groups;
drop policy if exists groups_insert_equipo on public.groups;

-- Renombrar sí; tocar la membresía no. El privilegio de columna lo remata
-- más abajo, porque RLS no distingue columnas.
drop policy if exists groups_update_member on public.groups;
create policy groups_update_member on public.groups
  for update using (public.is_active_member(id, auth.uid()))
  with check (public.is_active_member(id, auth.uid()));

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select using (public.is_active_member(group_id, auth.uid()));
drop policy if exists group_members_leave_self on public.group_members;

drop policy if exists team_invites_select on public.team_invites;
create policy team_invites_select on public.team_invites
  for select using (
    invited_user = auth.uid()
    or invited_by = auth.uid()
    or (group_id is not null and public.is_active_member(group_id, auth.uid()))
  );
drop policy if exists team_invites_insert_member on public.team_invites;
drop policy if exists team_invites_respond on public.team_invites;

drop policy if exists team_charters_select on public.team_charters;
create policy team_charters_select on public.team_charters
  for select using (public.is_active_member(group_id, auth.uid()));
drop policy if exists team_charters_insert_own on public.team_charters;
drop policy if exists team_charters_update_own on public.team_charters;

-- group_messages: pasa a apoyarse en group_members, y el chat de un núcleo en
-- formación queda cerrado de verdad, no solo en la interfaz.
drop policy if exists gmsgs_select on public.group_messages;
create policy gmsgs_select on public.group_messages
  for select using (public.is_active_member(group_id, auth.uid()));

drop policy if exists gmsgs_insert on public.group_messages;
create policy gmsgs_insert on public.group_messages
  for insert with check (
    auth.uid() = from_uid
    and public.is_active_member(group_id, auth.uid())
    and public.chat_unlocked(group_id)
  );

-- Lectura del agente MERGE, igual que en el resto de tablas del proyecto.
drop policy if exists merge_agent_read on public.group_members;
create policy merge_agent_read on public.group_members
  for select using (auth.uid() = '1571df23-c859-4982-bfc5-1a608f26f986'::uuid);

drop policy if exists merge_agent_read on public.team_invites;
create policy merge_agent_read on public.team_invites
  for select using (auth.uid() = '1571df23-c859-4982-bfc5-1a608f26f986'::uuid);

drop policy if exists merge_agent_read on public.team_charters;
create policy merge_agent_read on public.team_charters
  for select using (auth.uid() = '1571df23-c859-4982-bfc5-1a608f26f986'::uuid);


-- ── 15. Privilegios ─────────────────────────────────────────────────────────

-- Sin INSERT en las cuatro tablas para nadie que no sea service_role.
revoke insert on public.groups        from authenticated, anon;
revoke insert on public.group_members from authenticated, anon;
revoke insert on public.team_invites  from authenticated, anon;
revoke insert on public.team_charters from authenticated, anon;
revoke update, delete on public.group_members from authenticated, anon;
revoke update, delete on public.team_invites  from authenticated, anon;
revoke update, delete on public.team_charters from authenticated, anon;

-- `members` deja de ser escribible desde el cliente: la membresía solo se
-- toca por RPC. RLS no filtra por columna, los privilegios sí.
revoke update on public.groups from authenticated, anon;
grant  update (name, description) on public.groups to authenticated;

revoke all on function public.assign_nucleo(uuid)                          from public;
revoke all on function public.propose_team(uuid, text, int, text)          from public;
revoke all on function public.invite_to_team(uuid, uuid, text)             from public;
revoke all on function public.accept_team_invite(uuid, text, int, text)    from public;
revoke all on function public.decline_team_invite(uuid)                    from public;
revoke all on function public.expire_team_invites()                        from public;
revoke all on function public.refresh_nucleo_status(uuid)                  from public;
revoke all on function public.next_nucleo_name(stage)                      from public;

grant execute on function public.assign_nucleo(uuid)                       to authenticated, service_role;
grant execute on function public.propose_team(uuid, text, int, text)       to authenticated, service_role;
grant execute on function public.invite_to_team(uuid, uuid, text)          to authenticated, service_role;
grant execute on function public.accept_team_invite(uuid, text, int, text) to authenticated, service_role;
grant execute on function public.decline_team_invite(uuid)                 to authenticated, service_role;
grant execute on function public.can_form_team(uuid, uuid)                 to authenticated, service_role;
grant execute on function public.dm_active_days(uuid, uuid)                to authenticated, service_role;
grant execute on function public.profile_complete(uuid)                    to authenticated, service_role;
grant execute on function public.is_active_member(uuid, uuid)              to authenticated, service_role;
grant execute on function public.chat_unlocked(uuid)                       to authenticated, service_role;
grant execute on function public.expire_team_invites()                     to service_role;
grant execute on function public.refresh_nucleo_status(uuid)               to service_role;
grant execute on function public.next_nucleo_name(stage)                   to service_role;

grant select on public.nucleo_slots to authenticated, service_role;
