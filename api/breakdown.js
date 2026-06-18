// GET /api/breakdown — desempenho por ATIVO × TIMEFRAME, para o usuário escolher
// o melhor tempo pelo histórico. Lê os resumos pré-agregados de stats_daily
// (mantidos por trigger no fechamento), somando por (ativo, timeframe) na janela.
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";
import { ASSETS, TFS } from "./_lib/business.js";
import { serverError } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const sb = serviceClient();

  // Janela: últimos 90 dias, ou a data de ativação do histórico (a mais recente).
  let cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  try {
    const { data: cfg } = await sb.from("app_settings").select("history_start_date").eq("id", 1).maybeSingle();
    if (cfg?.history_start_date) {
      const d = new Date(cfg.history_start_date);
      if (d > cutoff) cutoff = d;
    }
  } catch { /* tabela ainda não criada */ }
  const cutoffDay = cutoff.toISOString().slice(0, 10);

  const { data: rows, error } = await sb
    .from("stats_daily")
    .select("asset,tf,ganhos,perdas,pips")
    .gte("day", cutoffDay)
    .limit(5000);
  if (error) return serverError(res, "Falha ao ler estatísticas", error);

  // Soma os buckets diários por asset+tf.
  const map = {};
  for (const r of rows || []) {
    if (!ASSETS.includes(r.asset) || !TFS.includes(r.tf)) continue;
    const k = `${r.asset}|${r.tf}`;
    const m = (map[k] = map[k] || { asset: r.asset, tf: r.tf, ganhos: 0, perdas: 0, pips: 0 });
    m.ganhos += r.ganhos || 0;
    m.perdas += r.perdas || 0;
    m.pips += Number(r.pips) || 0;
  }
  const breakdown = Object.values(map).map((m) => {
    const total = m.ganhos + m.perdas;
    return { ...m, total, assertividade: total ? Math.round((m.ganhos / total) * 100) : 0, pips: Math.round(m.pips) };
  });

  return res.status(200).json({ desde: cutoff.toISOString(), breakdown });
}
