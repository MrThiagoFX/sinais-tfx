// GET /api/cron/bulletin — Boletim diário (rodado pelo Vercel Cron às 00:00 UTC
// = 21:00 BRT). Envia a cada usuário inscrito o resumo das suas operações de hoje.
// Protegido: aceita a chamada do Vercel Cron (header x-vercel-cron) ou, para
// teste manual, o header Authorization: Bearer CRON_SECRET. NÃO aceita token
// na querystring (?key=...) — querystring vaza em logs/proxies/histórico.
import { hasSupabase } from "../_lib/supabase.js";
import { sendDailyBulletin } from "../_lib/push.js";
import { serverError } from "../_lib/http.js";

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = !!req.headers["x-vercel-cron"];
  // Com CRON_SECRET definido (recomendado), a Vercel injeta automaticamente
  // o header Authorization nas chamadas de cron → exigimos o secret e o
  // x-vercel-cron (forjável) deixa de bastar. Sem o secret, caímos no header
  // do Vercel para não quebrar o cron até configurarem.
  const ok = cronSecret ? auth === `Bearer ${cronSecret}` : isVercelCron;
  if (!ok) return res.status(401).json({ error: "não autorizado" });

  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  try {
    const r = await sendDailyBulletin();
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    return serverError(res, "Falha ao enviar boletim", e);
  }
}
