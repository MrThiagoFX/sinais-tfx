// /api/admin — área administrativa (somente contas admin).
// GET  → lista usuários (e-mail, plano, indicados) + a data de ativação do histórico.
// POST → { action: "set-plan", userId, plan } | { action: "set-history", date }
import { serviceClient, getUser, isAdmin, hasSupabase } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });
  if (!isAdmin(user)) return res.status(403).json({ error: "Acesso restrito ao admin" });

  const sb = serviceClient();

  if (req.method === "GET") {
    // Junta auth.users (e-mail) com profiles (plano/indicação).
    const { data: auth } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const { data: profiles } = await sb.from("profiles").select("*");
    const byId = {};
    for (const p of profiles || []) byId[p.id] = p;
    const users = (auth?.users || []).map((u) => {
      const p = byId[u.id] || {};
      return {
        id: u.id, email: u.email, created_at: u.created_at,
        name: p.name || u.user_metadata?.name || "",
        plan: p.plan || "free",
        plan_expires_at: p.plan_expires_at || null,
        referral_code: p.referral_code || "",
        referral_count: p.referral_count || 0,
        referred_by: p.referred_by || "",
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let history_start_date = null, free_quota = 4;
    try {
      const { data: cfg } = await sb.from("app_settings").select("history_start_date, free_quota").eq("id", 1).maybeSingle();
      history_start_date = cfg?.history_start_date || null;
      if (cfg?.free_quota) free_quota = cfg.free_quota;
    } catch { /* ignore */ }

    return res.status(200).json({ users, settings: { history_start_date, free_quota }, count: users.length });
  }

  if (req.method === "POST") {
    const { action } = req.body || {};

    if (action === "set-plan") {
      const { userId, plan } = req.body;
      if (!["free", "mensal", "anual", "aluno", "influencer"].includes(plan))
        return res.status(400).json({ error: "plano inválido" });
      const { error } = await sb.from("profiles").update({ plan }).eq("id", userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // Define a validade do plano: days>0 → agora+days; days=0/null → sem limite.
    if (action === "set-expiry") {
      const { userId } = req.body;
      const days = parseInt(req.body.days, 10);
      let expires = null;
      if (days > 0) expires = new Date(Date.now() + days * 86400000).toISOString();
      const { error } = await sb.from("profiles").update({ plan_expires_at: expires }).eq("id", userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true, plan_expires_at: expires });
    }

    if (action === "set-history") {
      const { date } = req.body; // ISO string ou null
      const { error } = await sb.from("app_settings")
        .upsert({ id: 1, history_start_date: date || null });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === "set-free-quota") {
      let v = parseInt(req.body.value, 10);
      if (!(v >= 2 && v <= 4)) return res.status(400).json({ error: "cota Free deve ser 2, 3 ou 4" });
      const { error } = await sb.from("app_settings").upsert({ id: 1, free_quota: v });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "ação desconhecida" });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido" });
}
