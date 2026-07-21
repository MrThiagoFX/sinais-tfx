// Regras de negócio centralizadas (espelham o CLAUDE.md e o App.jsx).
// Reutilizadas por signals.js (filtro/cota/elegibilidade) e stats.js.

// Todos os ativos que o banco reconhece (constraint + histórico/laudo).
// ATIVO hoje: somente XAUUSD (M15/M30). BTCUSD, US30 e NAS100 estão PAUSADOS —
// continuam no breakdown/laudo como BASE de comparação, mas não geram sinal novo
// nem são selecionáveis no app (frontend ASSETS = [XAUUSD]).
export const ASSETS = ["XAUUSD", "BTCUSD", "US30", "NAS100"];

// Ativos PAUSADOS: o histórico fica (base de comparação), mas ABERTURA nova é
// recusada na ingestão. BTCUSD pausado em 2026-07-11 — rodar XAU e BTC juntos
// (ambos agressivos) diluía a performance; agora mede-se o XAU isolado.
// Para reativar um ativo, basta tirá-lo desta lista (e repor no ASSETS do App.jsx).
export const PAUSED_ASSETS = ["BTCUSD", "US30", "NAS100"];
export function isAssetPaused(asset) {
  return PAUSED_ASSETS.includes(asset);
}

// M5, M15 e M30 (XAU foca M15/M30; demais M5/M15).
export const TFS = ["M5", "M15", "M30"];
export const DIRS = ["Compra", "Venda"];

// Planos "estilo anual" (dia todo / acesso total): premium semanal, anual e
// categorias internas aluno/influencer.
export function isAnualLike(plan) {
  return plan === "premium" || plan === "anual" || plan === "aluno" || plan === "influencer";
}

// Plano EFETIVO: se a validade (plan_expires_at) já passou, o usuário cai
// automaticamente no Free — não pagou/renovou, perde o acesso premium.
export function effectivePlan(profile) {
  if (!profile) return "free";
  const exp = profile.plan_expires_at;
  if (exp && new Date(exp).getTime() < Date.now()) return "free";
  return profile.plan || "free";
}

// Período grátis: o Free é um TRIAL de 15 dias a partir do cadastro
// (profiles.created_at). Depois disso, sem assinar, o acesso aos sinais encerra.
export const FREE_TRIAL_DAYS = 15;
export function trialEndsMs(profile) {
  if (!profile?.created_at) return Infinity; // sem data → não bloqueia (segurança)
  return new Date(profile.created_at).getTime() + FREE_TRIAL_DAYS * 86400000;
}
// Free cujo trial de 15 dias já acabou (não vale para premium/aluno/etc).
export function freeTrialExpired(profile) {
  return effectivePlan(profile) === "free" && Date.now() > trialEndsMs(profile);
}

// Tamanho do "pip"/ponto por ativo, para calcular result_pips no fechamento.
export const PIP_SIZE = { EURUSD: 0.0001, GBPUSD: 0.0001, XAUUSD: 0.1, NAS100: 1, US30: 1, BTCUSD: 1 };

// Normaliza o símbolo do MT4 (ex.: "XAUUSD.m", "USTEC", "DJ30") para um dos 5 ativos.
export function normalizeAsset(symbol) {
  if (!symbol) return null;
  const s = String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const a of ASSETS) if (s.startsWith(a)) return a;
  if (s.startsWith("BTC") || s.startsWith("XBT")) return "BTCUSD";
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

// ─── FIM DE SEMANA (mercado fechado) ───
// O Forex fecha sexta à noite e só reabre no fim de domingo. O BTC negocia 24/7,
// então é o único que geraria sinal no sábado/domingo — e esses NÃO valem: não
// entram no feed nem no laudo. Regra em UTC (= "GMT"): sábado e domingo inteiros
// são bloqueados; o próximo sinal só volta na SEGUNDA 00:00 UTC — que é a
// "meia-noite de domingo GMT" (o instante que encerra o domingo). Sexta à noite
// é, portanto, o último sinal da semana.
export function isMarketClosed(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getUTCDay(); // 0=domingo, 6=sábado
  return day === 6 || day === 0;
}

