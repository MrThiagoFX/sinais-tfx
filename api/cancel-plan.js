// POST /api/cancel-plan — cancelamento self-service do próprio usuário.
// SEGURO POR DESIGN: só REBAIXA para "free" (nunca promove). Usa o service role
// só para gravar plan=free + limpar a validade. Não toca em planos de outros
// usuários e não pode ser usado para ganhar acesso — apenas para abrir mão dele.
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

  const sb = serviceClient();
  const { data: profile } = await sb.from("profiles").select("plan").eq("id", user.id).maybeSingle();

  // Já está no free → nada a fazer.
  if (!profile || profile.plan === "free") {
    return res.status(200).json({ ok: true, plan: "free", already: true });
  }

  const { error } = await sb.from("profiles")
    .update({ plan: "free", plan_expires_at: null }).eq("id", user.id);
  if (error) return serverError(res, "Falha ao cancelar o plano", error);

  return res.status(200).json({ ok: true, plan: "free" });
}
