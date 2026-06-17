-- ════════════════════════════════════════════════════════════════════
-- SEGURANÇA — fechar bypasses de leitura/escrita direto na tabela.
-- Rodar UMA vez no SQL Editor do Supabase. Idempotente (pode rodar de novo).
-- ════════════════════════════════════════════════════════════════════

-- ── 1) signals: remover leitura crua pela chave anon ─────────────────
-- Antes: qualquer logado lia TODA a tabela (burlava cota/plano/janela).
-- Agora: sem policy de SELECT, anon/authenticated não leem nada direto.
-- O app já lê só via /api/signals, que usa service_role (ignora RLS) e
-- aplica a regra: admin vê tudo; usuário vê só o que o plano libera.
alter table public.signals enable row level security;
drop policy if exists "sinais: leitura autenticada" on public.signals;

-- ── 2) profiles: proteger colunas sensíveis contra auto-edição ───────
-- A RLS deixa o usuário atualizar a própria linha — mas NÃO pode mexer em
-- plano/validade/indicação. Este trigger reverte qualquer alteração dessas
-- colunas quando a chamada NÃO vem do backend (service_role). Assim o app
-- continua salvando preferências (ativos, timeframes, horário) normalmente,
-- e só o backend (admin/cupom/pagamento) muda o plano.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.plan            := old.plan;
    new.plan_expires_at := old.plan_expires_at;
    new.referral_code   := old.referral_code;
    new.referral_count  := old.referral_count;
    new.referred_by     := old.referred_by;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
