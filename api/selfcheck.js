// GET /api/selfcheck — verificação de integridade AUTÔNOMA do laudo.
// Recomputa o stats_daily a partir dos signals fechados, compara com o que
// está gravado e, se houver divergência, RECONSTRÓI sozinho (resync). Também
// reporta operações "presas" (aberto > 12h). Roda por cron (diário) e o admin
// pode chamar na hora pelo painel.
//
// Auth: cron do Vercel (x-vercel-cron) · CRON_SECRET · ?key=MT4_TOKEN · admin logado.
import { serviceClient, getUser, hasSupabase, isAdmin } from "./_lib/supabase.js";

function autorizado(req, user) {
  if (req.headers["x-vercel-cron"]) return true;
  const auth = req.headers["authorization"] || "";
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.query?.key && req.query.key === process.env.MT4_TOKEN) return true;
  return !!(user && isAdmin(user));
}

const dayUTC = (iso) => new Date(iso).toISOString().slice(0, 10);

export default async function handler(req, res) {
  if (!hasSupabase) return res.status(503).json({ error: "Supabase não configurado" });

  const user = await getUser(req);
  if (!autorizado(req, user)) return res.status(401).json({ error: "não autorizado" });

  const sb = serviceClient();

  // 1) ESPERADO: agrega os signals fechados por (ativo, tf, dia UTC).
  const { data: closed } = await sb
    .from("signals").select("asset,tf,status,result_pips,created_at")
    .in("status", ["ganho", "perda"]).limit(50000);
  const esperado = {};
  for (const s of closed || []) {
    const k = `${s.asset}|${s.tf}|${dayUTC(s.created_at)}`;
    const b = esperado[k] || (esperado[k] = { asset: s.asset, tf: s.tf, day: dayUTC(s.created_at), ganhos: 0, perdas: 0, pips: 0 });
    if (s.status === "ganho") b.ganhos++; else b.perdas++;
    b.pips += Number(s.result_pips) || 0;
  }

  // 2) ATUAL: o que está gravado no stats_daily.
  const { data: atual } = await sb.from("stats_daily").select("*").limit(50000);
  const atualMap = {};
  for (const r of atual || []) atualMap[`${r.asset}|${r.tf}|${r.day}`] = r;

  // 3) COMPARA bucket a bucket.
  let divergencias = 0;
  const chaves = new Set([...Object.keys(esperado), ...Object.keys(atualMap)]);
  for (const k of chaves) {
    const e = esperado[k] || { ganhos: 0, perdas: 0, pips: 0 };
    const c = atualMap[k] || { ganhos: 0, perdas: 0, pips: 0 };
    if (e.ganhos !== (c.ganhos || 0) || e.perdas !== (c.perdas || 0)
        || Math.round(Number(e.pips)) !== Math.round(Number(c.pips))) {
      divergencias++;
    }
  }

  // 4) RESYNC automático: se divergiu (ou ?rebuild=1), reconstrói o stats_daily.
  let reconstruido = false;
  const forcar = req.query?.rebuild === "1";
  if (divergencias > 0 || forcar) {
    await sb.from("stats_daily").delete().neq("day", "1900-01-01"); // apaga tudo
    const linhas = Object.values(esperado).map((b) => ({ ...b, pips: Math.round(b.pips) }));
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await sb.from("stats_daily").insert(linhas.slice(i, i + 500));
      if (error) return res.status(500).json({ error: "Falha ao reconstruir", detail: error.message });
    }
    reconstruido = true;
  }

  // 5) Operações presas (aberto > 12h) — sinal de CLOSE perdido.
  const { data: abertos } = await sb.from("signals").select("id,created_at").eq("status", "aberto").limit(2000);
  const agora = Date.now();
  const presas = (abertos || []).filter((o) => agora - new Date(o.created_at).getTime() > 12 * 3600 * 1000).length;

  // 6) AUTO-RESOLVER: operações abertas há +24h são resíduo de CLOSE perdido
  // (ex.: MT4 desconectou/senha venceu) — M5/M15 não rodam 24h. Marca como
  // "cancelado": sai do "aberto" e NÃO entra no laudo (não conta ganho/perda).
  // Rede de segurança p/ o admin não precisar fechar na mão.
  const AUTO_CLOSE_MS = 24 * 3600 * 1000;
  const stale = (abertos || []).filter((o) => agora - new Date(o.created_at).getTime() > AUTO_CLOSE_MS);
  let auto_resolvidas = 0;
  if (stale.length) {
    const ids = stale.map((o) => o.id);
    const { error: e2 } = await sb.from("signals")
      .update({ status: "cancelado", closed_at: new Date().toISOString() }).in("id", ids);
    if (!e2) auto_resolvidas = ids.length;
  }
  // Presas que ainda restam (12h–24h, aguardando o limite de auto-resolução).
  const presas_restantes = Math.max(0, presas - auto_resolvidas);

  const totalPips = Object.values(esperado).reduce((a, b) => a + b.pips, 0);
  return res.status(200).json({
    ok: divergencias === 0 && presas_restantes === 0,
    divergencias,
    reconstruido,
    presas: presas_restantes,
    auto_resolvidas,
    buckets: Object.keys(esperado).length,
    fechados: (closed || []).length,
    laudo_pips: Math.round(totalPips),
    quando: new Date().toISOString(),
  });
}
