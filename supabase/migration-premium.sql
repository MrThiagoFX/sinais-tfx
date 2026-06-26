-- ════════════════════════════════════════════════════════
-- INFINITY SIGNALS · Plano "premium" (semanal)
-- Libera o valor 'premium' na constraint de plano dos perfis.
-- Rodar no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- ════════════════════════════════════════════════════════

alter table public.profiles drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free','premium','mensal','anual','aluno','influencer'));
