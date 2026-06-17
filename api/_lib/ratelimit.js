// Rate limit simples por janela fixa, persistido em public.rate_limit.
// Bom o suficiente para anti-abuso (sob alta concorrência pode contar
// levemente a mais — aceitável, falha para o lado seguro).
// Se a tabela ainda não existir, NÃO bloqueia (degrada aberto) para não
// derrubar o endpoint antes de rodar a migration.
import { serviceClient } from "./supabase.js";

// Retorna { ok: true } ou { ok: false, retryAfterSec }.
export async function rateLimit(key, max, windowMs) {
  let sb;
  try { sb = serviceClient(); } catch { return { ok: true }; }
  const now = Date.now();

  const { data: row, error } = await sb.from("rate_limit").select("*").eq("key", key).maybeSingle();
  if (error) return { ok: true }; // tabela ausente/erro → não bloqueia

  let windowStart = row?.window_start ? new Date(row.window_start).getTime() : 0;
  let count = row?.count || 0;
  if (!windowStart || now - windowStart >= windowMs) { windowStart = now; count = 0; }
  count += 1;

  await sb.from("rate_limit").upsert({
    key, window_start: new Date(windowStart).toISOString(), count,
  });

  if (count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
  }
  return { ok: true };
}

// Helper de resposta 429 padronizada.
export function tooMany(res, retryAfterSec) {
  res.setHeader("Retry-After", String(retryAfterSec));
  return res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
}
