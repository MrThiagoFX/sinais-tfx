// GET /api/health — verificação simples de disponibilidade
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    app: "infinity-signals",
    time: new Date().toISOString(),
    env: {
      supabase: Boolean(process.env.SUPABASE_URL),
      mt4Token: Boolean(process.env.MT4_TOKEN),
      vapid: Boolean(process.env.VAPID_PUBLIC_KEY),
    },
  });
}
