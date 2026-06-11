// Regras de negócio centralizadas (espelham o CLAUDE.md e o App.jsx).
// Reutilizadas por signals.js (filtro/cota/elegibilidade) e stats.js.

export const ASSETS = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];
export const TFS = ["M5", "M15", "H1"];
export const DIRS = ["Compra", "Venda"];

// Cota diária de sinais (igual a dailyQuota() do App.jsx):
//   free = 4 · premium = min(20, Σ por ativo (4 × qtde de timeframes do ativo))
export function dailyQuota(profile) {
  if (!profile || profile.plan === "free") return 4;
  const assets = profile.assets || [];
  const tfMap = profile.tf_per_asset || {};
  const sum = assets.reduce((acc, a) => acc + 4 * ((tfMap[a] || []).length || 1), 0);
  return Math.min(20, sum);
}

// Hora (0-23) extraída de "HH:MM".
function hourOf(hhmm) {
  return parseInt(String(hhmm || "0").slice(0, 2), 10) || 0;
}

// O instante `date` está dentro da janela de horário do usuário?
// Anual com schedule_all_day = true recebe 24h.
export function inWindow(date, profile) {
  if (!profile) return true;
  if (profile.plan === "anual" && profile.schedule_all_day) return true;
  const h = date.getHours();
  const start = hourOf(profile.schedule_start || "08:00");
  const end = hourOf(profile.schedule_end || "18:00");
  return h >= start && h < end;
}

// Um sinal é elegível para este usuário?
//   free   → qualquer ativo/tf (a seleção é ignorada; o teto de 4/dia limita)
//   premium→ asset ∈ profile.assets E tf ∈ profile.tf_per_asset[asset]
// Em ambos os casos respeita a janela de horário (sobre created_at do sinal).
export function isEligible(signal, profile) {
  const created = new Date(signal.created_at || Date.now());
  if (!inWindow(created, profile)) return false;
  if (!profile || profile.plan === "free") return true;
  const assets = profile.assets || [];
  const tfMap = profile.tf_per_asset || {};
  if (!assets.includes(signal.asset)) return false;
  return (tfMap[signal.asset] || []).includes(signal.tf);
}
