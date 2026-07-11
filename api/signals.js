// /api/signals
// POST → MT4/EA envia sinal (header X-TFX-Token ou x-mt4-token).
//   Aceita o formato do EA (event SIGNAL_OPEN/SIGNAL_CLOSE, symbol/direction/timeframe,
//   entry/stop/target, signal_id) e também o formato legado {asset,dir,tf,entry,sl,tp}.
// GET → app lista sinais do usuário.
import {
  isEligible, dailyQuota, normalizeAsset, normalizeTf, normalizeDir, computePips, startOfForexDayMs, effectivePlan, freeTrialExpired, isMarketClosed,
} from "./_lib/business.js";
import { serviceClient, getUser, hasSupabase, isAdmin } from "./_lib/supabase.js";
import { notifyEligibleUsers, notifyClose } from "./_lib/push.js";
import { serverError } from "./_lib/http.js";
import { rateLimit, tooMany } from "./_lib/ratelimit.js";

export default async function handler(req, res) {
  if (req.method === "POST") return postSignal(req, res);
  if (req.method === "GET") return getSignals(req, res);
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido" });
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : (isFinite(parseFloat(v)) ? parseFloat(v) : null));

/* ── POST: recebe sinal do MT4/EA ── */
async function postSignal(req, res) {
  const token = req.headers["x-tfx-token"] || req.headers["x-mt4-token"];
  if (!process.env.MT4_TOKEN || token !== process.env.MT4_TOKEN) {
    return res.status(401).json({ error: "Token inválido" });
  }

  // Teto global de ingestão: mesmo com token válido, limita a 120 sinais/min
  // (muito acima do EA normal) — barra flood caso o token vaze.
  const rl = await rateLimit("signals:post", 120, 60000);
  if (!rl.ok) return tooMany(res, rl.retryAfterSec);

  const b = req.body || {};
  const event = (b.event || "SIGNAL_OPEN").toUpperCase();

  const asset = normalizeAsset(b.symbol || b.asset);
  const tf    = normalizeTf(b.timeframe || b.tf);
  const dir   = normalizeDir(b.direction || b.dir);
  const entry = num(b.entry);
  const sl    = num(b.stop != null ? b.stop : b.sl);
  const tp    = num(b.target != null ? b.target : b.tp);
  const signalId = b.signal_id || null;

  // Ativos/timeframes fora do escopo são ignorados sem erro (o EA roda em qualquer gráfico).
  if (!asset) return res.status(200).json({ ok: true, skipped: "ativo não suportado", symbol: b.symbol });
  if (!tf)    return res.status(200).json({ ok: true, skipped: "timeframe não suportado", timeframe: b.timeframe });
  if (!dir)   return res.status(400).json({ error: "direção inválida (BUY/SELL)" });

  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });
  const sb = serviceClient();

  // ── Fechamento: atualiza o sinal com resultado em pips e status ──
  if (event === "SIGNAL_CLOSE") {
    const exit = num(b.exit);
    if (exit == null || entry == null) return res.status(400).json({ error: "entry/exit numéricos exigidos no fechamento" });
    const pips = computePips(asset, dir, entry, exit);
    const status = (String(b.close_reason || "").toUpperCase() === "STOP")
      ? "perda" : (pips >= 0 ? "ganho" : "perda");

    let q = sb.from("signals").update({ result_pips: pips, status, closed_at: new Date().toISOString() });
    q = signalId ? q.eq("signal_id", signalId)
                 : q.eq("asset", asset).eq("tf", tf).eq("dir", dir).eq("status", "aberto");
    const { data, error } = await q.select();
    if (error) return serverError(res, "Falha ao fechar sinal", error);

    // Notifica o fechamento (TP/SL) aos usuários elegíveis.
    let push = { sent: 0 };
    if (data?.length) {
      try { push = await notifyClose(data[0]); }
      catch (e) { console.error("[api] push:", e?.message); push = { sent: 0, error: "falha ao notificar" }; }
    }
    return res.status(200).json({ ok: true, event, closed: data?.length || 0, result_pips: pips, status, push });
  }

  // ── Fim de semana: mercado fechado, SEM novas aberturas ──
  // Sexta à noite é o último sinal; só volta segunda 00:00 UTC (domingo meia-noite GMT).
  // O BTC negocia 24/7, mas esses sinais de sábado/domingo não valem — não entram no
  // feed nem no laudo. Retorna 2xx pro EA descartar o arquivo e não ficar reenviando.
  // (O SIGNAL_CLOSE acima NÃO é bloqueado: um sinal aberto na sexta pode fechar depois.)
  if (isMarketClosed(new Date())) {
    return res.status(200).json({ ok: true, skipped: "fim de semana (mercado fechado)", asset, tf });
  }

  // ── Abertura: grava e dispara push ──
  if ([entry, sl, tp].some((v) => v == null)) {
    return res.status(400).json({ error: "entry/stop/target devem ser numéricos" });
  }

  // Evita duplicar a mesma abertura (idempotência por signal_id).
  if (signalId) {
    const { data: ex } = await sb.from("signals").select("id").eq("signal_id", signalId).maybeSingle();
    if (ex) return res.status(200).json({ ok: true, duplicate: true, id: ex.id });
  }

  // AUTO-CURA (supersede): no máximo 1 sinal aberto por (ativo, tf). Se chega uma
  // abertura nova e ainda existe uma órfã aberta do mesmo ativo+tf (o CLOSE anterior
  // se perdeu), encerra a antiga como "expirado" (não conta no laudo) antes de
  // inserir a nova. Rede de segurança caso o EA também tenha perdido o fechamento.
  // OBS: "expirado" é o único status de descarte aceito pela constraint do banco.
  try {
    await sb.from("signals")
      .update({ status: "expirado", closed_at: new Date().toISOString() })
      .eq("asset", asset).eq("tf", tf).eq("status", "aberto");
  } catch { /* não bloqueia a abertura */ }

  const row = { asset, dir, tf, entry, sl, tp, status: "aberto" };
  if (signalId) row.signal_id = signalId;
  const { data, error } = await sb.from("signals").insert(row).select().single();
  if (error) return serverError(res, "Falha ao gravar sinal", error);

  let push = { sent: 0 };
  try { push = await notifyEligibleUsers(data); }
  catch (e) { console.error("[api] push:", e?.message); push = { sent: 0, error: "falha ao notificar" }; }

  return res.status(201).json({ ok: true, event, signal: data, push });
}

