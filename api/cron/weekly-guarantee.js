// GET /api/cron/weekly-guarantee — roda a garantia da semana (Premium) sob demanda.
// Auth: cron do Vercel (x-vercel-cron) · CRON_SECRET · ?key=MT4_TOKEN · admin logado.
// Também roda automaticamente dentro do /api/selfcheck (diário). Este endpoint
// existe para teste manual e/ou cron externo (ex.: cron-job.org a cada 1h).
import { serviceClient, getUser, hasSupabase, isAdmin } from "../_lib/supabase.js";
import { runWeeklyGuarantee } from "../_lib/guarantee.js";

function autorizado(req, user) {
  if (req.headers["x-vercel-cron"]) return true;
  const auth = req.headers["authorization"] || "";
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.query?.key && req.query.key === process.env.MT4_TOKEN) return true;
  return !!(user && isAdmin(user));
}

export default async function handler(req, res) {
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });
  const user = await getUser(req);
  if (!autorizado(req, user)) return res.status(401).json({ error: "não autorizado" });
  const out = await runWeeklyGuarantee(serviceClient());
  return res.status(out.ok ? 200 : 500).json({ ...out, quando: new Date().toISOString() });
}
