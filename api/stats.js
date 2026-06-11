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

  // Considera os últimos 30 dias de sinais já encerrados (ganho/perda).
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: rows, error } = await sb
    .from("signals")
    .select("*")
    .gte("created_at", since.toISOString())
    .in("status", ["ganho", "perda"])
    .limit(2000);
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