/* ── GET: lista sinais para o app ── */
async function getSignals(req, res) {
  if (!hasSupabase) {
    return res.status(503).json({ error: "Supabase não configurado (preencha o .env na Fase 2)." });
  }

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Não autenticado" });

  const sb = serviceClient();

  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  let freeQuota = 4;
  // Janela base para "operações recentes" (histórico consultável): últimos 90 dias…
  let cutoff = new Date(Date.now() - 90 * 86400000);
  try {
    const { data: cfg } = await sb.from("app_settings").select("free_quota, history_start_date").eq("id", 1).maybeSingle();
    if (cfg?.free_quota) freeQuota = cfg.free_quota;
    // …mas o admin pode definir a data em que o histórico "real" começa.
    if (cfg?.history_start_date) {
      const d = new Date(cfg.history_start_date);
      if (d > cutoff) cutoff = d;
    }
  } catch { /* colunas ainda não criadas */ }
  const quota = dailyQuota(profile, freeQuota);

  // Lê os sinais recentes (até 90 dias) e filtra na aplicação pelas preferências.
  const { data: rows, error } = await sb
    .from("signals")
    .select("*")
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error) return serverError(res, "Falha ao ler sinais", error);

  // Anti-travamento: um "aberto" com mais de 12h é resíduo (o CLOSE se perdeu
  // ou o EA reiniciou) — M5/M15 não ficam abertos tanto tempo. Não exibe.
  const STALE_OPEN_MS = 12 * 3600 * 1000;
  const now = Date.now();
  const fresh = (rows || []).filter(
    (s) => !(s.status === "aberto" && now - new Date(s.created_at).getTime() > STALE_OPEN_MS)
  );
  // Quem vê TODOS os timeframes: admin (monitoramento) e ALUNO. Cliente comum
  // (mensal/anual) vê só o que escolheu; free vê variado (sem filtro de tf).
  const admin = isAdmin(user);
  const planEf = effectivePlan(profile);
  const seeAll = admin || planEf === "aluno";
  const byTime = (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  // Feed PERSONALIZADO (Sinais/Dashboard) — respeita o plano do usuário.
  const eligible = fresh.filter((s) => seeAll || isEligible(s, profile)).sort(byTime);

  // LAUDO (Histórico/Desempenho) — track record COMPLETO da ferramenta, igual
  // para todos: todas as operações, sem filtro por ativo/timeframe do usuário.
  const recentAll = (rows || []).filter((s) => s.status !== "aberto").sort(byTime).slice(0, 3000);

  // CORTE DO FREE: passou dos 15 dias de trial sem assinar → encerra os sinais.
  // O laudo (recentAll) continua visível (marketing/prova social); o feed para.
  if (!admin && freeTrialExpired(profile)) {
    return res.status(200).json({
      plan: "free", trial_expired: true, quota: 0, delivered: 0,
      admin: false, seeAll: false, signals: [], recent: [], recentAll,
      plan_expires_at: null,
    });
  }

  // Sinais de HOJE (dia do mercado) → contador "sinais hoje" + cota.
  // Admin não tem teto (vê todas as operações do dia).
  const dayStart = startOfForexDayMs();
  const todayEligible = eligible.filter((s) => new Date(s.created_at).getTime() >= dayStart);
  const signals = admin ? todayEligible : todayEligible.slice(0, quota);

  // Operações recentes personalizadas → tela Sinais e Dashboard.
  const recent = eligible.slice(0, 1000);

  return res.status(200).json({
    plan: planEf,
    plan_expires_at: profile?.plan_expires_at || null,
    quota,
    delivered: signals.length,
    admin,
    seeAll,
    signals,
    recent,
    recentAll,
  });
}
