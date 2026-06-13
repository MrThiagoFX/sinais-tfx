// POST /api/ticket — usuário logado abre um ticket de suporte.
// O ticket é encaminhado para o Telegram do admin (bot + chat_id).
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const message = String((req.body || {}).message || "").trim();
  if (message.length < 5) return res.status(400).json({ error: "Descreva o problema (mín. 5 caracteres)." });
  if (message.length > 2000) return res.status(400).json({ error: "Mensagem muito longa (máx. 2000)." });

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(503).json({ error: "Suporte por ticket ainda não configurado." });
  }

  // Dados do usuário para o ticket vir completo
  const sb = serviceClient();
  const { data: p } = await sb.from("profiles").select("name, plan, phone, referral_code").eq("id", user.id).maybeSingle();

  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text =
    `🎫 <b>Novo ticket — Infinity Signals</b>\n\n` +
    `<b>Nome:</b> ${esc(p?.name || "—")}\n` +
    `<b>E-mail:</b> ${esc(user.email)}\n` +
    `<b>Telefone:</b> ${esc(p?.phone || "—")}\n` +
    `<b>Plano:</b> ${esc(p?.plan || "free")}\n` +
    `<b>Código:</b> ${esc(p?.referral_code || "—")}\n\n` +
    `<b>Mensagem:</b>\n${esc(message)}`;

  try {
    const tg = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const tj = await tg.json();
    if (!tj.ok) return res.status(502).json({ error: "Falha ao enviar ao Telegram", detail: tj.description });
  } catch (e) {
    return res.status(502).json({ error: "Falha ao enviar ao Telegram", detail: e.message });
  }

  return res.status(200).json({ ok: true });
}
