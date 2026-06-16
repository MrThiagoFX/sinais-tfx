// POST /api/redeem-aluno — o usuário logado informa o cupom de aluno.
// Se bater com o app_settings.aluno_coupon, libera o plano "aluno" por 15 dias.
// (O admin pode depois mudar para "sem limite" no painel.)
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const coupon = String(req.body?.coupon || "").trim().toLowerCase();
  if (!coupon) return res.status(400).json({ error: "Informe o cupom" });

  const sb = serviceClient();

  let valid = "";
  try {
    const { data: cfg } = await sb.from("app_settings").select("aluno_coupon").eq("id", 1).maybeSingle();
    valid = String(cfg?.aluno_coupon || "").trim().toLowerCase();
  } catch { /* coluna ainda não criada */ }

  if (!valid || coupon !== valid) {
    return res.status(200).json({ ok: false, error: "Cupom de aluno inválido" });
  }

  // Não rebaixa quem já tem plano pago; só libera aluno para quem está no free.
  const { data: profile } = await sb.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  if (profile && profile.plan && profile.plan !== "free") {
    return res.status(200).json({ ok: true, plan: profile.plan, already: true });
  }

  const expires = new Date(Date.now() + 15 * 86400000).toISOString();
  const { error } = await sb.from("profiles")
    .update({ plan: "aluno", plan_expires_at: expires }).eq("id", user.id);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, plan: "aluno", plan_expires_at: expires });
}
