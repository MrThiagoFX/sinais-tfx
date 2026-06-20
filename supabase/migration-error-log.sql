-- Monitoramento de erros (leve): registra falhas 500 das APIs para o admin ver.
-- Só o service_role grava/lê (bypassa RLS); ninguém mais acessa.
create table if not exists public.error_log (
  id      bigserial primary key,
  ts      timestamptz not null default now(),
  context text,
  detail  text
);

alter table public.error_log enable row level security;

-- Sem políticas = nem anon nem authenticated têm acesso. O backend usa o
-- service_role (que ignora RLS) para gravar e ler.
revoke all on public.error_log from anon, authenticated;

-- Índice para listar os mais recentes rapidamente.
create index if not exists error_log_ts_idx on public.error_log (ts desc);
