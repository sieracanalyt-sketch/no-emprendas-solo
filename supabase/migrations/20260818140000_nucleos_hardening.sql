-- ─────────────────────────────────────────────────────────────────────────────
-- Núcleos — cierre de superficie expuesta.
--
-- El linter de Supabase destapó tres cosas de la migración anterior:
--
-- 1. `revoke all ... from public` NO basta. Supabase tiene privilegios por
--    defecto que conceden EXECUTE a `anon` y `authenticated` sobre cada
--    función nueva del esquema public, y eso es un grant directo al rol, no
--    heredado de PUBLIC. Resultado: TODAS las funciones internas (incluidas
--    las de trigger) quedaban expuestas en `/rest/v1/rpc/…`. Hay que revocar
--    a los roles por su nombre.
--
-- 2. `can_form_team(a, b)` aceptaba dos uuids cualesquiera y devolvía en la
--    etiqueta cuántos días han hablado. Cualquiera con sesión podía sondear la
--    actividad de conversación entre dos personas ajenas. Ahora exige ser una
--    de las dos.
--
-- 3. La vista `nucleo_slots` no la consume nadie: `assign_nucleo` es SECURITY
--    DEFINER y lee las tablas directamente. Se queda como utilidad de
--    servicio, con `security_invoker` y sin acceso desde el cliente.
--
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Funciones internas: fuera de la API pública ──────────────────────────
-- Las de trigger no tienen sentido como RPC y las de mantenimiento son de
-- servicio. Ninguna debe ser invocable desde el cliente.

revoke all on function public.sync_group_members_array()       from anon, authenticated, public;
revoke all on function public.sync_group_members_table()       from anon, authenticated, public;
revoke all on function public.sync_member_type()               from anon, authenticated, public;
revoke all on function public.trg_refresh_nucleo_status()      from anon, authenticated, public;
revoke all on function public.trg_touch_group_activity()       from anon, authenticated, public;
revoke all on function public.refresh_nucleo_status(uuid)      from anon, authenticated, public;
revoke all on function public.next_nucleo_name(stage)          from anon, authenticated, public;
revoke all on function public.expire_team_invites()            from anon, authenticated, public;

-- `dm_active_days` y `profile_complete` alimentan a `can_form_team` desde
-- dentro (SECURITY DEFINER: no necesitan grant del que llama). Sueltas, la
-- primera revela con quién y cuánto habla cada cual.
revoke all on function public.dm_active_days(uuid, uuid)       from anon, authenticated, public;
revoke all on function public.profile_complete(uuid)           from anon, authenticated, public;

-- ── 2. Lo que sí usa la interfaz: solo con sesión, nunca anónimo ────────────

revoke all on function public.assign_nucleo(uuid)                       from anon, public;
revoke all on function public.propose_team(uuid, text, int, text)       from anon, public;
revoke all on function public.invite_to_team(uuid, uuid, text)          from anon, public;
revoke all on function public.accept_team_invite(uuid, text, int, text) from anon, public;
revoke all on function public.decline_team_invite(uuid)                 from anon, public;
revoke all on function public.can_form_team(uuid, uuid)                 from anon, public;
revoke all on function public.is_active_member(uuid, uuid)              from anon, public;
revoke all on function public.chat_unlocked(uuid)                       from anon, public;


-- ── 3. `can_form_team` deja de ser sondeable ────────────────────────────────
-- Tienes que ser una de las dos personas. Con `auth.uid()` nulo (service_role,
-- cron) se permite: ese rol ya lo ve todo de todas formas.

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
  if auth.uid() is not null and auth.uid() not in (a, b) then
    raise exception 'can_form_team: solo puedes consultarlo sobre ti mismo';
  end if;

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

revoke all on function public.can_form_team(uuid, uuid) from anon, public;
grant execute on function public.can_form_team(uuid, uuid) to authenticated, service_role;


-- ── 4. `sync_member_type`: search_path fijo ─────────────────────────────────
-- Sin él, un rol con search_path manipulado puede desviar a qué `groups`
-- apunta la función.

create or replace function public.sync_member_type()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  select g.type into new.type from public.groups g where g.id = new.group_id;
  return new;
end $fn$;

revoke all on function public.sync_member_type() from anon, authenticated, public;


-- ── 5. `nucleo_slots`: utilidad de servicio, fuera del cliente ──────────────

alter view public.nucleo_slots set (security_invoker = on);
revoke all on public.nucleo_slots from anon, authenticated;
grant select on public.nucleo_slots to service_role;
