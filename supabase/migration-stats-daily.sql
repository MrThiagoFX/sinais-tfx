-- ════════════════════════════════════════════════════════════════════
-- Estatísticas pré-agregadas por (ativo, timeframe, dia do mercado).
-- Evita varrer todos os sinais a cada /api/stats: o resumo é mantido
-- incrementalmente por um trigger no fechamento de cada operação.
-- "dia" = dia do mercado Forex (data UTC, que vira 21:00 BRT).
-- Rodar UMA vez no SQL Editor. Idempotente (recria + refaz o backfill).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.stats_daily (
  asset  text not null,
  tf     text not null,
  day    date not null,
  ganhos int not null default 0,
  perdas int not null default 0,
  pips   numeric not null default 0,
  primary key (asset, tf, day)
);

-- Só o backend (service_role) acessa. RLS ligada sem policies = ninguém lê direto.
alter table public.stats_daily enable row level security;

-- ── Trigger: incrementa o bucket ao FECHAR uma operação ──────────────
-- Só conta a transição aberto -> ganho/perda (não reconta edições nem
-- 'expirado'). Atômico e à prova de bypass (vale para API, admin, etc.).
create or replace function public.bump_stats_on_close()
returns trigger language plpgsql security definer as $$
begin
  if old.status = 'aberto' and new.status in ('ganho', 'perda') then
    insert into public.stats_daily (asset, tf, day, ganhos, perdas, pips)
    values (
      new.asset, new.tf, (new.created_at at time zone 'UTC')::date,
      case when new.status = 'ganho' then 1 else 0 end,
      case when new.status = 'perda' then 1 else 0 end,
      coalesce(new.result_pips, 0)
    )
    on conflict (asset, tf, day) do update set
      ganhos = public.stats_daily.ganhos + excluded.ganhos,
      perdas = public.stats_daily.perdas + excluded.perdas,
      pips   = public.stats_daily.pips   + excluded.pips;
  end if;
  return new;
end; $$;

drop trigger if exists trg_bump_stats on public.signals;
create trigger trg_bump_stats
  after update on public.signals
  for each row execute function public.bump_stats_on_close();

-- ── Reprocessamento (backfill): reconstrói a partir dos sinais fechados ──
truncate public.stats_daily;
insert into public.stats_daily (asset, tf, day, ganhos, perdas, pips)
select
  asset, tf, (created_at at time zone 'UTC')::date,
  count(*) filter (where status = 'ganho'),
  count(*) filter (where status = 'perda'),
  coalesce(sum(result_pips), 0)
from public.signals
where status in ('ganho', 'perda')
group by asset, tf, (created_at at time zone 'UTC')::date;
