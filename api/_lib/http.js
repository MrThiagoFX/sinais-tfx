// Resposta de erro padronizada para as Vercel Functions.
// Loga o detalhe real nos logs do servidor (Vercel → Functions → Logs) para
// depuração, mas devolve ao cliente SÓ uma mensagem genérica — não vaza
// estrutura interna do banco/stack para quem chama a API.
export function serverError(res, message, err) {
  if (err) console.error(`[api] ${message}:`, err?.message || err);
  return res.status(500).json({ error: message });
}
