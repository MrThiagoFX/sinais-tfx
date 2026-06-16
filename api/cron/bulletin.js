// GET /api/cron/bulletin — Boletim diário (rodado pelo Vercel Cron às 00:00 UTC
// = 21:00 BRT). Envia a cada usuário inscrito o resumo das suas operações de hoje.
// Protegido: aceita a chamada do Vercel Cron (header x-vercel-cron) ou um
// secret manual (?key=MT4_TOKEN ou Authorization: Bearer CRON_SECRET) para teste.
import { hasSupabase } from "../_lib/supabase.js";
import { sendDailyBulletin } from "../_lib/push.js";

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = !!req.headers["x-vercel-cron"];
  const ok = isVercelCron
    || (cronSecret && auth === `Bearer ${cronSecret}`)
    || (req.query?.key && req.query.key === process.env.MT4_TOKEN);
  if (!ok) return res.status(401).json({ error: "não autorizado" });

  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  try {
    const r = await sendDailyBulletin();
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
