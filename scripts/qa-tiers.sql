-- ──────────────────────────────────────────────────────────────────────────────
-- QA: toggles manuales de tiers y feature flags (SQL Editor de Supabase).
-- Todos los cambios se propagan por realtime a las pestañas abiertas.
-- ──────────────────────────────────────────────────────────────────────────────

-- Ver estado actual
select email, nombre, tier, trial_until, is_admin from public.users order by nombre;
select * from public.feature_flags;
select * from public.subscriptions order by created_at desc;

-- Subir un usuario a premium (sin subscription; users.tier es la base)
-- update public.users set tier = 'premium' where email = 'CORREO@gmail.com';

-- Bajarlo a free
-- update public.users set tier = 'free' where email = 'CORREO@gmail.com';

-- Darle un trial de 7 días (prevalece sobre todo lo demás)
-- update public.users set trial_until = now() + interval '7 days' where email = 'CORREO@gmail.com';

-- Quitar el trial
-- update public.users set trial_until = null where email = 'CORREO@gmail.com';

-- Activar un feature flag (la feature pasa a ser solo-premium EN VIVO)
-- update public.feature_flags set active = true, updated_at = now() where feature = 'matching_advanced';

-- Desactivarlo (todo el mundo vuelve a verla)
-- update public.feature_flags set active = false, updated_at = now() where feature = 'matching_advanced';

-- Simular una subscription cancelada (el tier efectivo cae a free aunque
-- users.tier siga en premium — regla del hook useUserTier)
-- insert into public.subscriptions (user_id, tier, status)
--   select id, 'premium', 'canceled' from public.users where email = 'CORREO@gmail.com';

-- Marcar/desmarcar admin
-- update public.users set is_admin = true  where email = 'CORREO@gmail.com';
-- update public.users set is_admin = false where email = 'CORREO@gmail.com';

-- Limpiar subscriptions de prueba
-- delete from public.subscriptions where user_id = (select id from public.users where email = 'CORREO@gmail.com');
