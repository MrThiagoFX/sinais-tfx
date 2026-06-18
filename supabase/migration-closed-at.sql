-- ════════════════════════════════════════════════════════════════════
-- Data de encerramento do sinal (para ordenar/consultar por quando fechou).
-- Rodar UMA vez no SQL Editor do Supabase. Idempotente.
-- ════════════════════════════════════════════════════════════════════

alter table public.signals
  add column if not exists closed_at timestamptz;

-- Backfill: sinais já fechados não têm o momento real do fechamento (não era
-- gravado). Usa o created_at como aproximação para não ficarem com data nula.
update public.signals
  set closed_at = created_at
  where closed_at is null
    and status in ('ganho', 'perda', 'expirado');

-- Índice para ordenar o histórico por encerramento (desc).
create index if not exists signals_closed_at_idx on public.signals(closed_at desc);
