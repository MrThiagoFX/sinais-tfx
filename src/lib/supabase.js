// Cliente Supabase do frontend. Se as variáveis VITE_ não estiverem
// preenchidas (Fase 2), `hasSupabase` é false e o app roda em modo demo
// (mocks), exatamente como antes — sem quebrar nada.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && key && !url.includes("xxxx"));

export const supabase = hasSupabase
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
