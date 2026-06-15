// Regras de negócio centralizadas (espelham o CLAUDE.md e o App.jsx).
// Reutilizadas por signals.js (filtro/cota/elegibilidade) e stats.js.

export const ASSETS = ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"];
// M5/M15 para todos; M1 é exclusivo dos planos "estilo anual". H1 removido.
export const TFS = ["M1", "M5", "M15"];
export const DIRS = ["Compra", "Venda"];

// Planos "estilo anual" (M1 + dia todo): anual + categorias internas aluno/influencer.
export function isAnualLike(plan) {
  return plan === "anual" || plan === "aluno" || plan === "influencer";
}

// Tamanho do "pip"/ponto por ativo, para calcular result_pips no fechamento.
export const PIP_SIZE = { EURUSD: 0.0001, GBPUSD: 0.0001, XAUUSD: 0.1, NAS100: 1, US30: 1 };

// Normaliza o símbolo do MT4 (ex.: "XAUUSD.m", "USTEC", "DJ30") para um dos 5 ativos.
export function normalizeAsset(symbol) {
  if (!symbol) return null;
  const s = String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const a of ASSETS) if (s.startsWith(a)) return a;
  if (s.startsWith("US100") || s.startsWith("NDX") || s.startsWith("USTEC") || s.startsWith("NAS")) return "NAS100";
  if (s.startsWith("DJ") || s.startsWith("US30") || s.startsWith("DOW") || s.startsWith("WS30")) return "US30";
  if (s.startsWith("GOLD") || s.startsWith("XAU")) return "XAUUSD";
  return null;
}

// Só M1/M5/M15 são suportados; outros timeframes do EA são ignorados.
export function normalizeTf(tf) {
  const t = String(tf || "").toUpperCase();
  return TFS.includes(t) ? t : null;
}

// BUY/Compra → "Compra"; SELL/Venda → "Venda".
export function normalizeDir(dir) {
  const d = String(dir || "").toUpperCase();
  if (d === "BUY" || d === "COMPRA") return "Compra";
  if (d === "SELL" || d === "VENDA") return "Venda";
  return null;
}

// Resultado em pips/pontos a partir de entrada e saída.
export function computePips(asset, dir, entry, exit) {
  const pip = PIP_SIZE[asset] || 1;
  const raw = (exit - entry) / pip;
  return Math.round((dir === "Compra" ? raw : -raw));
}

// Cota diária de sinais: Free = configurável pelo admin (2 a 4) · Premium = 20.
export function dailyQuota(profile, freeQuota = 4) {
  if (!profile || profile.plan === "free") {
    const q = parseInt(freeQuota, 10);
    return (q >= 2 && q <= 4) ? q : 4;
  }
  return 20;
}

// Hora (0-23) extraída de "HH:MM".
function hourOf(hhmm) {
  return parseInt(String(hhmm || "0").slice(0, 2), 10) || 0;
}

// Hora (0-23) do instante no fuso de Brasília (UTC-3, sem horário de verão
// desde 2019). A Vercel roda em UTC, então não dá pra usar date.getHours()
// direto — as janelas/slots do usuário são em horário de Brasília.
export function hourInBrasilia(date) {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false,
  });
  return parseInt(f.format(date), 10) % 24;
}

// Plano Free tem janela FIXA (não personalizável) — espelha FREE_SCHEDULE do front.
export const FREE_WINDOW = { start: 8, end: 18 };

// O instante `date` está dentro da janela de horário do usuário?
// Free → janela fixa. Anual com schedule_all_day = true → 24h. Demais → janela escolhida.
export function inWindow(date, profile) {
  if (!profile) return true;
  if (isAnualLike(profile.plan) && profile.schedule_all_day) return true;
  const h = hourInBrasilia(date);
  if (profile.plan === "free") return h >= FREE_WINDOW.start && h < FREE_WINDOW.end;
  const start = hourOf(profile.schedule_start || "08:00");
  const end = hourOf(profile.schedule_end || "18:00");
  return h >= start && h < end;
}

// Um sinal é elegível para este usuário?
//   free   → qualquer ativo/tf (a seleção é ignorada; o teto de 4/dia limita)
//   premium→ asset ∈ profile.assets E tf ∈ profile.tf_per_asset[asset]
// Em ambos os casos respeita a janela de horário (sobre created_at do sinal).
export function isEligible(signal, profile) {
  // M1 é exclusivo dos planos "estilo anual".
  if (signal.tf === "M1" && !isAnualLike(profile?.plan)) return false;
  const created = new Date(signal.created_at || Date.now());
  if (!inWindow(created, profile)) return false;
  if (!profile || profile.plan === "free") return true;
  const assets = profile.assets || [];
  const tfMap = profile.tf_per_asset || {};
  if (!assets.includes(signal.asset)) return false;
  return (tfMap[signal.asset] || []).includes(signal.tf);
}
