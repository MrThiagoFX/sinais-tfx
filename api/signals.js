// /api/signals
// POST → MT4 envia sinal (header x-mt4-token). GET → app lista sinais do usuário.
import { ASSETS, TFS, DIRS, isEligible, dailyQuota } from "./_lib/business.js";
import { serviceClient, getUser, hasSupabase } from "./_lib/supabase.js";
import { notifyEligibleUsers } from "./_lib/push.js";

export default async function handler(req, res) {
  if (req.method === "POST") return postSignal(req, res);
  if (req.method === "GET") return getSignals(req, res);
  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não permitido" });
}

/* ── POST: recebe sinal do MT4 ── */
async function postSignal(req, res) {
  // Autenticação simples por token compartilhado com o EA
  if (!process.env.MT4_TOKEN || req.headers["x-mt4-token"] !== process.env.MT4_TOKEN) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { asset, dir, tf, entry, sl, tp } = req.body || {};

  // Validação estrita das regras de negócio (ver CLAUDE.md)
  if (!ASSETS.includes(asset)) return res.status(400).json({ error: "asset inválido", aceitos: ASSETS });
  if (!DIRS.includes(dir))     return res.status(400).json({ error: "dir inválido", aceitos: DIRS });
  if (!TFS.includes(tf))       return res.status(400).json({ error: "tf inválido", aceitos: TFS });
  for (const [k, v] of Object.entries({ entry, sl, tp })) {
    if (typeof v !== "number" || !isFinite(v)) {
      return res.status(400).json({ error: `${k} deve ser numérico` });
    }
  }

  if (!hasSupabase) {
    return res.status(503).json({ error: "Supabase não configurado (preencha o .env na Fase 2)." });
  }

  const sb = serviceClient();
  const { data, error } = await sb
    .from("signals")
    .insert({ asset, dir, tf, entry, sl, tp })
    .select()
    .single();
  if (error) return res.status(500).json({ error: "Falha ao gravar sinal", detail: error.message });

  // Fase 4: dispara push para usuários elegíveis (não bloqueia a resposta ao MT4).
  let push = { sent: 0 };
  try {
    push = await notifyEligibleUsers(data);
  } catch (e) {
    push = { sent: 0, error: e.message };
  }

  return res.status(201).json({ ok: true, signal: data, push });
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
  const quota = dailyQuota(profile);

  // Busca os sinais do dia e filtra na aplicação pelas preferências do usuário.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: rows, error } = await sb
    .from("signals")
    .select("*")
    .gte("created_at", startOfDay.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: "Falha ao ler sinais", detail: error.message });

  const eligible = (rows || []).filter((s) => isEligible(s, profile));
  const signals = eligible.slice(0, quota);

  return res.status(200).json({
    plan: profile?.plan || "free",
    quota,
    delivered: signals.length,
    signals,
  });
}
