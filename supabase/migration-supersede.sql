-- ════════════════════════════════════════════════════════
-- INFINITY SIGNALS · Auto-cura de operações abertas
-- Garante a invariante: no máximo 1 sinal "aberto" por (asset, tf).
-- Rodar no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- ════════════════════════════════════════════════════════

-- 1) Resolve duplicatas JÁ existentes: para cada (asset, tf) com mais de um
--    "aberto", mantém o mais recente e cancela os antigos (não contam no laudo).
with ranked as (
  select id, row_number() over (partition by asset, tf order by created_at desc) as rn
  from public.signals
  where status = 'aberto'
)
update public.signals s
set status = 'cancelado', closed_at = now()
from ranked r
where s.id = r.id and r.rn > 1;

-- 2) Índice único parcial: torna FISICAMENTE impossível ter 2 abertos no mesmo
--    ativo+tf. Combinado com o "supersede" no /api/signals, fecha a porta de vez.
create unique index if not exists signals_one_open_per_asset_tf
  on public.signals (asset, tf)
  where status = 'aberto';