// Início do "dia" do mercado, em epoch ms. O mercado Forex vira o dia à
// MEIA-NOITE UTC, que é 21:00 de Brasília — é nesse horário que o indicador
// zera e reinicia. Por isso o "Hoje" e o boletim diário usam esse corte
// (21:00 BRT), e não a meia-noite civil de Brasília.
export function startOfForexDayMs() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0); // 00:00 UTC = 21:00 BRT
  return d.getTime();
}

// ─── SINCRONIZAÇÃO COM CALENDÁRIO (Brasília) ───
// Semana Forex: segunda a sexta (mercado aberto). Usa Brasília como zona.

// Retorna timestamp (ms) da segunda-feira de ESTA semana às 00:00 BRT.
export function startOfWeekMs() {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const day = brt.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const diff = day === 0 ? -2 : (day === 1 ? 0 : 1 - day); // volta à seg anterior
  const seg = new Date(brt);
  seg.setDate(seg.getDate() + diff);
  seg.setHours(0, 0, 0, 0);
  return seg.getTime();
}

// Retorna timestamp (ms) da sexta-feira de ESTA semana às 23:59:59 BRT.
export function endOfWeekMs() {
  const seg = new Date(startOfWeekMs());
  const sex = new Date(seg);
  sex.setDate(sex.getDate() + 4); // 4 dias depois = sexta
  sex.setHours(23, 59, 59, 999);
  return sex.getTime();
}

// Retorna timestamp (ms) da segunda-feira da SEMANA PASSADA às 00:00 BRT.
export function startOfLastWeekMs() {
  return startOfWeekMs() - 7 * 86400000; // 7 dias antes
}

// Retorna timestamp (ms) da sexta-feira da SEMANA PASSADA às 23:59:59 BRT.
export function endOfLastWeekMs() {
  return endOfWeekMs() - 7 * 86400000; // 7 dias antes
}

// Retorna timestamp (ms) do 1º do mês atual às 00:00 BRT.
export function startOfMonthMs() {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const prim = new Date(brt);
  prim.setDate(1);
  prim.setHours(0, 0, 0, 0);
  return prim.getTime();
}

// Retorna timestamp (ms) do último dia do mês às 23:59:59 BRT.
export function endOfMonthMs() {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const ult = new Date(brt.getFullYear(), brt.getMonth() + 1, 0, 23, 59, 59, 999);
  return ult.getTime();
}

// Retorna {start, end, label} pra UI mostrar "Esta semana (20–24 jun)".
export function getWeekRange() {
  const start = new Date(startOfWeekMs());
  const end = new Date(endOfWeekMs());
  const fmt = (d) => d.getDate().toString().padStart(2, "0");
  const mês = start.getMonth() === end.getMonth()
    ? ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][start.getMonth()]
    : null;
  const label = mês
    ? `Esta semana (${fmt(start)}–${fmt(end)} ${mês})`
    : `Esta semana (${fmt(start)}/${start.getMonth() + 1}–${fmt(end)}/${end.getMonth() + 1})`;
  return { start: startOfWeekMs(), end: endOfWeekMs(), label };
}

// Cota diária de sinais: Free = configurável pelo admin (2 a 4) · Premium = 20.
// Usa o plano EFETIVO (vencido = Free).
export function dailyQuota(profile, freeQuota = 4) {
  if (effectivePlan(profile) === "free") {
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
  const plan = effectivePlan(profile);
  if (isAnualLike(plan) && profile.schedule_all_day) return true;
  const h = hourInBrasilia(date);
  if (plan === "free") return h >= FREE_WINDOW.start && h < FREE_WINDOW.end;
  const start = hourOf(profile.schedule_start || "08:00");
  const end = hourOf(profile.schedule_end || "18:00");
  return h >= start && h < end;
}

// Um sinal é elegível para este usuário? (usa o plano EFETIVO — vencido = free)
//   free   → qualquer ativo/tf (a seleção é ignorada; o teto de 4/dia limita)
//   premium→ asset ∈ profile.assets E tf ∈ profile.tf_per_asset[asset]
// Em ambos os casos respeita a janela de horário (sobre created_at do sinal).
export function isEligible(signal, profile) {
  const created = new Date(signal.created_at || Date.now());
  if (!inWindow(created, profile)) return false;
  if (effectivePlan(profile) === "free") return true;
  const assets = profile.assets || [];
  const tfMap = profile.tf_per_asset || {};
  if (!assets.includes(signal.asset)) return false;
  return (tfMap[signal.asset] || []).includes(signal.tf);
}
