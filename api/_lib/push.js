// Disparo de Web Push (VAPID) para os usuários elegíveis a um sinal.
import webpush from "web-push";
import { serviceClient } from "./supabase.js";
import { isEligible, dailyQuota } from "./business.js";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

export const hasVapid = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (hasVapid) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:suporte@infinitysignals.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// O ativo do sinal está entre os favoritos do usuário?
// Sem favoritos marcados → notifica todos (comportamento padrão).
// Com favoritos → só notifica os ativos escolhidos (não apita todos).
function isFavorite(signal, profile) {
  const favs = profile?.notify_favorites;
  if (!Array.isArray(favs) || favs.length === 0) return true;
  return favs.includes(signal.asset);
}

// Notifica todos os usuários elegíveis a `signal` (asset/tf/janela/cota).
// Incrementa daily_usage e remove subscriptions expiradas (410/404).
export async function notifyEligibleUsers(signal) {
  if (!hasVapid) return { sent: 0, skipped: "VAPID ausente" };
  const sb = serviceClient();

  const { data: profiles, error: pErr } = await sb.from("profiles").select("*");
  if (pErr || !profiles) return { sent: 0, error: pErr?.message };

  const today = new Date().toISOString().slice(0, 10);
  const payload = JSON.stringify({
    title: `${signal.dir} · ${signal.asset}`,
    body: `${signal.tf} · entrada ${signal.entry} · TP ${signal.tp} · SL ${signal.sl}`,
    url: "/",
  });

  let sent = 0;
  for (const profile of profiles) {
    if (!isEligible(signal, profile)) continue;
    if (!isFavorite(signal, profile)) continue;

    // Respeita a cota diária do plano.
    const { data: usage } = await sb
      .from("daily_usage")
      .select("delivered")
      .eq("user_id", profile.id)
      .eq("day", today)
      .maybeSingle();
    const delivered = usage?.delivered || 0;
    if (delivered >= dailyQuota(profile)) continue;

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", profile.id);
    if (!subs?.length) continue;

    let deliveredAny = false;
    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        deliveredAny = true;
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    }

    if (deliveredAny) {
      await sb
        .from("daily_usage")
        .upsert({ user_id: profile.id, day: today, delivered: delivered + 1 },
                { onConflict: "user_id,day" });
    }
  }
  return { sent };
}

// Notifica o FECHAMENTO de um sinal (bateu TP ou STOP) aos usuários elegíveis.
// Não consome cota (não é um sinal novo) e remove subscriptions expiradas.
export async function notifyClose(signal) {
  if (!hasVapid) return { sent: 0, skipped: "VAPID ausente" };
  const sb = serviceClient();

  const { data: profiles, error: pErr } = await sb.from("profiles").select("*");
  if (pErr || !profiles) return { sent: 0, error: pErr?.message };

  const win = signal.status === "ganho";
  const pips = Number(signal.result_pips) || 0;
  const payload = JSON.stringify({
    title: win ? `🎯 ${signal.asset} bateu o alvo (TP)` : `🛑 ${signal.asset} bateu o stop (SL)`,
    body: `${signal.dir} · ${signal.tf} · resultado ${pips >= 0 ? "+" : ""}${pips} pips`,
    url: "/",
  });

  let sent = 0;
  for (const profile of profiles) {
    if (!isEligible(signal, profile)) continue;
    if (!isFavorite(signal, profile)) continue;

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", profile.id);
    if (!subs?.length) continue;

    for (const row of subs) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    }
  }
  return { sent };
}
