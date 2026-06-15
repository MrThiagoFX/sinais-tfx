// GET /api/stats — métricas de desempenho do usuário autenticado.
// Calcula sobre public.signals (status, result_pips), respeitando as
// preferências (ativos/timeframes) e a janela de horário do usuário.
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";
import { isEligible, startOfBrtDayMs } from "./_lib/business.js";

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

  // Janela base: últimos 30 dias (contabilidade mensal — histórico real curto
  // e consistente, em vez de acumular meses)…
  const since = new Date();
  since.setDate(since.getDate() - 30);

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

  // Acumulado geral + recortes de hoje (dia de Brasília) e da semana (7 dias).
  const dayStart = startOfBrtDayMs();
  const weekAgo = Date.now() - 7 * 86400000;
  const agg = (list) => {
    let g = 0, p = 0, pips = 0;
    for (const s of list) {
      pips += Number(s.result_pips) || 0;
      if (s.status === "ganho") g++; else if (s.status === "perda") p++;
    }
    const tot = g + p;
    return { ganhos: g, perdas: p, total: tot, pips: Math.round(pips), assertividade: tot ? Math.round((g / tot) * 100) : 0 };
  };

  const geral = agg(relevant);
  const dia = agg(relevant.filter((s) => new Date(s.created_at).getTime() >= dayStart));
  const semana = agg(relevant.filter((s) => new Date(s.created_at).getTime() >= weekAgo));

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
