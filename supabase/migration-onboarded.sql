-- ════════════════════════════════════════════════════════════════════
-- Flag de onboarding concluído no perfil.
-- Novos usuários (onboarded = false) são levados ao onboarding (escolher
-- plano/ativos/timeframes) no primeiro acesso, em vez de cair na home.
-- Rodar UMA vez no SQL Editor. Idempotente.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- Usuários EXISTENTES que já escolheram ativos: considera o onboarding feito
-- (não reincomoda quem já está configurado).
update public.profiles
  set onboarded = true
  where onboarded = false
    and coalesce(array_length(assets, 1), 0) > 0;
