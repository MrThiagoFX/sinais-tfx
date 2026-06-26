// Garantia da semana (Premium Semanal):
// Para cada assinante "premium" cujo ciclo de 7 dias FECHOU (plan_expires_at já
// passou), soma os pips líquidos do laudo na janela exata dos 7 dias daquele
// usuário [expires-7d, expires]:
//   • NEGATIVO (< 0)  → ganha +7 dias DE GRAÇA (estende, contínuo) — o "brinde".
//   • POSITIVO/zero    → o acesso expira (volta a free) → cliente paga de novo.
// Roda automático (chamado pelo selfcheck diário + endpoint /api/cron/weekly-guarantee).
// Idempotente: brinde joga expires pro futuro; expirado vira free — nenhum é reprocessado.

const WEEK_MS = 7 * 24 * 3600 * 1000;

export async function runWeeklyGuarantee(sb) {
  const nowIso = new Date().toISOString();

  // assinantes premium com a semana já encerrada
  const { data: subs, error } = await sb
    .from("profiles")
    .select("id, plan, plan_expires_at")
    .eq("plan", "premium")
    .not("plan_expires_at", "is", null)
    .lte("plan_expires_at", nowIso);
  if (error) return { ok: false, error: error.message };

  let brindes = 0, expirados = 0;
  for (const p of subs || []) {
    const expMs = new Date(p.plan_expires_at).getTime();
    const startIso = new Date(expMs - WEEK_MS).toISOString();
    const endIso = new Date(expMs).toISOString();

    // resultado da ferramenta (laudo) na janela de 7 dias do usuário
    const { data: rows } = await sb
      .from("signals")
      .select("result_pips,status,created_at")
      .in("status", ["ganho", "perda"])
      .gte("created_at", startIso)
      .lte("created_at", endIso);
    const net = (rows || []).reduce((a, r) => a + (Number(r.result_pips) || 0), 0);

    if (net < 0) {
      // brinde: estende +7 dias a partir do fim do ciclo (sem corte)
      const newExp = new Date(expMs + WEEK_MS).toISOString();
      await sb.from("profiles").update({ plan_expires_at: newExp }).eq("id", p.id);
      brindes++;
    } else {
      // semana positiva/neutra: acesso encerra → cliente paga de novo
      await sb.from("profiles").update({ plan: "free", plan_expires_at: null }).eq("id", p.id);
      expirados++;
    }
  }
  return { ok: true, processados: (subs || []).length, brindes, expirados };
}
