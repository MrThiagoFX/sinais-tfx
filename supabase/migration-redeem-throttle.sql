-- ════════════════════════════════════════════════════════════════════
-- Rate limit do resgate de cupom de aluno (anti brute-force).
-- 3 tentativas erradas → bloqueia o usuário por 30 min.
-- Rodar UMA vez no SQL Editor do Supabase. Idempotente.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.redeem_throttle (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  attempts      int not null default 0,        -- tentativas erradas na janela atual
  window_start  timestamptz,                   -- início da janela de contagem
  blocked_until timestamptz,                    -- se no futuro, está bloqueado
  updated_at    timestamptz default now()
);

-- Só o backend (service_role) acessa. RLS ligada sem policies = anon/authenticated
-- não leem nem escrevem direto (não dá pra zerar o próprio bloqueio).
alter table public.redeem_throttle enable row level security;
