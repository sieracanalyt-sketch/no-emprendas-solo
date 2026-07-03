# NoEmprendasSolo (NES)

Red social para emprendedores: matchmaking (NES Connect + Conexión IA), mensajería, workflow Kanban, calendario y foros.

**Stack**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Supabase (Postgres, Auth, Realtime, Storage, Edge Functions). Deploy en Vercel.

```bash
npm install
cp .env.example .env   # rellenar con las claves de Supabase
npm run dev
```

## Premium / Feature Flags

Infraestructura de monetización lista **sin pagos activos** (Stripe Connect vía partners llegará en Fase 2). Dos tiers: `free` y `premium`.

### Matriz de features

| Feature (flag)      | Nombre             | min_tier  | Estado inicial |
| ------------------- | ------------------ | --------- | -------------- |
| `matching_advanced` | Matching avanzado (Conexión IA) | `premium` | flag inactivo (todos la ven) |
| `identity_public`   | Identidad pública  | `premium` | flag inactivo |
| `curated_network`   | Red curada         | `premium` | flag inactivo |
| `workflow_advanced` | Workflow avanzado  | `premium` | flag inactivo |

**Regla fail-open**: un flag inexistente o con `active=false` deja pasar a todo el mundo. El gating solo se aplica cuando un admin activa el flag — así el deploy nunca quita acceso.

### Cómo funciona

- **Tier efectivo** (`useUserTier`): `users.tier` como base; si la subscription más reciente no está `active` → `free`; si `trial_until` está en el futuro → `premium`. Cambios en vivo por realtime.
- **Gating** (`<FeatureGated feature="..." fallback={...}>`): con acceso renderiza children; sin acceso muestra `fallback` o una tarjeta bloqueada que abre el `<UpgradeModal />`.
- **Toggle sin redeploy**: página `/admin` (solo `users.is_admin`) → Edge Function `admin-feature-flags` → tabla `feature_flags` → realtime a todas las pestañas.
- **Webhook stub**: Edge Function `subscription-changed` (upsert en `subscriptions` + `users.tier`). Autenticada por JWT de admin o header `x-webhook-secret` (secret `WEBHOOK_SECRET`). **No está cableada a Stripe todavía.**

### QA

- SQL manual: [`scripts/qa-tiers.sql`](scripts/qa-tiers.sql) (tiers, trials, flags, subscriptions).
- Prueba realtime: abre NES en 2 ventanas → activa `matching_advanced` desde `/admin` → el panel Conexión IA se convierte en paywall para usuarios free sin recargar.

### Tablas

- `users`: + `tier` (`free|premium`), `trial_until`, `is_admin`.
- `subscriptions`: user_id, tier, status (`active|canceled|expired`), partner_id, next_billing_date. RLS: cada usuario lee solo la suya; escribe solo el service role.
- `feature_flags`: feature (PK), min_tier, active. RLS: leen autenticados; escribe solo el service role.
- `team_members`: (team_id, user_id, role) — preparada para tiers por equipo.

Migración: [`supabase/migrations/20260702000000_premium_tiers_feature_flags.sql`](supabase/migrations/20260702000000_premium_tiers_feature_flags.sql).
