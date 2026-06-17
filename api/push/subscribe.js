// POST /api/push/subscribe — registra a PushSubscription do usuário logado.
// Body: { subscription: <objeto retornado por pushManager.subscribe> }
import { serviceClient, getUser, hasSupabase } from "../_lib/supabase.js";
import { serverError } from "../_lib/http.js";
import { rateLimit, tooMany } from "../_lib/ratelimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { subscription } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "subscription inválida" });
  }

  if (!hasSupabase) {
    return res.status(503).json({ error: "Supabase não configurado (preencha o .env na Fase 2)." });
  }

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const rl = await rateLimit(`push:${user.id}`, 30, 3600000); // 30/hora por usuário
  if (!rl.ok) return tooMany(res, rl.retryAfterSec);

  const sb = serviceClient();
  const { error } = await sb
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, subscription },
      { onConflict: "user_id,subscription" }
    );
  if (error) return serverError(res, "Falha ao salvar inscrição", error);

  return res.status(201).json({ ok: true });
}
