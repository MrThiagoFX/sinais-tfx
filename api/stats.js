// GET /api/stats — métricas de desempenho do usuário autenticado.
// Lê os resumos PRÉ-AGREGADOS de public.stats_daily (mantidos por trigger no
// fechamento de cada operação), em vez de varrer todos os sinais. Soma apenas
// os buckets (ativo, timeframe, dia) elegíveis ao usuário.
// Obs.: por ser agregado por dia, NÃO há filtro de hora (janela 08-18 etc.) —
// o resumo é o "track record" dos ativos/timeframes que o usuário acompanha.
import { serviceClient, getUser, hasSupabase, isAdmin } from "./_lib/supabase.js";
import { isAnualLike, startOfForexDayMs } from "./_lib/business.js";
import { serverError } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }
  if (!hasSupabase) {
    return res.status(503).json({ error: "Supabase não configurado (preencha o .env na Fase 2)." });
  }

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const sb = serviceClient();
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const admin = isAdmin(user);

  // Janela: últimos 30 dias, ou a data de ativação do histórico (a mais recente).
  let cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  try {
    const { data: cfg } = await sb.from("app_settings").select("history_start_date").eq("id", 1).maybeSingle();
    if (cfg?.history_start_date) {
      const d = new Date(cfg.history_start_date);
      if (d > cutoff) cutoff = d;
    }
  } catch { /* tabela ainda não criada → ignora */ }
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const { data: rows, error } = await sb
    .from("stats_daily")
    .select("*")
    .gte("day", cutoffDay)
    .limit(5000);
  if (error) return serverError(res, "Falha ao ler estatísticas", error);

  // Elegibilidade por ATIVO/TIMEFRAME (sem filtro de hora — é agregado por dia).
  //   admin / free → todos os ativos · premium → só o que escolheu.
  //   M1 é exclusivo dos planos "estilo anual".
  const eligible = (r) => {
    if (r.tf === "M1" && !isAnualLike(profile?.plan)) return false;
    if (admin || !profile || profile.plan === "free") return true;
    const assets = profile.assets || [];
    const tfMap = profile.tf_per_asset || {};
    if (!assets.includes(r.asset)) return false;
    return (tfMap[r.asset] || []).includes(r.tf);
  };

  const agg = (list) => {
    let g = 0, p = 0, pips = 0;
    for (const r of list) {
      g += r.ganhos || 0;
      p += r.perdas || 0;
      pips += Number(r.pips) || 0;
    }
    const tot = g + p;
    return { ganhos: g, perdas: p, total: tot, pips: Math.round(pips), assertividade: tot ? Math.round((g / tot) * 100) : 0 };
  };

  // Recortes por dia do mercado (UTC): Hoje · Semana (7d) · Mês (toda a janela).
  const todayDay = new Date(startOfForexDayMs()).toISOString().slice(0, 10);
  const weekAgoDay = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const relevant = (rows || []).filter(eligible);

  const geral = agg(relevant);
  const dia = agg(relevant.filter((r) => r.day >= todayDay));
  const semana = agg(relevant.filter((r) => r.day >= weekAgoDay));

  return res.status(200).json({
    assertividade: geral.total ? Math.round((geral.ganhos / geral.total) * 100) / 100 : 0,
    ganhos: geral.ganhos,
    perdas: geral.perdas,
    acumulado_pips: geral.pips,
    amostra: geral.total,
    dia,
    semana,
  });
}
