-- ════════════════════════════════════════════════════════════════════
-- Rate limit genérico (anti-abuso/spam) para as Vercel Functions.
-- Janela fixa por chave: signals POST (global), avatar e push (por usuário).
-- Rodar UMA vez no SQL Editor do Supabase. Idempotente.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.rate_limit (
  key          text primary key,            -- ex.: "signals:post" ou "avatar:<user_id>"
  window_start timestamptz not null default now(),
  count        int not null default 0
);

-- Só o backend (service_role) acessa. RLS ligada sem policies = ninguém lê/zera direto.
alter table public.rate_limit enable row level security;
