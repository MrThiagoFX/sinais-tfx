-- ════════════════════════════════════════════════════════
-- INFINITY SIGNALS · Schema Supabase
-- Rodar no SQL Editor do projeto
-- ════════════════════════════════════════════════════════

-- Perfil + preferências do usuário (1:1 com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  plan text not null default 'free' check (plan in ('free','mensal','anual')),
  assets text[] not null default '{}',                  -- ex.: {XAUUSD,NAS100,US30}
  tf_per_asset jsonb not null default '{}',             -- ex.: {"XAUUSD":["M5","M15"],"US30":["H1"]}
  schedule_start text not null default '08:00',
  schedule_end   text not null default '18:00',
  schedule_all_day boolean not null default false,      -- só efetivo no plano anual
  created_at timestamptz default now()
);

-- Sinais recebidos do MT4
create table if not exists public.signals (
  id bigint generated always as identity primary key,
  asset text not null check (asset in ('EURUSD','GBPUSD','XAUUSD','NAS100','US30')),
  dir   text not null check (dir in ('Compra','Venda')),
  tf    text not null check (tf in ('M5','M15','H1')),
  entry numeric not null,
  sl    numeric not null,
  tp    numeric not null,
  result_pips numeric,                                   -- preenchido depois (auditoria)
  status text not null default 'aberto' check (status in ('aberto','ganho','perda','expirado')),
  created_at timestamptz default now()
);
create index if not exists signals_asset_tf_idx on public.signals(asset, tf, created_at desc);

-- Inscrições de push por usuário
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,                           -- objeto PushSubscription completo
  created_at timestamptz default now(),
  unique (user_id, subscription)
);

-- Contagem de sinais entregues por usuário/dia (controle de cota)
create table if not exists public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  delivered int not null default 0,
  primary key (user_id, day)
);

-- ── RLS ──
alter table public.profiles enable row level security;
alter table public.signals enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.daily_usage enable row level security;

create policy "perfil próprio" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "sinais: leitura autenticada" on public.signals
  for select using (auth.role() = 'authenticated');
-- INSERT em signals: somente service_role (backend com MT4_TOKEN) — sem policy de insert

create policy "push próprio" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "uso próprio" on public.daily_usage
  for select using (auth.uid() = user_id);

-- Trigger: cria profile automático no signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
