// Disparo de Web Push (VAPID) para os usuários elegíveis a um sinal.
import webpush from "web-push";
import { serviceClient } from "./supabase.js";
import { isEligible, dailyQuota, startOfForexDayMs } from "./business.js";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

export const hasVapid = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (hasVapid) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:suporte@infinitysignals.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// O usuário pediu alerta de FECHAMENTO desta operação específica?
// (Modelo "estrela por operação": só avisa o fechamento das que ele marcou.)
function wantsCloseAlert(signal, profile) {
  const favs = profile?.close_alerts;
  return Array.isArray(favs) && favs.includes(signal.signal_id);
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
    // Entrada: notifica todos os elegíveis (sem filtro de favorito por ativo).

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
    // Fechamento: só avisa quem marcou ⭐ nesta operação.
    if (!wantsCloseAlert(signal, profile)) continue;

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

// Boletim diário: no fim do dia, envia a cada usuário o resumo das SUAS
// operações fechadas hoje (ganhos/perdas/pips), respeitando o que ele segue.
export async function sendDailyBulletin() {
  if (!hasVapid) return { sent: 0, skipped: "VAPID ausente" };
  const sb = serviceClient();

  const { data: profiles, error: pErr } = await sb.from("profiles").select("*");
  if (pErr || !profiles) return { sent: 0, error: pErr?.message };

  // Operações fechadas hoje (dia de Brasília).
  const dayStart = startOfForexDayMs();
  const { data: rows } = await sb
    .from("signals").select("*")
    .in("status", ["ganho", "perda"])
    .gte("created_at", new Date(dayStart).toISOString())
    .limit(2000);
  const closedToday = rows || [];

  // Boletim do DIA da FERRAMENTA (laudo geral, igual pra todos — não filtra por
  // perfil). Traz pips totais, acerto e o melhor ativo do dia.
  const g = closedToday.filter((s) => s.status === "ganho").length;
  const p = closedToday.filter((s) => s.status === "perda").length;
  const total = g + p;
  const pips = Math.round(closedToday.reduce((a, s) => a + (Number(s.result_pips) || 0), 0));
  const winRate = total ? Math.round((g / total) * 100) : 0;
  // Melhor ativo do dia (mais pips).
  const porAtivo = {};
  for (const s of closedToday) porAtivo[s.asset] = (porAtivo[s.asset] || 0) + (Number(s.result_pips) || 0);
  const melhor = Object.entries(porAtivo).sort((a, b) => b[1] - a[1])[0];

  const body = total > 0
    ? `${pips >= 0 ? "+" : ""}${pips} pips · ${g}✓ ${p}✗ · ${winRate}% acerto`
      + (melhor ? `\n🏆 Melhor: ${melhor[0]} (${melhor[1] >= 0 ? "+" : ""}${Math.round(melhor[1])} pips)` : "")
    : "Hoje sem operações fechadas. Até amanhã! 📈";
  // url com ?go=performance → ao tocar, abre no Desempenho (boletim do dia).
  const payload = JSON.stringify({ title: "📊 Boletim do dia — Infinity Signals", body, url: "/?go=performance" });

  let sent = 0, users = 0;
  for (const profile of profiles) {
    const { data: subs } = await sb
      .from("push_subscriptions").select("id, subscription").eq("user_id", profile.id);
    if (!subs?.length) continue;
    let any = false;
    for (const row of subs) {
      try { await webpush.sendNotification(row.subscription, payload); sent++; any = true; }
      catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    }
    if (any) users++;
  }
  return { sent, users, pips, ganhos: g, perdas: p, melhor_ativo: melhor?.[0] || null };
}
