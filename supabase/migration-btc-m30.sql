-- ════════════════════════════════════════════════════════
-- INFINITY SIGNALS · BTCUSD no lugar do NAS100 + timeframe M30
-- Libera os novos valores nas constraints da tabela signals.
-- Mantém NAS100 e M1 (histórico antigo continua válido).
-- Rodar no SQL Editor ANTES de mudar o indicador na VPS.
-- Seguro rodar mais de uma vez.
-- ════════════════════════════════════════════════════════

-- 1) Ativos: adiciona BTCUSD (mantém os antigos pro histórico)
alter table public.signals drop constraint if exists signals_asset_check;
alter table public.signals
  add constraint signals_asset_check
  check (asset in ('EURUSD','GBPUSD','XAUUSD','NAS100','US30','BTCUSD'));

-- 2) Timeframes: adiciona M30 (mantém M1/M5/M15)
alter table public.signals drop constraint if exists signals_tf_check;
alter table public.signals
  add constraint signals_tf_check
  check (tf in ('M1','M5','M15','M30'));
