-- Premium Mode: tiers + subscriptions + feature flags + team members
-- Aplicada al remoto el 2026-07-02 (MCP apply_migration: premium_tiers_feature_flags).
-- Sin Stripe todavía: infraestructura lista para Stripe Connect (Fase 2).

-- 1. Columnas nuevas en users
alter table public.users
  add column tier text not null default 'free' check (tier in ('free','premium')),
  add column trial_until timestamptz,
  add column is_admin boolean not null default false;

-- 2. subscriptions (escritura SOLO service role — sin policies de escritura)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null default 'premium' check (tier in ('free','premium')),
  status text not null default 'active' check (status in ('active','canceled','expired')),
  partner_id text,
  next_billing_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions(user_id);

-- 3. feature_flags (lectura autenticados; escritura SOLO service role)
create table public.feature_flags (
  feature text primary key,
  min_tier text not null default 'premium' check (min_tier in ('free','premium')),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 4. team_members (lógica de tier por equipo, futuro)
create table public.team_members (
  team_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- 5. RLS
alter table public.subscriptions enable row level security;
alter table public.feature_flags enable row level security;
alter table public.team_members enable row level security;

create policy "own subs read" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "flags read" on public.feature_flags
  for select using (auth.uid() is not null);

create policy "team read" on public.team_members
  for select using (auth.uid() = user_id);

-- 6. Realtime (users incluida: tier/is_admin deben propagarse en vivo)
alter publication supabase_realtime add table public.subscriptions;
alter publication supabase_realtime add table public.feature_flags;
alter publication supabase_realtime add table public.users;

-- 7. Seed de flags (inactivas: nadie pierde acceso hoy)
insert into public.feature_flags(feature, min_tier, active) values
  ('matching_advanced','premium',false),
  ('identity_public','premium',false),
  ('curated_network','premium',false),
  ('workflow_advanced','premium',false);

-- 8. Marcar admin inicial (cuenta confirmada por Asier)
update public.users set is_admin = true where email = 'siera.canal.yt@gmail.com';
