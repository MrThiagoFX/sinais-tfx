// POST /api/avatar — recebe a foto (data URL base64) do usuário logado,
// salva no bucket 'avatars' via service role e devolve a URL pública.
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";
import { serverError } from "./_lib/http.js";
import { rateLimit, tooMany } from "./_lib/ratelimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const rl = await rateLimit(`avatar:${user.id}`, 10, 3600000); // 10/hora por usuário
  if (!rl.ok) return tooMany(res, rl.retryAfterSec);

  const { image } = req.body || {};
  const m = typeof image === "string" && image.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
  if (!m) return res.status(400).json({ error: "Imagem inválida (use PNG, JPEG ou WEBP)" });

  const contentType = m[1];
  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  const buffer = Buffer.from(m[3], "base64");
  if (buffer.length > 3 * 1024 * 1024) return res.status(413).json({ error: "Imagem acima de 3MB" });

  const sb = serviceClient();
  const path = `${user.id}.${ext}`;
  const { error } = await sb.storage.from("avatars").upload(path, buffer, {
    contentType, upsert: true,
  });
  if (error) return serverError(res, "Falha no upload", error);

  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  // cache-buster para a foto atualizar na hora
  const url = `${data.publicUrl}?v=${Date.now()}`;

  await sb.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  return res.status(200).json({ ok: true, url });
}
