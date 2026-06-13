// Helpers de acesso ao Supabase para as Vercel Functions.
// Pasta _lib: o prefixo "_" faz a Vercel NÃO tratar estes arquivos como rotas.
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// Cliente com service role — ignora RLS. Usar SOMENTE no backend (nunca expor).
export function serviceClient() {
  if (!hasSupabase) throw new Error("Supabase não configurado (SUPABASE_URL/SERVICE_ROLE).");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// O usuário é admin? (marcado no metadata da conta).
export function isAdmin(user) {
  return user?.app_metadata?.role === "admin" || user?.user_metadata?.is_admin === true;
}

// Valida o JWT do usuário (header Authorization: Bearer <token>) e devolve o user.
// Retorna null se ausente/ inválido.
export async function getUser(req) {
  const auth = req.headers["authorization"] || req.headers["Authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
