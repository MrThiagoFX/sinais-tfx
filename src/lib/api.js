// Camada de acesso ao backend (/api) + auth Supabase, usada pelo App.jsx.
// Tudo aqui é tolerante a falha: se o Supabase não estiver configurado ou a
// API falhar, as funções retornam null/erro e o App mantém os mocks visuais.
import { supabase, hasSupabase } from "./supabase.js";

export { hasSupabase };

// Traduz as mensagens de erro do Supabase Auth (em inglês) para PT-BR claro.
// Mantém o texto original como fallback se não houver tradução conhecida.
export function friendlyAuthError(error) {
  const raw = (typeof error === "string" ? error : error?.message) || "";
  const m = raw.toLowerCase();
  if (!raw) return "Algo deu errado. Tente novamente.";
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já tem conta. Use “Entrar”.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid format")) return "E-mail inválido.";
  if (m.includes("signups not allowed")) return "Cadastro desativado no momento.";
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns segundos e tente de novo.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return "Sem conexão com o servidor. Verifique sua internet.";
  return raw; // mensagem desconhecida → mostra a original
}

/* ── Sessão / token ── */
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function authHeader() {
  const session = await getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/* ── Auth ── */
export async function signIn(email, password) {
  if (!supabase) return { ok: true, demo: true };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: friendlyAuthError(error) };
  return { ok: true, session: data.session };
}

// Código de indicação do usuário = primeiros 8 caracteres hex do id (uuid).
export function refCode(userId) {
  return userId ? userId.replace(/-/g, "").slice(0, 8) : "";
}

// Captura ?ref=CODE da URL e guarda para usar no cadastro.
export function captureRefFromUrl() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("tfx_ref", ref.replace(/-/g, "").slice(0, 8).toLowerCase());
  } catch { /* ignore */ }
}
function storedRef() {
  try { return localStorage.getItem("tfx_ref") || null; } catch { return null; }
}

export async function signUp(email, password, name, coupon) {
  if (!supabase) return { ok: true, demo: true };
  // Cupom digitado no cadastro tem prioridade; senão usa o ?ref do link.
  const referred_by = (coupon && coupon.trim()) || storedRef();
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { name, referred_by } },
  });
  if (error) return { ok: false, error: friendlyAuthError(error) };
  return { ok: true, session: data.session };
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

// Atualiza campos do perfil (name, username, phone, avatar_url...).
export async function updateProfileFields(fields) {
  if (!supabase) return { ok: false, error: "sem backend" };
  const session = await getSession();
  if (!session) return { ok: false, error: "sem sessão" };
  const { error } = await supabase.from("profiles").update(fields).eq("id", session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Troca o e-mail (Supabase envia confirmação para o novo endereço).
export async function updateEmail(email) {
  if (!supabase) return { ok: false, error: "sem backend" };
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { ok: false, error: friendlyAuthError(error) };
  return { ok: true };
}

// Envia a foto (data URL) para /api/avatar e devolve a URL pública.
export async function uploadAvatar(dataUrl) {
  if (!hasSupabase) return { ok: false, error: "sem backend" };
  try {
    const res = await fetch("/api/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ image: dataUrl }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || "Falha no upload" };
    return { ok: true, url: json.url };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Troca a senha do usuário logado.
export async function updatePassword(newPassword) {
  if (!supabase) return { ok: false, error: "sem backend" };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: friendlyAuthError(error) };
  return { ok: true };
}

// Envia e-mail de redefinição de senha (esqueci minha senha).
export async function resetPassword(email) {
  if (!supabase) return { ok: false, error: "sem backend" };
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { ok: false, error: friendlyAuthError(error) };
  return { ok: true };
}

/* ── Perfil / preferências ── */
export async function loadProfile() {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (error) return null;
  return data;
}

export async function saveProfile(prefs) {
  if (!supabase) return { ok: true, demo: true };
  const session = await getSession();
  if (!session) return { ok: false, error: "sem sessão" };
  const { error } = await supabase.from("profiles").update({
    plan: prefs.plan,
    assets: prefs.selectedAssets,
    tf_per_asset: prefs.tfPerAsset,
    schedule_start: prefs.schedule.start,
    schedule_end: prefs.schedule.end,
    schedule_all_day: prefs.schedule.allDay,
  }).eq("id", session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ── Dados (/api) ── */
export async function fetchSignals() {
  if (!hasSupabase) return null;
  try {
    const res = await fetch("/api/signals", { headers: await authHeader() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchStats() {
  if (!hasSupabase) return null;
  try {
    const res = await fetch("/api/stats", { headers: await authHeader() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchBreakdown() {
  if (!hasSupabase) return null;
  try {
    const res = await fetch("/api/breakdown", { headers: await authHeader() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/* ── Admin ── */
export async function isAdminUser() {
  const session = await getSession();
  const u = session?.user;
  return !!(u && (u.app_metadata?.role === "admin" || u.user_metadata?.is_admin === true));
}

export async function adminList() {
  if (!hasSupabase) return null;
  try {
    const res = await fetch("/api/admin", { headers: await authHeader() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function adminPost(body) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, ...json } : { ok: false, error: json.error || "falhou" };
}
export const adminSetPlan = (userId, plan) => adminPost({ action: "set-plan", userId, plan });
export const adminSetHistory = (date) => adminPost({ action: "set-history", date });
export const adminSetFreeQuota = (value) => adminPost({ action: "set-free-quota", value });

/* ── Web Push ── */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerPush() {
  if (!hasSupabase) return { ok: false, reason: "sem backend" };
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapid || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "sem suporte a push" };
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "permissão negada" };

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ subscription }),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
