// POST /api/redeem-aluno — o usuário logado informa o cupom de aluno.
// Se bater com o app_settings.aluno_coupon, libera o plano "aluno" por 15 dias.
// (O admin pode depois mudar para "sem limite" no painel.)
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";
import { serverError } from "./_lib/http.js";

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

  // ── Rate limit: 3 tentativas erradas → bloqueia 30 min (por usuário). ──
  const MAX_ATTEMPTS = 3, WINDOW_MS = 30 * 60000, BLOCK_MS = 30 * 60000;
  const now = Date.now();
  const { data: th } = await sb.from("redeem_throttle").select("*").eq("user_id", user.id).maybeSingle();

  if (th?.blocked_until && new Date(th.blocked_until).getTime() > now) {
    const mins = Math.ceil((new Date(th.blocked_until).getTime() - now) / 60000);
    return res.status(429).json({ ok: false, blocked: true, error: `Muitas tentativas. Tente de novo em ${mins} min.` });
  }

  let valid = "";
  try {
    const { data: cfg } = await sb.from("app_settings").select("aluno_coupon").eq("id", 1).maybeSingle();
    valid = String(cfg?.aluno_coupon || "").trim().toLowerCase();
  } catch { /* coluna ainda não criada */ }

  if (!valid || coupon !== valid) {
    // Conta a tentativa errada dentro de uma janela de 30 min.
    let attempts = th?.attempts || 0;
    let windowStart = th?.window_start ? new Date(th.window_start).getTime() : 0;
    if (!windowStart || now - windowStart > WINDOW_MS) { windowStart = now; attempts = 1; }
    else attempts += 1;

    let blockedUntil = null;
    if (attempts >= MAX_ATTEMPTS) {
      blockedUntil = new Date(now + BLOCK_MS).toISOString();
      attempts = 0; windowStart = null; // zera a janela após bloquear
    }
    await sb.from("redeem_throttle").upsert({
      user_id: user.id, attempts,
      window_start: windowStart ? new Date(windowStart).toISOString() : null,
      blocked_until: blockedUntil, updated_at: new Date(now).toISOString(),
    });

    if (blockedUntil) {
      return res.status(429).json({ ok: false, blocked: true,
        error: "Cupom inválido. Limite de tentativas atingido — aguarde 30 min." });
    }
    return res.status(200).json({ ok: false,
      error: `Cupom de aluno inválido. Tentativas restantes: ${MAX_ATTEMPTS - attempts}.` });
  }

  // Cupom correto → limpa o contador de tentativas do usuário.
  await sb.from("redeem_throttle").delete().eq("user_id", user.id);

  // Não rebaixa quem já tem plano pago; só libera aluno para quem está no free.
  const { data: profile } = await sb.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  if (profile && profile.plan && profile.plan !== "free") {
    return res.status(200).json({ ok: true, plan: profile.plan, already: true });
  }

  const expires = new Date(Date.now() + 15 * 86400000).toISOString();
  const { error } = await sb.from("profiles")
    .update({ plan: "aluno", plan_expires_at: expires }).eq("id", user.id);
  if (error) return serverError(res, "Falha ao liberar o plano", error);

  return res.status(200).json({ ok: true, plan: "aluno", plan_expires_at: expires });
}
