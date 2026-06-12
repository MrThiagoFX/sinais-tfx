// GET /api/breakdown — desempenho por ATIVO × TIMEFRAME, para o usuário escolher
// o melhor tempo pelo histórico. Respeita a data de ativação (app_settings).
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";
import { ASSETS, TFS } from "./_lib/business.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const sb = serviceClient();

  // Janela: últimos 90 dias, ou a data de ativação do histórico (o que for mais recente).
  let cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  try {
    const { data: cfg } = await sb.from("app_settings").select("history_start_date").eq("id", 1).maybeSingle();
    if (cfg?.history_start_date) {
      const d = new Date(cfg.history_start_date);
      if (d > cutoff) cutoff = d;
    }
  } catch { /* tabela ainda não criada */ }

  const { data: rows, error } = await sb
    .from("signals")
    .select("asset,tf,status,result_pips")
    .gte("created_at", cutoff.toISOString())
    .in("status", ["ganho", "perda"])
    .limit(5000);
  if (error) return res.status(500).json({ error: "Falha ao ler sinais", detail: error.message });

  // Agrega por asset+tf
  const map = {};
  for (const s of rows || []) {
    if (!ASSETS.includes(s.asset) || !TFS.includes(s.tf)) continue;
    const k = `${s.asset}|${s.tf}`;
    const m = (map[k] = map[k] || { asset: s.asset, tf: s.tf, ganhos: 0, perdas: 0, pips: 0 });
    m.pips += Number(s.result_pips) || 0;
    if (s.status === "ganho") m.ganhos++; else m.perdas++;
  }
  const breakdown = Object.values(map).map((m) => {
    const total = m.ganhos + m.perdas;
    return { ...m, total, assertividade: total ? Math.round((m.ganhos / total) * 100) : 0, pips: Math.round(m.pips) };
  });

  return res.status(200).json({ desde: cutoff.toISOString(), breakdown });
}
