// GET /api/stats — métricas de desempenho do usuário autenticado.
// Calcula sobre public.signals (status, result_pips), respeitando as
// preferências (ativos/timeframes) e a janela de horário do usuário.
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";
import { isEligible } from "./_lib/business.js";

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

  // Janela base: últimos 90 dias…
  const since = new Date();
  since.setDate(since.getDate() - 90);

  // …mas o admin pode definir a data em que o histórico "real" começa
  // (descarta o período de teste). Vale a data mais recente entre as duas.
  let cutoff = since;
  try {
    const { data: cfg } = await sb.from("app_settings").select("history_start_date").eq("id", 1).maybeSingle();
    if (cfg?.history_start_date) {
      const d = new Date(cfg.history_start_date);
      if (d > cutoff) cutoff = d;
    }
  } catch { /* tabela ainda não criada → ignora */ }

  const { data: rows, error } = await sb
    .from("signals")
    .select("*")
    .gte("created_at", cutoff.toISOString())
    .in("status", ["ganho", "perda"])
    .limit(5000);
  if (error) return res.status(500).json({ error: "Falha ao ler sinais", detail: error.message });

  const relevant = (rows || []).filter((s) => isEligible(s, profile));
  let ganhos = 0, perdas = 0, acumulado = 0;
  for (const s of relevant) {
    const pips = Number(s.result_pips) || 0;
    acumulado += pips;
    if (s.status === "ganho") ganhos++;
    else if (s.status === "perda") perdas++;
  }
  const total = ganhos + perdas;
  const assertividade = total ? ganhos / total : 0;

  return res.status(200).json({
    assertividade: Math.round(assertividade * 100) / 100,
    ganhos,
    perdas,
    acumulado_pips: Math.round(acumulado),
    amostra: total,
  });
}
