-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Códigos de invitación multiuso
--    Antes: un código = un canje (used_by/used_at). Ahora cada código lleva un
--    cupo (max_uses) y un contador (uses_count), para poder mandar UN código a
--    un grupo de 15 personas y seguir pudiendo generar códigos de un solo uso.
--    Las columnas viejas se conservan: guardan el PRIMER canje (histórico).
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.invite_codes
  add column if not exists max_uses   integer not null default 1,
  add column if not exists uses_count integer not null default 0;

-- Backfill: los códigos ya canjeados cuentan como 1 uso de 1.
update public.invite_codes set uses_count = 1
where used_by is not null and uses_count = 0;

do $$ begin
  alter table public.invite_codes
    add constraint invite_codes_max_uses_ck check (max_uses between 1 and 1000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.invite_codes
    add constraint invite_codes_uses_count_ck check (uses_count >= 0 and uses_count <= max_uses);
exception when duplicate_object then null; end $$;

-- Quién canjeó qué: impide que la misma persona queme dos usos del mismo código
-- (la PK compuesta lo hace imposible) y deja rastro de los 15 canjes.
create table if not exists public.invite_redemptions (
  code        text        not null references public.invite_codes(code) on delete cascade,
  user_id     uuid        not null references public.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.invite_redemptions enable row level security;
-- Sin políticas a propósito: solo el service_role (Edge Functions) la toca.

insert into public.invite_redemptions (code, user_id, redeemed_at)
select code, used_by, coalesce(used_at, created_at)
from public.invite_codes
where used_by is not null
on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Canje atómico
--    `for update` serializa a los 15 que canjean a la vez: sin esto dos peticiones
--    simultáneas podrían leer uses_count=14 y colarse ambas (16 personas dentro).
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.redeem_invite_code(p_code text, p_user uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max  integer;
  v_used integer;
begin
  select max_uses, uses_count into v_max, v_used
  from invite_codes where code = p_code for update;

  if not found then return 'invalid'; end if;

  -- Ya lo canjeó: idempotente, se le vuelve a aprobar sin gastar otro uso.
  if exists (select 1 from invite_redemptions where code = p_code and user_id = p_user) then
    update users set cohort_approved = true where id = p_user;
    return 'ok';
  end if;

  if v_used >= v_max then return 'exhausted'; end if;

  insert into invite_redemptions (code, user_id) values (p_code, p_user);

  update invite_codes set
    uses_count = uses_count + 1,
    used_by    = coalesce(used_by, p_user),
    used_at    = coalesce(used_at, now())
  where code = p_code;

  update users set cohort_approved = true where id = p_user;
  return 'ok';
end;
$$;

-- Crítico: es SECURITY DEFINER y aprueba cohorte. Si quedara ejecutable por
-- `authenticated`, cualquiera podría auto-aprobarse llamando al RPC desde la
-- consola del navegador.
revoke all on function public.redeem_invite_code(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_invite_code(text, uuid) to service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Escalada de privilegios: users_update_own dejaba a CUALQUIER usuario
--    autenticado hacer update sobre su propia fila sin restricción de columnas,
--    es decir `update users set is_admin = true where id = auth.uid()` desde la
--    consola → panel /admin, generar códigos y cambiar tiers de todos.
--    El trigger de cohort_approved ya cubría esa columna; lo ampliamos a todas
--    las columnas privilegiadas (solo el service_role puede cambiarlas).
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.protect_cohort_approved()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  new.cohort_approved := old.cohort_approved;
  new.is_admin        := old.is_admin;
  new.tier            := old.tier;
  new.trial_until     := old.trial_until;
  return new;
end;
$$;
