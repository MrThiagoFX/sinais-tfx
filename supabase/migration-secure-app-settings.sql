-- Segurança: bloqueia leitura de app_settings pela chave pública (anon).
-- Sem nenhuma policy de SELECT, anon/authenticated não leem nada; o backend
-- usa service_role (que ignora RLS), então o app continua funcionando normal.
-- Evita vazar o cupom de aluno / configurações para qualquer um com a anon key.
alter table app_settings enable row level security;

-- Remove qualquer policy permissiva antiga (se existir) para garantir o bloqueio.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_settings'
  loop execute format('drop policy if exists %I on public.app_settings', pol.policyname); end loop;
end $$;
