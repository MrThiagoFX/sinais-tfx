// Resposta de erro padronizada para as Vercel Functions.
// Loga o detalhe real nos logs do servidor (Vercel → Functions → Logs) para
// depuração, mas devolve ao cliente SÓ uma mensagem genérica — não vaza
// estrutura interna do banco/stack para quem chama a API.
import { serviceClient, hasSupabase } from "./supabase.js";

export function serverError(res, message, err) {
  if (err) console.error(`[api] ${message}:`, err?.message || err);
  logError(message, err); // monitoramento (fire-and-forget)
  return res.status(500).json({ error: message });
}

// Registra o erro na tabela error_log para o admin acompanhar. Fire-and-forget e
// tolerante a falha: se a tabela ainda não existir, apenas ignora (não quebra a API).
export function logError(context, err) {
  if (!hasSupabase) return;
  try {
    const sb = serviceClient();
    sb.from("error_log").insert({
      context: String(context || "").slice(0, 200),
      detail: String(err?.message || err || "").slice(0, 1000),
    }).then(() => {}, () => {});
  } catch { /* ignore */ }
}
