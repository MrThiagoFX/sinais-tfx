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

  // LAUDO: track record OFICIAL da ferramenta — IGUAL para todos os usuários.
  // Janela: últimos 90 dias (p/ recorte de 3 meses), respeitando a data de
  // ativação do histórico (o que for mais recente).
  let cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
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

  // Recortes por dia do mercado (UTC): Hoje · Semana (7d) · Mês (30d) · 3 meses (90d).
  const todayDay = new Date(startOfForexDayMs()).toISOString().slice(0, 10);
  const weekAgoDay = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgoDay = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  // Laudo = TODAS as operações (não filtra por ativo/tf do usuário) → igual p/ todos.
  const relevant = (rows || []);

  const geral = agg(relevant);
  const dia = agg(relevant.filter((r) => r.day >= todayDay));
  const semana = agg(relevant.filter((r) => r.day >= weekAgoDay));
  const mes = agg(relevant.filter((r) => r.day >= monthAgoDay));
  const trimestre = geral; // 90 dias = toda a janela

  return res.status(200).json({
    assertividade: geral.total ? Math.round((geral.ganhos / geral.total) * 100) / 100 : 0,
    ganhos: geral.ganhos,
    perdas: geral.perdas,
    acumulado_pips: geral.pips,
    amostra: geral.total,
    dia,
    semana,
    mes,
    trimestre,
  });
}
