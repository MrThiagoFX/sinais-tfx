import { useState, useCallback, useEffect } from "react";
import * as api from "./lib/api.js";
import { hasSupabase } from "./lib/supabase.js";

/* ════════════════════════════════════════════════════════════
   INFINITY SIGNALS · v4.1 — Vercel/PWA ready
   • Scroll suave com barra fina em todas as telas
   • Navegação inferior presente também no Detalhe do Sinal
   • Responsivo: celular = app em tela cheia · desktop = frame + painel dev
════════════════════════════════════════════════════════════ */

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";

const THEMES = {
  dark: {
    id: "dark",
    bg0: "#05070A", bg1: "#0B0F14", bg2: "#121820",
    card: "#151C24", card2: "#1A2230",
    bdr: "#2A313A", bdrMid: "#3A4450",
    accent: "#C6FF00", accentSoft: "#C6FF0018", accentBdr: "#C6FF0040",
    activeText: "#2F3741",
    blue: "#7DDCFF",
    text: "#FFFFFF", sub: "#A8B5C4", muted: "#6B7A8D", dim: "#384250",
    buy: "#7CFF6B", sell: "#FF5A5F", warn: "#FFD84D",
  },
  light: {
    id: "light",
    bg0: "#F4F8FC", bg1: "#FFFFFF", bg2: "#E8F0F8",
    card: "#FFFFFF", card2: "#F0F6FC",
    bdr: "#D5E2EE", bdrMid: "#B8CCDE",
    accent: "#2196D9", accentSoft: "#2196D915", accentBdr: "#2196D940",
    activeText: "#FFFFFF",
    blue: "#1976B8",
    text: "#1A2B3C", sub: "#4A6075", muted: "#7A91A6", dim: "#A8BDD0",
    buy: "#1FA855", sell: "#E03E43", warn: "#C98A00",
  },
};

/* CSS global: scroll fino + reset */
const GlobalStyle = ({ t }) => (
  <style>{`
    /* Tela cheia no iOS standalone: documento em FLUXO com 100dvh (não usar
       position:fixed no root — tira o documento do fluxo e o iOS pinta as áreas
       de status bar / home-indicator com o preto dele = faixas). */
    html, body, #root { height: var(--screen-h, 100%); min-height: var(--screen-h, 100dvh); margin: 0; overflow: hidden; overscroll-behavior: none; }
    /* TUDO na mesma cor (bg0): página, conteúdo e menu. Se todo o app é uma cor
       só, é impossível aparecer "borda" entre o menu e a safe-area — não importa
       como o iOS trate o status bar / home-indicator. (manifest background_color
       também é bg0, então a área de launch/safe-area fica igual.) */
    html, body, #root { background: ${t.bg0}; }
    body { background: ${t.bg0}; }
    * { box-sizing: border-box; }

    /* ── Safe area do rodapé do menu (home-indicator) ──
       PWA da tela de início (standalone): usa o inset REAL (≈34px no iPhone),
       então o FUNDO do menu preenche até a borda inferior e os ícones ficam
       acima da barrinha do iPhone — visual de app nativo. No navegador o inset
       é 0 (a barra do Safari ocupa o rodapé) e o menu fica compacto. */
    .nav-safe { padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); }
    .scrollarea {
      overflow-y: auto; overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: ${t.bdrMid} transparent;
      overscroll-behavior: contain;
    }
    .scrollarea::-webkit-scrollbar { width: 4px; }
    .scrollarea::-webkit-scrollbar-track { background: transparent; }
    .scrollarea::-webkit-scrollbar-thumb { background: ${t.bdrMid}; border-radius: 99px; }
    .scrollarea::-webkit-scrollbar-thumb:hover { background: ${t.muted}; }
    select option { background: ${t.card}; color: ${t.text}; }

    /* ── Safe area do topo (notch/status bar) em PWA/WebView ── */
    /* Aba normal de navegador: inset real (0 quando não há notch). */
    .safe-top { padding-top: env(safe-area-inset-top, 0px); }
    /* App instalado/standalone: garante um mínimo mesmo em wrappers que não
       reportam o inset, e usa o inset real quando disponível (iOS/cutout). */
    @media (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui) {
      .safe-top { padding-top: max(env(safe-area-inset-top, 0px), 28px); }
    }

    /* ── Polimento: animações suaves + feedback de toque ── */
    @keyframes screenIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pop { 0% { transform: scale(.96); opacity: .6; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
    .screen-anim { flex: 1; display: flex; flex-direction: column; min-height: 0; animation: screenIn .26s cubic-bezier(.22,.61,.36,1); }
    button { transition: transform .08s ease, filter .15s ease, opacity .15s ease; }
    button:not(:disabled):active { transform: scale(.96); }
    .pcard { transition: transform .12s ease, border-color .2s ease, box-shadow .2s ease; }
    .pcard:active { transform: scale(.987); }
    .live-dot { animation: pulseDot 1.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) { .screen-anim, button, .pcard { animation: none !important; transition: none !important; } }
  `}</style>
);

/* ════════════════════════════════════════════════════════════
   BANDEIRAS SVG — estilo TradingView
════════════════════════════════════════════════════════════ */
const FlagEU = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <defs><clipPath id="cEU"><circle cx="12" cy="12" r="12" /></clipPath></defs>
    <g clipPath="url(#cEU)">
      <rect width="24" height="24" fill="#003399" />
      {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => {
        const r = 7.2, cx = 12 + r * Math.sin(a * Math.PI / 180), cy = 12 - r * Math.cos(a * Math.PI / 180);
        return <circle key={a} cx={cx} cy={cy} r="1.1" fill="#FFCC00" />;
      })}
    </g>
  </svg>
);

const FlagUS = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <defs><clipPath id="cUS"><circle cx="12" cy="12" r="12" /></clipPath></defs>
    <g clipPath="url(#cUS)">
      <rect width="24" height="24" fill="#FFFFFF" />
      {[0,2,4,6,8,10,12].map(i => (
        <rect key={i} y={i * 24 / 13} width="24" height={24 / 13} fill="#B22234" />
      ))}
      <rect width="11" height="9.2" fill="#3C3B6E" />
      {[2,5,8].map(x => [1.5,4,6.5].map(y => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.7" fill="#FFFFFF" />
      )))}
    </g>
  </svg>
);

const FlagGB = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <defs><clipPath id="cGB"><circle cx="12" cy="12" r="12" /></clipPath></defs>
    <g clipPath="url(#cGB)">
      <rect width="24" height="24" fill="#012169" />
      <path d="M0,0 L24,24 M24,0 L0,24" stroke="#FFFFFF" strokeWidth="4.5" />
      <path d="M0,0 L24,24 M24,0 L0,24" stroke="#C8102E" strokeWidth="2" />
      <path d="M12,0 V24 M0,12 H24" stroke="#FFFFFF" strokeWidth="7" />
      <path d="M12,0 V24 M0,12 H24" stroke="#C8102E" strokeWidth="4" />
    </g>
  </svg>
);

const FlagGold = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <defs>
      <radialGradient id="gAuBg" cx="34%" cy="28%">
        <stop offset="0%" stopColor="#574517" /><stop offset="100%" stopColor="#211806" />
      </radialGradient>
      <linearGradient id="gAuBar" x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0%" stopColor="#FFE9A0" /><stop offset="50%" stopColor="#F3C64A" />
        <stop offset="100%" stopColor="#CF9A1E" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="11.5" fill="url(#gAuBg)" stroke="#C8911C" strokeWidth="1" />
    {/* lingote de ouro */}
    <polygon points="5.5,15 18.5,15 16,9.9 8,9.9" fill="url(#gAuBar)"
      stroke="#8a6410" strokeWidth="0.5" strokeLinejoin="round" />
    <polygon points="8,9.9 16,9.9 14.6,8.1 9.4,8.1" fill="#FFEDB0"
      stroke="#8a6410" strokeWidth="0.5" strokeLinejoin="round" />
    <polygon points="7,14.4 9.2,10.5 10.3,10.5 8.1,14.4" fill="#FFFFFF" opacity="0.42" />
  </svg>
);

const IndexBadge = ({ txt, bg, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <circle cx="12" cy="12" r="12" fill={bg} />
    <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="900"
      fill="#FFFFFF" fontFamily={FONT}>{txt}</text>
  </svg>
);

const FlagPair = ({ A, B, size = 38 }) => {
  const s = size * 0.68;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 0, left: 0 }}><A size={s} /></div>
      <div style={{ position: "absolute", bottom: 0, right: 0 }}><B size={s} /></div>
    </div>
  );
};

const AssetIcon = ({ asset, size = 38 }) => {
  switch (asset) {
    case "EURUSD": return <FlagPair A={FlagEU} B={FlagUS} size={size} />;
    case "GBPUSD": return <FlagPair A={FlagGB} B={FlagUS} size={size} />;
    case "XAUUSD": return <FlagPair A={FlagGold} B={FlagUS} size={size} />;
    case "NAS100": return <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><IndexBadge txt="NQ" bg="#0B5CAB" size={size * 0.85} /></div>;
    case "US30":   return <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><IndexBadge txt="DJ" bg="#1B3A6B" size={size * 0.85} /></div>;
    default:       return <div style={{ width: size, height: size }} />;
  }
};

/* ════════════════════════════════════════════════════════════
   ÁTOMOS
════════════════════════════════════════════════════════════ */
const BoltLogo = ({ t, size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <path d="M27 4 L12 27 H22 L19 44 L36 19 H25 L27 4 Z" fill={t.accent}
      stroke={t.id === "dark" ? "#000" : "#FFF"} strokeWidth="1" strokeLinejoin="round" />
  </svg>
);

const ThemeToggle = ({ t, onToggle }) => (
  <button onClick={onToggle} aria-label="Alternar tema" style={{
    width: 38, height: 38, borderRadius: 12, cursor: "pointer",
    background: t.card, border: `1.5px solid ${t.bdr}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 17, lineHeight: 1, flexShrink: 0, padding: 0,
  }}>{t.id === "dark" ? "☀️" : "🌙"}</button>
);

const Label = ({ children, t, color, style = {} }) => (
  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
    textTransform: "uppercase", color: color || t.muted, fontFamily: FONT, ...style }}>{children}</p>
);

const Badge = ({ text, color }) => (
  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 7,
    background: `${color}1C`, color, border: `1px solid ${color}38`,
    whiteSpace: "nowrap", fontFamily: FONT }}>{text}</span>
);

const Bar = ({ pct, color, t, h = 5 }) => (
  <div style={{ background: t.bg2, borderRadius: 99, height: h, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%",
      borderRadius: 99, background: color || t.accent, transition: "width .4s" }} />
  </div>
);

const Chip = ({ label, active, onClick, t, disabled }) => (
  <button onClick={disabled ? undefined : onClick} style={{
    borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", transition: "all .15s", fontFamily: FONT,
    border: `1.5px solid ${active ? t.accent : t.bdr}`,
    background: active ? t.accent : t.card,
    color: active ? t.activeText : (disabled ? t.dim : t.text),
    opacity: disabled ? 0.5 : 1,
  }}>{label}</button>
);

const Btn = ({ children, t, variant = "primary", onClick, disabled, style = {} }) => {
  const v = {
    primary:   { background: t.accent, color: t.activeText, border: "none" },
    secondary: { background: "transparent", border: `1.5px solid ${t.bdr}`, color: t.text },
    danger:    { background: `${t.sell}14`, border: `1.5px solid ${t.sell}38`, color: t.sell },
  }[variant];
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      height: 52, borderRadius: 16, cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 800, fontSize: 15, width: "100%", fontFamily: FONT,
      opacity: disabled ? 0.4 : 1, ...v, ...style,
    }}>{children}</button>
  );
};

const Card = ({ children, t, style = {}, onClick, accent = false }) => (
  <div onClick={onClick} className={onClick ? "pcard" : undefined} style={{
    background: t.card, borderRadius: 18, padding: "16px 18px",
    border: `1px solid ${accent ? t.accentBdr : t.bdr}`,
    position: "relative", overflow: "hidden",
    cursor: onClick ? "pointer" : "default",
    boxShadow: t.id === "light" ? "0 1px 4px rgba(26,43,60,0.06)" : "none",
    ...style,
  }}>{children}</div>
);

const Toggle = ({ on, onChange, t }) => (
  <div onClick={() => onChange(!on)} style={{
    width: 48, height: 26, borderRadius: 99,
    background: on ? t.accent : t.bg2,
    border: `1.5px solid ${on ? t.accent : t.bdr}`,
    cursor: "pointer", position: "relative", flexShrink: 0,
    transition: "background .2s",
  }}>
    <div style={{ position: "absolute", top: 3, left: on ? 24 : 3,
      width: 17, height: 17, borderRadius: "50%",
      background: on ? t.activeText : t.muted, transition: "left .2s" }} />
  </div>
);

const BackBtn = ({ onClick, t }) => (
  <button onClick={onClick} style={{
    background: "none", border: "none", color: t.accent,
    cursor: "pointer", fontSize: 14, fontWeight: 800, padding: 0,
    display: "flex", alignItems: "center", gap: 4, fontFamily: FONT,
  }}>← Voltar</button>
);

const ScreenHeader = ({ title, t, onToggleTheme, right, onBack }) => (
  <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
    {onBack && (
      <div style={{ marginBottom: 10 }}><BackBtn onClick={onBack} t={t} /></div>
    )}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: -0.5,
        color: t.text, fontFamily: FONT }}>{title}</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {right}
        <ThemeToggle t={t} onToggle={onToggleTheme} />
      </div>
    </div>
  </div>
);

const NAV = [
  { id: "home",        label: "Início",     icon: "⌂" },
  { id: "signals",     label: "Sinais",     icon: "◈" },
  { id: "performance", label: "Desempenho", icon: "◉" },
  { id: "history",     label: "Histórico",  icon: "◷" },
  { id: "profile",     label: "Mais",       icon: "≡" },
];

const BottomNav = ({ active, onNav, t }) => (
  <div className="nav-safe" style={{ background: t.bg0, borderTop: `1px solid ${t.bdrMid}`,
    display: "flex", paddingTop: 5, flexShrink: 0 }}>
    {NAV.map(({ id, label, icon }) => (
      <button key={id} onClick={() => onNav(id)} style={{
        flex: 1, background: "none", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 2, padding: "3px 0", fontFamily: FONT,
      }}>
        <span style={{ fontSize: 20, lineHeight: 1, color: active === id ? t.accent : t.muted }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: active === id ? t.accent : t.muted }}>{label}</span>
      </button>
    ))}
  </div>
);

const Scroll = ({ children, style = {} }) => (
  <div className="scrollarea" style={{ flex: 1, minHeight: 0, ...style }}>{children}</div>
);

/* ════════════════════════════════════════════════════════════
   DADOS + REGRAS
════════════════════════════════════════════════════════════ */
const ASSETS = ["XAUUSD", "NAS100", "US30"];
const ASSET_NAMES = {
  XAUUSD: "Ouro / Dólar", NAS100: "Nasdaq 100", US30: "Dow Jones 30",
};
// Planos premium (acesso completo) e planos "estilo anual" (M1 + dia todo).
// aluno e influencer são categorias internas (só o admin cadastra).
const PREMIUM_PLANS = ["mensal", "anual", "aluno", "influencer"];
const ANUAL_LIKE = ["anual", "aluno", "influencer"];
const isPremiumPlan = (p) => PREMIUM_PLANS.includes(p);
const isAnualLikePlan = (p) => ANUAL_LIKE.includes(p);

// Timeframes do produto: apenas M5 e M15 (M1 e H1 removidos).
const TIMEFRAMES = ["M5", "M15"];
const tfOptionsForPlan = () => ["M5", "M15"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const PLAN_INFO = {
  free:       { name: "Free",            price: "Grátis" },
  mensal:     { name: "Premium Mensal",  price: "R$ 99/mês" },
  anual:      { name: "Premium Anual",   price: "R$ 79/mês" },
  aluno:      { name: "Aluno",           price: "Acesso de aluno" },
  influencer: { name: "Influencer",      price: "Parceria" },
};
const PLAN_BADGE = { free: "FREE", mensal: "PREMIUM", anual: "ANUAL", aluno: "ALUNO", influencer: "INFLUENCER" };

// Plano Free tem horário FIXO (não personalizável). Premium escolhe a janela.
const FREE_SCHEDULE = { start: "08:00", end: "18:00", allDay: false };
// Free: 4 sinais por dia (M5/M15 sortidos) em horários fixos.
const FREE_SLOTS = ["04:00", "10:30", "15:00", "21:00"];
// Comissão de indicação: o indicador ganha 30% sobre o que o indicado pagar.
const REFERRAL_RATE = 0.30;

// Cota diária: Free = 4 sinais/dia. Premium (mensal/anual) = até 20 operações/dia.
const dailyQuota = (plan) => (plan === "free" ? 4 : 20);

// Agora é 1 timeframe fixo por ativo (o cliente escolhe o melhor pelo histórico).
const maxTfPerAsset = () => 1;
const ALL_TFS = ["M5", "M15"];
// Remove timeframes inválidos (ex.: H1 antigo) e mantém só 1 por ativo.
const sanitizeTfPerAsset = (cfg) => {
  const out = {};
  for (const a of Object.keys(cfg || {})) {
    const valid = (cfg[a] || []).filter((tf) => ALL_TFS.includes(tf));
    out[a] = valid.length ? [valid[0]] : ["M5"];
  }
  return out;
};

const SIGNALS_DATA = [
  { id: 1, asset: "XAUUSD", dir: "Compra", tf: "M5",  time: "14:32", hour: 14, ageMin: 3,   status: "aberto", rr: "3:1", entry: "2.365,40", sl: "2.360,00", tp: "2.373,00", est: "+76 pips", perf: 82 },
  { id: 2, asset: "EURUSD", dir: "Venda",  tf: "M15", time: "13:15", hour: 13, ageMin: 78,  status: "ganho",  rr: "2:1", resultPips: 32,  entry: "1,0842",   sl: "1,0858",   tp: "1,0810",   est: "+32 pips", perf: 64 },
  { id: 3, asset: "NAS100", dir: "Compra", tf: "M15", time: "12:00", hour: 12, ageMin: 140, status: "ganho",  rr: "2.3:1", resultPips: 90, entry: "18.420",   sl: "18.380",   tp: "18.510",   est: "+90 pts",  perf: 77 },
  { id: 4, asset: "GBPUSD", dir: "Venda",  tf: "M15", time: "11:45", hour: 11, ageMin: 200, status: "perda",  rr: "2:1", resultPips: -18, entry: "1,2710",   sl: "1,2728",   tp: "1,2675",   est: "+35 pips", perf: 55 },
  { id: 5, asset: "US30",   dir: "Compra", tf: "M15", time: "10:10", hour: 10, ageMin: 320, status: "ganho",  rr: "2.2:1", resultPips: 130, entry: "39.180",   sl: "39.120",   tp: "39.310",   est: "+130 pts", perf: 70 },
  { id: 6, asset: "XAUUSD", dir: "Venda",  tf: "M15", time: "07:40", hour: 7,  ageMin: 420, status: "perda",  rr: "2:1", resultPips: -50, entry: "2.358,00", sl: "2.363,00", tp: "2.349,00", est: "+90 pips", perf: 68 },
];

const HISTORY_DATA = [
  { asset: "XAUUSD", dir: "Compra", tf: "M5",  time: "14:32", hour: 14, pips: 80  },
  { asset: "EURUSD", dir: "Venda",  tf: "M15", time: "11:15", hour: 11, pips: -25 },
  { asset: "NAS100", dir: "Compra", tf: "M15",  time: "09:00", hour: 9,  pips: 55  },
  { asset: "US30",   dir: "Compra", tf: "M15",  time: "Ontem 16:20", hour: 16, pips: 120 },
  { asset: "GBPUSD", dir: "Venda",  tf: "M15", time: "Ontem 10:05", hour: 10, pips: -18 },
  { asset: "XAUUSD", dir: "Compra", tf: "M5",  time: "Seg 06:30",   hour: 6,  pips: 40  },
  { asset: "EURUSD", dir: "Compra", tf: "M15", time: "Seg 12:10",   hour: 12, pips: 28  },
  { asset: "NAS100", dir: "Venda",  tf: "M15",  time: "Sex 19:45",   hour: 19, pips: -32 },
  { asset: "US30",   dir: "Compra", tf: "M15",  time: "Sex 15:00",   hour: 15, pips: 65  },
];

// Converte um sinal vindo do /api (números crus + created_at) para o formato
// de exibição usado pelas telas (mesmo shape de SIGNALS_DATA).
const rrText = (entry, sl, tp) => {
  const risk = Math.abs(entry - sl), reward = Math.abs(tp - entry);
  if (!risk) return "—";
  const r = reward / risk;
  return `${(Math.round(r * 10) / 10).toString().replace(".0", "")}:1`;
};

// Formatadores fixos no fuso de Brasília (GMT-3) — independem do fuso do aparelho.
const BRT_TIME = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
const BRT_DDMM = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const BRT_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
// Início do "dia" do mercado (epoch ms) — meia-noite UTC = 21:00 de Brasília,
// quando o Forex/indicador vira o dia. É o corte do "Hoje".
const forexDayStartMs = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0); // 00:00 UTC = 21:00 BRT
  return d.getTime();
};

// Mercado Forex: abre domingo às ~18h (Brasília) e fecha sexta às ~18h. Logo,
// está FECHADO (fim de semana): sábado inteiro, sexta após 18h e domingo antes
// das 18h. (Ajuste FOREX_OPEN_BRT se o seu horário de abertura for outro.)
const FOREX_OPEN_BRT = 18;
const forexClosed = () => {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const d = brt.getDay(); // 0=domingo ... 6=sábado
  const h = brt.getHours();
  if (d === 6) return true;                         // sábado: fechado o dia todo
  if (d === 5 && h >= FOREX_OPEN_BRT) return true;  // sexta, após o fechamento
  if (d === 0 && h < FOREX_OPEN_BRT) return true;   // domingo, antes da abertura
  return false;
};

const mapSignal = (s) => {
  // Horário SEMPRE em Brasília (GMT-3), a partir do created_at (UTC real do
  // servidor). Não usamos o signal_id porque vem no fuso do broker.
  const d = new Date(s.created_at || Date.now());
  const hhmm = BRT_TIME.format(d);
  // Rótulo com DIA + horário: "Hoje 14:32" · "Ontem 16:10" · "12/06 16:10".
  const dDay = BRT_DAY.format(d);
  const todayDay = BRT_DAY.format(new Date());
  const yestDay = BRT_DAY.format(new Date(Date.now() - 86400000));
  const dateLbl = dDay === todayDay ? "Hoje" : dDay === yestDay ? "Ontem" : BRT_DDMM.format(d);
  return {
    id: s.id, signalId: s.signal_id, asset: s.asset, dir: s.dir, tf: s.tf,
    time: `${dateLbl} ${hhmm}`, hhmm, hour: Number(hhmm.slice(0, 2)),
    ts: d.getTime(),
    closedTs: s.closed_at ? new Date(s.closed_at).getTime() : null,
    ageMin: Math.round((Date.now() - d.getTime()) / 60000),
    status: s.status || "aberto",
    resultPips: s.result_pips,
    rr: rrText(Number(s.entry), Number(s.sl), Number(s.tp)),
    entry: String(s.entry), sl: String(s.sl), tp: String(s.tp),
    est: s.result_pips != null ? `${s.result_pips >= 0 ? "+" : ""}${s.result_pips} pips` : "—",
    perf: 70,
  };
};

// Ordem lógica da lista de sinais:
//  1) EM ANDAMENTO (aberto) no topo — por criação, mais novos primeiro;
//  2) FECHADOS abaixo — por data de ENCERRAMENTO desc (os que fecharam por
//     último em cima), com a criação desc como desempate.
const sortSignals = (a, b) => {
  const aOpen = a.status === "aberto", bOpen = b.status === "aberto";
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  if (aOpen) return (b.ts || 0) - (a.ts || 0);
  return (b.closedTs || b.ts || 0) - (a.closedTs || a.ts || 0) || (b.ts || 0) - (a.ts || 0);
};

// Card de sinal do Dashboard: mostra "em andamento" (com painel), ✓ ganho ou ✗ perda.
const DashSignalCard = ({ s, t, onClick, fav, onToggleFav }) => {
  const buy = s.dir === "Compra";
  const ac = buy ? t.buy : t.sell;
  const open = s.status === "aberto" || s.status == null;
  const win = s.status === "ganho";
  const resColor = win ? t.buy : t.sell;
  const pips = s.resultPips;
  return (
    <Card t={t} onClick={onClick} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AssetIcon asset={s.asset} size={36} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text, fontFamily: FONT }}>{s.asset}</div>
            <div style={{ fontSize: 11, color: t.sub, marginTop: 1, fontFamily: FONT }}>{s.time} · {s.tf}</div>
          </div>
        </div>
        {open ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onToggleFav && (
              <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }} title="Avisar quando fechar"
                aria-label="Favoritar para alerta de fechamento" style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1,
                  fontSize: 20, color: fav ? t.accent : t.muted }}>{fav ? "★" : "☆"}</button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${t.warn}1A`,
              border: `1px solid ${t.warn}40`, borderRadius: 8, padding: "4px 9px" }}>
              <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: t.warn }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: t.warn, fontFamily: FONT }}>Em andamento</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 900, fontSize: 15, color: resColor, fontFamily: FONT }}>
              {pips != null ? `${pips >= 0 ? "+" : ""}${pips}` : ""} {win ? "✓" : "✗"}
            </span>
          </div>
        )}
      </div>
      {open ? (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            {[["Entrada", s.entry, t.text], ["Alvo", s.tp, t.buy], ["Stop", s.sl, t.sell]].map(([lbl, v, c]) => (
              <div key={lbl} style={{ flex: 1, background: t.bg2, border: `1px solid ${t.bdr}`,
                borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: t.muted, fontFamily: FONT }}>{lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: c, fontFamily: FONT, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: t.muted, margin: "8px 2px 0", lineHeight: 1.45, fontFamily: FONT }}>
            ⏳ Operação rodando — aguardando bater <span style={{ color: t.buy, fontWeight: 700 }}>TP</span> ou <span style={{ color: t.sell, fontWeight: 700 }}>SL</span>. O próximo sinal só abre quando esta fechar.
          </p>
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: t.sub, fontFamily: FONT }}>
            <Badge text={s.dir} color={ac} /> <span style={{ marginLeft: 6 }}>R:R {s.rr}</span>
          </span>
          <span style={{ fontSize: 12, color: t.sub, fontFamily: FONT }}>
            {s.entry} → {win ? s.tp : s.sl}
          </span>
        </div>
      )}
    </Card>
  );
};

// Janela em que o sinal ainda pode ser copiado/entrado (minutos).
const COPY_WINDOW_MIN = 10;

const SignalRow = ({ s, t, onClick, pips, fav, onToggleFav }) => {
  const buy = s.dir === "Compra";
  const ac = buy ? t.buy : t.sell;
  return (
    <Card t={t} onClick={onClick} style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: pips !== undefined ? 10 : 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <AssetIcon asset={s.asset} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: t.text, fontFamily: FONT }}>{s.asset}</div>
            <div style={{ fontSize: 12, color: t.sub, marginTop: 2, fontFamily: FONT }}>
              {s.time} · <span style={{ color: t.blue, fontWeight: 700 }}>{s.tf}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Badge text={s.tf} color={t.blue} />
          <Badge text={s.dir} color={ac} />
        </div>
      </div>
      {pips !== undefined ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: t.sub, fontFamily: FONT }}>Resultado</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: pips >= 0 ? t.buy : t.sell, fontFamily: FONT }}>
            {pips >= 0 ? "+" : ""}{pips} pips · {pips >= 0 ? "✓" : "✗"}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: t.warn }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: t.warn, fontFamily: FONT }}>Em andamento</span>
          </div>
          {onToggleFav ? (
            <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
              aria-label="Avisar quando fechar" style={{
                background: fav ? t.accentSoft : "transparent", cursor: "pointer",
                border: `1px solid ${fav ? t.accent : t.bdr}`, borderRadius: 8, padding: "4px 9px",
                display: "flex", alignItems: "center", gap: 5, fontFamily: FONT }}>
              <span style={{ fontSize: 14, lineHeight: 1, color: fav ? t.accent : t.muted }}>{fav ? "★" : "☆"}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: fav ? t.accent : t.sub }}>
                {fav ? "avisando" : "avisar ao fechar"}
              </span>
            </button>
          ) : (
            <span style={{ fontSize: 11.5, color: t.muted, fontFamily: FONT }}>aguardando TP/SL</span>
          )}
        </div>
      )}
    </Card>
  );
};

const HourSelect = ({ value, onChange, t }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{
    background: t.card, color: t.text, border: `1.5px solid ${t.bdr}`,
    borderRadius: 12, padding: "10px 12px", fontSize: 14, fontWeight: 700,
    fontFamily: FONT, cursor: "pointer", outline: "none", width: "100%",
  }}>
    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
  </select>
);

/* ════════════════════════════════════════════════════════════
   TELAS
════════════════════════════════════════════════════════════ */

const Splash = ({ t, onNext, onToggleTheme }) => (
  <div onClick={onNext} style={{ flex: 1, background: t.bg0, display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    position: "relative", cursor: "pointer", minHeight: 0 }}>
    <div style={{ position: "absolute", top: 14, right: 18 }} onClick={e => e.stopPropagation()}>
      <ThemeToggle t={t} onToggle={onToggleTheme} />
    </div>
    <svg style={{ position: "absolute", bottom: 48, opacity: t.id === "dark" ? 0.06 : 0.1 }}
      width="380" height="180" viewBox="0 0 380 180">
      {[28,70,112,154,196,238,280,322].map((x,i)=>{
        const h=[50,95,42,72,115,52,84,68][i], up=[1,0,1,1,0,1,0,1][i];
        const col=up?t.buy:t.sell;
        return <g key={x}>
          <rect x={x-1} y={90-h/2-18} width={2} height={h+36} fill={col}/>
          <rect x={x-11} y={90-h/2} width={22} height={h} fill={col} rx={3}/>
        </g>;
      })}
    </svg>
    <div style={{ textAlign: "center", zIndex: 1 }}>
      <div style={{ width: 88, height: 88, borderRadius: 28, margin: "0 auto 22px",
        background: t.accentSoft, border: `2px solid ${t.accentBdr}`,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BoltLogo t={t} size={52} />
      </div>
      <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.5, color: t.text,
        marginBottom: 8, fontFamily: FONT }}>
        Infinity <span style={{ color: t.accent }}>Signals</span>
      </div>
      <div style={{ fontSize: 12, color: t.muted, letterSpacing: 3, fontWeight: 700, fontFamily: FONT }}>
        SINAIS INTELIGENTES
      </div>
    </div>
    <div style={{ position: "absolute", bottom: 28, fontSize: 11, color: t.dim,
      letterSpacing: 1.5, fontWeight: 600, fontFamily: FONT }}>TOQUE PARA CONTINUAR</div>
  </div>
);

const Welcome = ({ t, onNext, onLogin, onToggleTheme }) => (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 18px 0", flexShrink: 0 }}>
      <ThemeToggle t={t} onToggle={onToggleTheme} />
    </div>
    <Scroll>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "20px 24px", gap: 26, minHeight: "100%" }}>
        <div style={{ width: 220, height: 200, background: t.card2, border: `1px solid ${t.bdr}`,
          borderRadius: 32, display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <BoltLogo t={t} size={84} />
          <div style={{ position: "absolute", bottom: 14, right: 12,
            background: `${t.buy}1C`, border: `1px solid ${t.buy}40`,
            borderRadius: 10, padding: "5px 12px", fontSize: 12, fontWeight: 800,
            color: t.buy, fontFamily: FONT }}>▲ XAUUSD +80p</div>
          <div style={{ position: "absolute", top: 14, left: 12,
            background: `${t.blue}16`, border: `1px solid ${t.blue}35`,
            borderRadius: 10, padding: "4px 10px", fontSize: 11, fontWeight: 700,
            color: t.blue, fontFamily: FONT }}>M5 · M15</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 27, fontWeight: 900, lineHeight: 1.2, margin: "0 0 12px",
            letterSpacing: -0.5, color: t.text, fontFamily: FONT }}>
            Alertas operacionais<br /><span style={{ color: t.accent }}>em tempo real</span>
          </h1>
          <p style={{ fontSize: 14, color: t.sub, lineHeight: 1.65, margin: 0, fontFamily: FONT }}>
            Receba sinais de Forex, índices e metais<br />no horário que você escolher.
          </p>
        </div>
      </div>
    </Scroll>
    <div style={{ padding: "12px 24px 32px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
      <Btn t={t} onClick={onNext}>Começar agora</Btn>
      <Btn t={t} variant="secondary" onClick={onLogin}>Já tenho conta</Btn>
    </div>
  </div>
);

const RiskWarning = ({ t, onNext, onToggleTheme }) => {
  const [ok, setOk] = useState(false);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Antes de continuar" t={t} onToggleTheme={onToggleTheme} />
      <div style={{ padding: "0 24px", marginTop: -6, marginBottom: 14, flexShrink: 0 }}>
        <Label t={t} color={t.warn}>⚠ Aviso importante</Label>
      </div>
      <Scroll style={{ padding: "0 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Os alertas apoiam suas decisões com base em indicadores do MT4.",
            "São estudos operacionais — não garantem resultados nem substituem recomendações financeiras individuais.",
            "Resultados passados não garantem resultados futuros.",
            "Opere de acordo com seu perfil e gerencie posições com responsabilidade.",
          ].map((txt, i) => (
            <Card key={i} t={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: t.warn, fontSize: 14, marginTop: 1, flexShrink: 0 }}>◆</span>
              <span style={{ fontSize: 13, color: t.text, lineHeight: 1.6, fontFamily: FONT }}>{txt}</span>
            </Card>
          ))}
        </div>
      </Scroll>
      <div style={{ padding: "16px 24px 28px", flexShrink: 0 }}>
        <div onClick={() => setOk(!ok)} style={{ display: "flex", alignItems: "center",
          gap: 12, cursor: "pointer", marginBottom: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            border: `1.5px solid ${ok ? t.accent : t.bdr}`,
            background: ok ? t.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            {ok && <span style={{ color: t.activeText, fontSize: 13, fontWeight: 900 }}>✓</span>}
          </div>
          <span style={{ fontSize: 14, color: t.text, fontFamily: FONT }}>Li e concordo com os termos de uso</span>
        </div>
        <Btn t={t} onClick={onNext} disabled={!ok}>Continuar</Btn>
      </div>
    </div>
  );
};

const Login = ({ t, onNext, onToggleTheme, onAuth, onForgot, onCreateAccount }) => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Sem backend (modo demo) → apenas avança. Com backend → autentica de verdade.
  // Login é só entrada; o cadastro vive na tela própria (Signup).
  const handle = async () => {
    if (!onAuth) return onNext();
    setErr(""); setNotice(""); setBusy(true);
    const r = await onAuth(email.trim(), pass, false);
    setBusy(false);
    if (r?.ok) onNext();
    else setErr(r?.error || "Não foi possível entrar. Verifique os dados.");
  };

  const forgot = async () => {
    if (!onForgot) return;
    setErr(""); setNotice("");
    if (!email.trim()) { setErr("Digite seu e-mail acima para receber o link."); return; }
    const r = await onForgot(email.trim());
    if (r?.ok) setNotice("Enviamos um link de redefinição para o seu e-mail.");
    else setErr(r?.error || "Não foi possível enviar o link.");
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 18px 0", flexShrink: 0 }}>
        <ThemeToggle t={t} onToggle={onToggleTheme} />
      </div>
      <Scroll style={{ padding: "8px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <BoltLogo t={t} size={28} />
          <Label t={t}>Bem-vindo de volta</Label>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 28px", letterSpacing: -0.5,
          lineHeight: 1.2, color: t.text, fontFamily: FONT }}>
          Entrar no<br /><span style={{ color: t.accent }}>Infinity Signals</span>
        </h1>
        {[
          { lbl: "E-mail", val: email, set: setEmail, ph: "seu@email.com", type: "email" },
          { lbl: "Senha",  val: pass,  set: setPass,  ph: "••••••••",     type: "password" },
        ].map(({ lbl, val, set, ph, type }) => (
          <div key={lbl} style={{ marginBottom: 14 }}>
            <Label t={t} style={{ marginBottom: 6 }}>{lbl}</Label>
            <input type={type} value={val} placeholder={ph} onChange={e => set(e.target.value)}
              style={{ width: "100%", height: 52,
                background: t.card, border: `1.5px solid ${t.bdr}`,
                borderRadius: 14, padding: "0 16px", color: t.text,
                fontSize: 14, fontFamily: FONT, outline: "none" }} />
          </div>
        ))}
        <div style={{ textAlign: "right", marginTop: 6 }}>
          <span onClick={forgot} style={{ color: t.accent, fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: FONT }}>Esqueci minha senha</span>
        </div>
        {notice && (
          <p style={{ marginTop: 12, fontSize: 12, color: t.buy, textAlign: "center", fontFamily: FONT }}>{notice}</p>
        )}
      </Scroll>
      <div style={{ padding: "12px 24px 32px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
        {err && (
          <div role="alert" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8,
            background: `${t.sell}1A`, border: `1.5px solid ${t.sell}`, borderRadius: 12,
            padding: "12px 14px", fontFamily: FONT }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.sell, lineHeight: 1.35 }}>{err}</span>
          </div>
        )}
        <Btn t={t} onClick={handle} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Btn>
        <Btn t={t} variant="secondary" onClick={onCreateAccount} disabled={busy}>Criar conta</Btn>
      </div>
    </div>
  );
};

const Signup = ({ t, onNext, onToggleTheme, onSignup, onHaveAccount }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [coupon, setCoupon] = useState(() => {
    try { return localStorage.getItem("tfx_ref") || ""; } catch { return ""; }
  });
  const [hasAluno, setHasAluno] = useState(false);
  const [alunoCoupon, setAlunoCoupon] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handle = async () => {
    if (!onSignup) return onNext();
    if (name.trim().length < 2) { setErr("Digite seu nome completo."); return; }
    if (!emailOk) { setErr("Digite um e-mail válido."); return; }
    if (pass.length < 6) { setErr("A senha deve ter pelo menos 6 caracteres."); return; }
    if (pass !== pass2) { setErr("As senhas não conferem."); return; }
    setErr(""); setNotice(""); setBusy(true);
    // Guarda o cupom de aluno para resgatar logo após a autenticação.
    try {
      if (hasAluno && alunoCoupon.trim()) localStorage.setItem("tfx_aluno_coupon", alunoCoupon.trim());
      else localStorage.removeItem("tfx_aluno_coupon");
    } catch { /* ignore */ }
    const r = await onSignup({ name: name.trim(), email: email.trim(), phone: phone.trim(), pass, coupon: coupon.trim() });
    setBusy(false);
    if (r?.ok && r?.needsConfirm) { setNotice("Conta criada! Confirme seu e-mail (veja a caixa de entrada/spam) e depois faça login."); return; }
    if (r?.ok) onNext();
    else setErr(r?.error || "Não foi possível criar a conta.");
  };

  const field = (lbl, val, set, props = {}) => (
    <div style={{ marginBottom: 13 }}>
      <Label t={t} style={{ marginBottom: 6 }}>{lbl}</Label>
      <input value={val} onChange={e => set(e.target.value)} {...props}
        style={{ width: "100%", height: 50, background: t.card, border: `1.5px solid ${t.bdr}`,
          borderRadius: 14, padding: "0 16px", color: t.text, fontSize: 14, fontFamily: FONT, outline: "none" }} />
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 18px 0", flexShrink: 0 }}>
        <ThemeToggle t={t} onToggle={onToggleTheme} />
      </div>
      <Scroll style={{ padding: "8px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <BoltLogo t={t} size={28} />
          <Label t={t}>Criar sua conta</Label>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 900, margin: "0 0 22px", letterSpacing: -0.5,
          lineHeight: 1.2, color: t.text, fontFamily: FONT }}>
          Bem-vindo ao<br /><span style={{ color: t.accent }}>Infinity Signals</span>
        </h1>
        {field("Nome completo", name, setName, { placeholder: "Seu nome" })}
        {field("E-mail", email, setEmail, { type: "email", placeholder: "seu@email.com" })}
        {field("Telefone / WhatsApp", phone, setPhone, { placeholder: "(00) 00000-0000", type: "tel" })}
        {field("Senha", pass, setPass, { type: "password", placeholder: "mín. 6 caracteres" })}
        {field("Confirmar senha", pass2, setPass2, { type: "password", placeholder: "repita a senha" })}
        {field("Cupom de convite (opcional)", coupon, setCoupon, { placeholder: "código de quem te indicou" })}

        {/* Cupom de aluno: libera acesso de aluno (15 dias) automaticamente. */}
        <div onClick={() => setHasAluno(v => !v)} style={{ display: "flex", alignItems: "center", gap: 10,
          cursor: "pointer", padding: "10px 4px", marginBottom: hasAluno ? 8 : 4 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: `1.5px solid ${hasAluno ? t.accent : t.bdr}`, background: hasAluno ? t.accent : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: t.activeText, fontSize: 14, fontWeight: 900 }}>{hasAluno ? "✓" : ""}</div>
          <span style={{ fontSize: 13, color: t.text, fontWeight: 700, fontFamily: FONT }}>🎓 Tenho cupom de aluno</span>
        </div>
        {hasAluno && (
          <>
            {field("Cupom de aluno", alunoCoupon, setAlunoCoupon, { placeholder: "digite o cupom" })}
            <p style={{ fontSize: 11, color: t.sub, margin: "-4px 2px 10px", lineHeight: 1.5, fontFamily: FONT }}>
              Com um cupom válido, seu acesso de <span style={{ fontWeight: 700, color: t.text }}>aluno é liberado por 15 dias</span> automaticamente.
            </p>
          </>
        )}

        <p style={{ fontSize: 11, color: t.muted, margin: "-4px 2px 8px", lineHeight: 1.5, fontFamily: FONT }}>
          🔒 Seus dados são protegidos e usados só para o serviço. Ao criar conta você concorda com os Termos e a Política de Privacidade.
        </p>
      </Scroll>
      <div style={{ padding: "12px 24px 32px", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
        {notice && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 8,
            background: `${t.buy}1A`, border: `1.5px solid ${t.buy}`, borderRadius: 12,
            padding: "12px 14px", fontFamily: FONT }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>✅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.buy, lineHeight: 1.35 }}>{notice}</span>
          </div>
        )}
        {err && (
          <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8,
            background: `${t.sell}1A`, border: `1.5px solid ${t.sell}`, borderRadius: 12,
            padding: "12px 14px", fontFamily: FONT }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: t.sell, lineHeight: 1.35 }}>{err}</span>
          </div>
        )}
        {notice ? (
          <Btn t={t} onClick={onHaveAccount}>Ir para o login</Btn>
        ) : (
          <>
            <Btn t={t} onClick={handle} disabled={busy}>{busy ? "Criando…" : "Criar conta"}</Btn>
            <Btn t={t} variant="secondary" onClick={onHaveAccount} disabled={busy}>Já tenho conta</Btn>
          </>
        )}
      </div>
    </div>
  );
};

const Plans = ({ t, onNext, onBack, onToggleTheme, plan, setPlan, currentPlan }) => {
  const upgrade = !!currentPlan;
  const plans = [
    { id: "free", name: "Free", price: "Grátis", sub: "Para conhecer",
      items: ["2 a 4 operações por dia (M5/M15)", "Em horários fixos", "Histórico de 7 dias"] },
    { id: "mensal", name: "Premium Mensal", price: "R$ 99/mês", sub: "Cobrança mensal",
      items: ["Até 20 operações por dia", "Timeframes M5 e M15", "Escolha seus ativos e horário", "Histórico completo"] },
    { id: "anual", name: "Premium Anual", price: "R$ 79/mês", sub: "Equivalente — cobrado anualmente", badge: "Mais popular",
      items: ["Tudo do mensal + timeframe M1", "Até 20 operações por dia", "Sinais o dia todo (ou delimite)", "Suporte prioritário"] },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title={upgrade ? "Mudar de plano" : "Escolha seu plano"} t={t}
        onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        <p style={{ fontSize: 14, color: t.sub, margin: "0 0 18px", fontFamily: FONT }}>
          {upgrade
            ? `Seu plano atual é ${PLAN_INFO[currentPlan].name}. Escolha para onde quer ir.`
            : "Altere quando quiser nas configurações."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
          {plans.map(p => (
            <div key={p.id} onClick={() => setPlan(p.id)} style={{
              background: t.card, borderRadius: 20, padding: 18,
              border: `1.5px solid ${plan === p.id ? t.accent : t.bdr}`,
              cursor: "pointer", position: "relative", overflow: "hidden" }}>
              {p.badge && (
                <div style={{ position: "absolute", top: 0, right: 18,
                  background: t.accent, color: t.activeText, fontSize: 10, fontWeight: 800,
                  padding: "3px 10px", borderRadius: "0 0 8px 8px", fontFamily: FONT }}>{p.badge}</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 17, color: t.text, fontFamily: FONT }}>{p.name}</div>
                    {upgrade && p.id === currentPlan && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 6,
                        background: t.bg2, color: t.sub, border: `1px solid ${t.bdr}`, fontFamily: FONT }}>ATUAL</span>
                    )}
                  </div>
                  <div style={{ color: t.accent, fontWeight: 800, fontSize: 16, marginTop: 2, fontFamily: FONT }}>{p.price}</div>
                  <div style={{ color: t.muted, fontSize: 11, marginTop: 2, fontFamily: FONT }}>{p.sub}</div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: "50%",
                  border: `2px solid ${plan === p.id ? t.accent : t.bdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {plan === p.id && <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent }} />}
                </div>
              </div>
              {p.items.map(item => (
                <div key={item} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ color: t.accent, fontSize: 12, fontWeight: 800 }}>✓</span>
                  <span style={{ fontSize: 13, color: t.text, fontFamily: FONT }}>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Scroll>
      <div style={{ padding: "12px 24px 28px", flexShrink: 0 }}>
        <Btn t={t} onClick={onNext}>{upgrade ? "Confirmar plano" : "Continuar"}</Btn>
      </div>
    </div>
  );
};

const Assets = ({ t, onNext, onBack, onToggleTheme, selected, setSelected, locked, nextChange }) => {
  const toggle = a => { if (locked) return; setSelected(s => s.includes(a) ? s.filter(x => x !== a) : [...s, a]); };
  const n = selected.length;
  const daysLeft = nextChange ? Math.max(1, Math.ceil((nextChange.getTime() - Date.now()) / 86400000)) : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Seus ativos" t={t} onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        <p style={{ fontSize: 13, color: t.sub, margin: "0 0 14px", fontFamily: FONT }}>
          Os sinais exibidos serão apenas dos ativos que você escolher aqui.
        </p>
        {locked && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14,
            background: `${t.warn}12`, border: `1px solid ${t.warn}38`, borderRadius: 12, padding: "10px 14px" }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <span style={{ fontSize: 12, color: t.warn, lineHeight: 1.5, fontFamily: FONT }}>
              <span style={{ fontWeight: 800 }}>Atenção:</span> você só pode alterar ativos/timeframes 1 vez a cada 7 dias.
              Poderá alterar de novo em <span style={{ fontWeight: 800 }}>{daysLeft} dia{daysLeft !== 1 ? "s" : ""}</span>.
            </span>
          </div>
        )}
        <Card t={t} accent style={{ marginBottom: 14, padding: "12px 16px" }}>
          <p style={{ fontSize: 12, color: t.text, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
            <span style={{ fontWeight: 800, color: t.accent }}>1 timeframe fixo por ativo.</span> Você
            escolhe o melhor tempo pelo histórico — e só pode trocar 1 vez por semana.
          </p>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
          {ASSETS.map(a => {
            const on = selected.includes(a);
            return (
              <div key={a} onClick={() => toggle(a)} style={{
                background: t.card, borderRadius: 16, padding: "14px 16px",
                border: `1.5px solid ${on ? t.accent : t.bdr}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                opacity: locked && !on ? 0.5 : 1,
                cursor: locked ? "not-allowed" : "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <AssetIcon asset={a} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: t.text, fontFamily: FONT }}>{a}</div>
                    <div style={{ fontSize: 11, color: t.sub, marginTop: 2, fontFamily: FONT }}>{ASSET_NAMES[a]}</div>
                  </div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                  border: `1.5px solid ${on ? t.accent : t.bdr}`,
                  background: on ? t.accent : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {on && <span style={{ color: t.activeText, fontSize: 13, fontWeight: 900 }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Scroll>
      <div style={{ padding: "14px 24px 28px", flexShrink: 0 }}>
        <p style={{ fontSize: 12, color: t.sub, textAlign: "center", margin: "0 0 12px", fontFamily: FONT }}>
          {n} ativo{n !== 1 ? "s" : ""} · 1 timeframe fixo por ativo
        </p>
        <Btn t={t} onClick={onNext} disabled={n === 0}>Continuar</Btn>
      </div>
    </div>
  );
};

const Timeframes = ({ t, onNext, onBack, onToggleTheme, selectedAssets, tfPerAsset, setTfPerAsset, plan, locked, nextChange }) => {
  const maxTf = maxTfPerAsset(selectedAssets.length);
  const tfs = tfOptionsForPlan(plan);
  const [snapshot] = useState(() => JSON.stringify(tfPerAsset));
  const toggleTf = (a, tf) => {
    if (locked) return;
    setTfPerAsset(cfg => ({ ...cfg, [a]: [tf] }));
  };
  const save = () => onNext(JSON.stringify(tfPerAsset) !== snapshot);
  const daysLeft = nextChange ? Math.max(1, Math.ceil((nextChange.getTime() - Date.now()) / 86400000)) : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Tempos gráficos" t={t} onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        <Card t={t} accent style={{ marginBottom: 14, padding: "12px 16px" }}>
          <p style={{ fontSize: 12, color: t.text, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
            <span style={{ fontWeight: 800, color: t.accent }}>1 timeframe fixo por ativo.</span> Escolha o melhor tempo pelo histórico — você só pode trocar 1 vez por semana.
            {plan === "anual"
              ? <span style={{ color: t.accent, fontWeight: 700 }}> O M1 é exclusivo do seu plano Anual.</span>
              : <span style={{ color: t.muted }}> O M1 é exclusivo do Premium Anual.</span>}
          </p>
        </Card>
        {locked && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14,
            background: `${t.warn}12`, border: `1px solid ${t.warn}38`, borderRadius: 12, padding: "10px 14px" }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <span style={{ fontSize: 12, color: t.warn, lineHeight: 1.5, fontFamily: FONT }}>
              Timeframes travados. Você poderá trocar em <span style={{ fontWeight: 800 }}>{daysLeft} dia{daysLeft !== 1 ? "s" : ""}</span>.
            </span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
          {selectedAssets.map(a => {
            const cur = tfPerAsset[a] || [];
            return (
              <Card key={a} t={t}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AssetIcon asset={a} size={30} />
                    <span style={{ fontWeight: 800, fontSize: 14, color: t.text, fontFamily: FONT }}>{a}</span>
                  </div>
                  <span style={{ fontSize: 11, color: t.muted, fontFamily: FONT }}>{cur.length}/{maxTf}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {tfs.map(tf => {
                    const active = cur.includes(tf);
                    return (
                      <Chip key={tf} label={tf} active={active} disabled={locked && !active}
                        onClick={() => toggleTf(a, tf)} t={t} />
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </Scroll>
      <div style={{ padding: "14px 24px 28px", flexShrink: 0 }}>
        <Btn t={t} onClick={save}>Salvar preferências</Btn>
      </div>
    </div>
  );
};

const Home = ({ t, onNav, onOpenSignal, onToggleTheme, selectedAssets, plan, tfPerAsset, schedule, live, stats, closeAlerts = [], onToggleCloseAlert, userName }) => {
  const [dashTf, setDashTf] = useState("Todos");
  const liveSignals = live?.signals?.length ? live.signals.map(mapSignal) : null;
  const recentSignals = live?.recent?.length ? live.recent.map(mapSignal) : null;
  const quota = live?.quota ?? dailyQuota(plan);
  const used = live?.delivered ?? 0;
  const info = PLAN_INFO[plan];
  const schedTxt = schedule.allDay ? "Dia todo" : `${schedule.start} – ${schedule.end}`;
  // Últimos sinais: os de hoje quando há; senão as operações recentes do servidor.
  // Filtra por timeframe (M5/M15/Todos) e mostra os 3 mais recentes.
  const recentAll = liveSignals || recentSignals || [];
  const recent = recentAll.filter(s => dashTf === "Todos" || s.tf === dashTf).sort(sortSignals).slice(0, 3);
  const assertTxt = stats ? `${Math.round((stats.assertividade || 0) * 100)}%` : "—";
  const acumTxt = stats ? `${stats.acumulado_pips >= 0 ? "+" : ""}${stats.acumulado_pips} pips` : "—";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Scroll>
        <div style={{ padding: "16px 24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BoltLogo t={t} size={32} />
              <div>
                <div style={{ fontSize: 13, color: t.sub, fontFamily: FONT }}>Olá, {userName || "Trader"} 👋</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5, color: t.text, fontFamily: FONT }}>Dashboard</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ background: t.accentSoft, border: `1.5px solid ${t.accentBdr}`,
                borderRadius: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.accent }} />
                <span style={{ color: t.accent, fontSize: 11, fontWeight: 800, fontFamily: FONT }}>
                  {PLAN_BADGE[plan] || "FREE"}
                </span>
              </div>
              <ThemeToggle t={t} onToggle={onToggleTheme} />
            </div>
          </div>

          {/* Fim de semana: mercado Forex fechado → não há operações. */}
          {forexClosed() && (
            <div style={{ background: `${t.blue}14`, border: `1.5px solid ${t.blue}55`,
              borderRadius: 16, padding: "14px 16px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🛌</span>
              <div style={{ fontSize: 12.8, color: t.text, lineHeight: 1.5, fontFamily: FONT }}>
                <b>Hoje não há operações</b> — fim de semana, o mercado Forex está fechado.<br />
                As operações voltam no <b style={{ color: t.blue }}>primeiro sinal de domingo, a partir das {FOREX_OPEN_BRT}h</b> (horário de Brasília). Bom descanso! 📈
              </div>
            </div>
          )}

          {/* Aviso de vencimento: alerta de 3 dias antes E aviso de "venceu →
             voltou ao Free" por até 7 dias depois (lembrete de renovação). Baseado
             em plan_expires_at, não no plano atual — senão, já virado Free, sumiria. */}
          {(() => {
            const exp = live?.plan_expires_at ? new Date(live.plan_expires_at).getTime() : 0;
            if (!exp) return null;
            const dias = Math.ceil((exp - Date.now()) / 86400000);
            if (dias > 3 || dias < -7) return null;
            const venceu = dias <= 0;
            return (
              <div style={{ background: `${t.warn}14`, border: `1.5px solid ${t.warn}55`,
                borderRadius: 16, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>⏳</span>
                <span style={{ fontSize: 12.5, color: t.text, lineHeight: 1.45, fontFamily: FONT }}>
                  {venceu
                    ? <>Seu plano <b>venceu</b> — sua conta voltou para o <b style={{ color: t.warn }}>Free</b>. Renove para recuperar o acesso completo.</>
                    : <>Seu plano vence em <b style={{ color: t.warn }}>{dias} dia{dias !== 1 ? "s" : ""}</b>. Renove para não cair no Free.</>}
                </span>
              </div>
            );
          })()}

          <div style={{ background: t.card2, border: `1.5px solid ${t.accentBdr}`,
            borderRadius: 22, padding: "20px 20px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Label t={t}>Sinais hoje</Label>
              <span style={{ fontSize: 11, color: t.blue, fontWeight: 700, fontFamily: FONT }}>🕐 {schedTxt}</span>
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: t.accent, lineHeight: 1, marginBottom: 8, fontFamily: FONT }}>
              {used} <span style={{ fontSize: 20, color: t.muted, fontWeight: 400 }}>/ {quota}</span>
            </div>
            <Bar pct={(used / quota) * 100} t={t} />
            <p style={{ fontSize: 12, color: t.sub, margin: "8px 0 0", fontFamily: FONT }}>
              {plan === "free"
                ? "Plano Free — operações sorteadas (M5/M15)"
                : `${info.name} — até 20 operações por dia`}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Label t={t}>Últimos sinais</Label>
            {/* Filtro M5/M15 só para quem recebe vários timeframes (admin/aluno).
                Cliente comum vê só o tf que escolheu — sem mistura, sem botões. */}
            {live?.seeAll && (
              <div style={{ display: "flex", gap: 6 }}>
                {["Todos", "M5", "M15"].map(f => {
                  const on = dashTf === f;
                  return (
                    <button key={f} onClick={() => setDashTf(f)} style={{
                      padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: FONT,
                      fontSize: 11, fontWeight: 800, border: `1.5px solid ${on ? t.accent : t.bdr}`,
                      background: on ? t.accent : "transparent", color: on ? t.activeText : t.sub }}>{f}</button>
                  );
                })}
              </div>
            )}
          </div>
          {recent.length === 0 ? (
            <Card t={t} style={{ textAlign: "center", padding: "24px 18px" }}>
              <p style={{ fontSize: 13, color: t.sub, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
                {dashTf === "Todos" ? <>Nenhum sinal ainda hoje.<br />Você será avisado quando chegar um.</> : `Nenhum sinal em ${dashTf} agora.`}
              </p>
            </Card>
          ) : recent.map((s, i) => (
            <DashSignalCard key={s.id ?? i} s={s} t={t}
              fav={closeAlerts.includes(s.signalId)}
              onToggleFav={s.signalId && onToggleCloseAlert ? () => onToggleCloseAlert(s.signalId) : undefined}
              onClick={() => { onOpenSignal(s); onNav("signal-detail"); }} />
          ))}
          <div style={{ height: 4 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Card t={t}>
              <div style={{ fontSize: 11, color: t.sub, marginBottom: 4, fontFamily: FONT }}>Assertividade</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: t.accent, fontFamily: FONT }}>{assertTxt}</div>
            </Card>
            <Card t={t}>
              <div style={{ fontSize: 11, color: t.sub, marginBottom: 4, fontFamily: FONT }}>Resultado do mês</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: t.buy, fontFamily: FONT }}>{acumTxt}</div>
            </Card>
          </div>
        </div>
      </Scroll>
      <BottomNav active="home" onNav={onNav} t={t} />
    </div>
  );
};

const SignalsFeed = ({ t, onNav, onOpenSignal, onToggleTheme, onOpenFilters, selectedAssets, plan, tfPerAsset, schedule, live, stats, showMock, closeAlerts = [], onToggleCloseAlert }) => {
  const [filter, setFilter] = useState("Todos");
  const [tfStats, setTfStats] = useState("Geral"); // Filtro simples: Geral, M5, M15
  const inWindow = h => schedule.allDay || (h >= parseInt(schedule.start) && h < parseInt(schedule.end));
  // Com backend, o /api já devolve os sinais filtrados por plano/ativos/janela/cota.
  // O backend já devolve os sinais filtrados por plano/ativos/janela/cota:
  // `signals` = os de hoje; `recent` = as operações recentes (qualquer dia).
  const liveSignals = live?.signals?.length ? live.signals.map(mapSignal) : null;
  const recentSignals = live?.recent?.length ? live.recent.map(mapSignal) : null;
  const base = liveSignals || recentSignals || [];
  // Filtra por direção + timeframe.
  const filtered = base.filter(s =>
    (filter === "Todos" || (filter === "Compras" ? s.dir === "Compra" : s.dir === "Venda")) &&
    (tfStats === "Geral" || s.tf === tfStats)
  );
  const shown = filtered.sort(sortSignals);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Sinais" t={t} onToggleTheme={onToggleTheme}
        right={
          <button onClick={onOpenFilters} aria-label="Abrir filtros" style={{
            width: 38, height: 38, borderRadius: 12, cursor: "pointer",
            background: t.card, border: `1.5px solid ${t.bdr}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: t.accent, padding: 0 }}>⚙</button>
        } />
      {(() => {
        const zero = { pips: 0, assertividade: 0, total: 0 };
        // Se tem filtro por TF, calcula dos sinais filtrados (não usa stats pré-agregado).
        let dia = zero, semana = zero, mes = zero;
        if (tfStats !== "Geral") {
          const allClosed = (live?.recentAll || live?.recent || [])
            .filter(r => (r.status === "ganho" || r.status === "perda") && r.tf === tfStats)
            .map(mapSignal);
          // Usar mesmas datas do backend (sincronizadas com Brasília).
          const dayStart = forexDayStartMs();
          const { startOfWeekMs, startOfMonthMs } = (() => {
            const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
            const startOfWeek = () => {
              const day = brt.getDay();
              const diff = day === 0 ? -2 : (day === 1 ? 0 : 1 - day);
              const seg = new Date(brt);
              seg.setDate(seg.getDate() + diff);
              seg.setHours(0, 0, 0, 0);
              return seg.getTime();
            };
            const startOfMonth = () => {
              const m = new Date(brt);
              m.setDate(1);
              m.setHours(0, 0, 0, 0);
              return m.getTime();
            };
            return { startOfWeekMs: startOfWeek(), startOfMonthMs: startOfMonth() };
          })();
          const weekStart = startOfWeekMs;
          const monthStart = startOfMonthMs;
          const agg = (list) => {
            let g = 0, p = 0, pips = 0;
            for (const s of list) {
              if (s.status === "ganho") g++; else p++;
              pips += (s.resultPips || 0);
            }
            const tot = g + p;
            return { ganhos: g, perdas: p, total: tot, pips: Math.round(pips), assertividade: tot ? Math.round((g / tot) * 100) : 0 };
          };
          dia = agg(allClosed.filter(s => (s.ts || 0) >= dayStart));
          semana = agg(allClosed.filter(s => (s.ts || 0) >= weekStart));
          mes = agg(allClosed.filter(s => (s.ts || 0) >= monthStart));
        } else {
          // Sem filtro: usa stats pré-agregado (como era).
          dia = stats?.dia || zero;
          semana = stats?.semana || zero;
          mes = stats?.mes || zero;
        }
        const row = (label, d) => {
          const pos = (d.pips || 0) >= 0;
          return (
            <div style={{ flex: 1, minWidth: 0, background: t.card, border: `1px solid ${t.bdr}`,
              borderRadius: 14, padding: "11px 10px", display: "flex",
              flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, color: t.sub, fontFamily: FONT, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: pos ? t.buy : t.sell, fontFamily: FONT,
                whiteSpace: "nowrap" }}>
                {pos ? "+" : ""}{d.pips || 0}
                <span style={{ fontSize: 10.5, fontWeight: 600, color: t.sub }}> pips</span>
              </span>
              <span style={{ fontSize: 10.5, color: t.sub, fontFamily: FONT }}>
                {d.total || 0} ops · {d.assertividade || 0}%
              </span>
            </div>
          );
        };
        return (
          <div style={{ padding: "0 16px", marginBottom: 10, flexShrink: 0,
            display: "flex", gap: 8 }}>
            {row("Hoje", dia)}
            {row(stats?.week_label || "Semana", semana)}
            {row("Mês", mes)}
          </div>
        );
      })()}
      <div style={{ padding: "0 24px", marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          {["Todos", "Compras", "Vendas"].map(f => (
            <Chip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} t={t} />
          ))}
          {/* Dropdown simples: Geral / M5 / M15 (ícone relógio) */}
          <select value={tfStats} onChange={(e) => setTfStats(e.target.value)}
            style={{
              background: t.card, border: `1px solid ${t.bdr}`, borderRadius: 8,
              color: t.text, fontSize: 12, padding: "4px 8px", fontFamily: FONT,
              cursor: "pointer", marginLeft: "auto"
            }}>
            <option value="Geral">⏱️ Geral</option>
            <option value="M5">⏱️ M5</option>
            <option value="M15">⏱️ M15</option>
          </select>
        </div>
        {plan === "free" && (
          <div style={{ background: `${t.warn}10`, border: `1px solid ${t.warn}30`,
            borderRadius: 12, padding: "8px 12px", marginBottom: 4 }}>
            <p style={{ fontSize: 11, color: t.warn, margin: 0, fontFamily: FONT }}>
              Plano Free: 2 a 4 operações por dia (M5/M15 sortidos) em horários fixos. Faça upgrade para escolher ativos.
            </p>
          </div>
        )}
      </div>
      <Scroll style={{ padding: "0 24px" }}>
        {forexClosed() && (
          <div style={{ background: `${t.blue}14`, border: `1.5px solid ${t.blue}55`,
            borderRadius: 16, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🛌</span>
            <div style={{ fontSize: 12.8, color: t.text, lineHeight: 1.5, fontFamily: FONT }}>
              <b>Hoje não há operações</b> — fim de semana, o mercado Forex está fechado.<br />
              Voltam no <b style={{ color: t.blue }}>primeiro sinal de domingo, a partir das {FOREX_OPEN_BRT}h</b> (Brasília).
            </div>
          </div>
        )}
        {shown.length === 0 ? (
          forexClosed() ? null : (
          <Card t={t} style={{ textAlign: "center", padding: "28px 18px" }}>
            <p style={{ fontSize: 13, color: t.sub, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
              Nenhum sinal no seu horário e filtros atuais.<br />Ajuste nos Filtros ou no Perfil.
            </p>
          </Card>
          )
        ) : shown.map(s => {
          const open = !s.status || s.status === "aberto";
          return (
            <SignalRow key={s.id} s={s} t={t}
              pips={open ? undefined : s.resultPips}
              fav={open ? closeAlerts.includes(s.signalId) : undefined}
              onToggleFav={open && s.signalId && onToggleCloseAlert ? () => onToggleCloseAlert(s.signalId) : undefined}
              onClick={() => { onOpenSignal(s); onNav("signal-detail"); }} />
          );
        })}
        <div style={{ height: 16 }} />
      </Scroll>
      <BottomNav active="signals" onNav={onNav} t={t} />
    </div>
  );
};

/* DETALHE — agora com navegação inferior */
const SignalDetail = ({ t, signal, onNav, onBack, onToggleTheme, showMock }) => {
  const s = signal || (showMock ? SIGNALS_DATA[0] : null);
  if (!s) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Scroll>
          <div style={{ padding: "16px 24px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <BackBtn onClick={onBack} t={t} />
              <ThemeToggle t={t} onToggle={onToggleTheme} />
            </div>
            <Card t={t} style={{ textAlign: "center", padding: "28px 18px" }}>
              <p style={{ fontSize: 13, color: t.sub, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
                Sinal indisponível.
              </p>
            </Card>
          </div>
        </Scroll>
        <BottomNav active="signals" onNav={onNav} t={t} />
      </div>
    );
  }
  const buy = s.dir === "Compra";
  const ac = buy ? t.buy : t.sell;
  // Só dá para copiar/entrar dentro da janela de 10 min após o sinal.
  const canCopy = s.ageMin != null && s.ageMin <= COPY_WINDOW_MIN;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Scroll>
        <div style={{ padding: "16px 24px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <BackBtn onClick={onBack} t={t} />
            <ThemeToggle t={t} onToggle={onToggleTheme} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <AssetIcon asset={s.asset} size={52} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, color: t.text, fontFamily: FONT }}>{s.asset}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <Badge text={s.dir} color={ac} />
                  <Badge text={s.tf} color={t.blue} />
                </div>
              </div>
            </div>
            <div style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: `${ac}18`, border: `2px solid ${ac}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, color: ac }}>{buy ? "▲" : "▼"}</div>
          </div>
          {[
            { label: "Entrada",            value: s.entry, color: t.text },
            { label: "Take Profit (TP)",   value: s.tp,    color: t.buy  },
            { label: "Stop Loss (SL)",     value: s.sl,    color: t.sell },
            { label: "Resultado estimado", value: s.est,   color: t.blue },
            { label: "Horário do sinal",   value: s.time,  color: t.text },
          ].map(r => (
            <Card key={r.label} t={t} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: t.sub, fontFamily: FONT }}>{r.label}</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: r.color, fontFamily: FONT }}>{r.value}</span>
            </Card>
          ))}
          <div style={{ background: `${t.warn}0E`, border: `1px solid ${t.warn}30`,
            borderRadius: 14, padding: "12px 16px", margin: "12px 0 22px",
            display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: t.warn, fontSize: 16 }}>⚠</span>
            <span style={{ fontSize: 12, color: t.warn, lineHeight: 1.6, fontFamily: FONT }}>
              Este é um estudo operacional, não uma recomendação financeira. Avalie o risco antes de operar.
            </span>
          </div>
          {canCopy ? (
            <div style={{ display: "flex", gap: 10 }}>
              <Btn t={t} style={{ flex: 1, height: 50 }}>Copiar sinal</Btn>
              <Btn t={t} variant="secondary" style={{ flex: 1, height: 50 }}
                onClick={() => onNav("history")}>Histórico</Btn>
            </div>
          ) : (
            <>
              <div style={{ background: t.bg2, border: `1px solid ${t.bdr}`,
                borderRadius: 14, padding: "14px 16px", marginBottom: 10,
                display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>⏱️</span>
                <span style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.5, fontFamily: FONT }}>
                  <span style={{ fontWeight: 800, color: t.text }}>Janela de entrada encerrada.</span> Este
                  sinal passou de {COPY_WINDOW_MIN} min — você pode acompanhar, mas não entrar mais.
                </span>
              </div>
              <Btn t={t} variant="secondary" style={{ height: 50 }}
                onClick={() => onNav("history")}>Ver histórico</Btn>
            </>
          )}
        </div>
      </Scroll>
      <BottomNav active="signals" onNav={onNav} t={t} />
    </div>
  );
};

const Filters = ({ t, onNav, onBack, onToggleTheme, selectedAssets, plan, tfPerAsset = {}, onPick, locked, nextChange, isAdmin }) => {
  const tfs = tfOptionsForPlan(plan);
  const daysLeft = nextChange ? Math.max(1, Math.ceil((nextChange.getTime() - Date.now()) / 86400000)) : 0;
  const canChange = isAdmin || !locked;
  const [toast, setToast] = useState("");
  const pick = (a, tf) => {
    if (!canChange) return;
    onPick && onPick(a, tf);
    setToast(`${a} → ${tf}`); setTimeout(() => setToast(""), 1400);
  };
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Scroll>
        <div style={{ padding: "16px 24px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <BackBtn onClick={onBack} t={t} />
            <ThemeToggle t={t} onToggle={onToggleTheme} />
          </div>
          <div style={{ marginBottom: 6 }}><Badge text={isAdmin ? "ADMIN" : "PREMIUM"} color={t.accent} /></div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: "8px 0 8px", letterSpacing: -0.5,
            color: t.text, fontFamily: FONT }}>Timeframe por ativo</h1>
          <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 18px", lineHeight: 1.55, fontFamily: FONT }}>
            Você recebe os sinais no timeframe escolhido para cada ativo — <span style={{ fontWeight: 700, color: t.text }}>1 por ativo</span>.{" "}
            {isAdmin ? "Como admin, você troca quando quiser." : "Você pode trocar 1× por semana."}
          </p>

          {locked && !isAdmin && nextChange && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14,
              background: `${t.warn}12`, border: `1px solid ${t.warn}38`, borderRadius: 12, padding: "11px 14px" }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <span style={{ fontSize: 12, color: t.warn, lineHeight: 1.55, fontFamily: FONT }}>
                Você escolheu em <span style={{ fontWeight: 800 }}>{BRT_DDMM.format(new Date(nextChange.getTime() - 7 * 86400000))}</span> —
                poderá trocar a partir de <span style={{ fontWeight: 800 }}>{BRT_DDMM.format(nextChange)}</span> ({daysLeft} dia{daysLeft !== 1 ? "s" : ""}).
                A troca é 1× por semana pra manter o histórico correto.
              </span>
            </div>
          )}
          {!locked && !isAdmin && (
            <p style={{ fontSize: 11.5, color: t.sub, margin: "0 0 14px", lineHeight: 1.5, fontFamily: FONT }}>
              ⚠️ Ao trocar o timeframe de um ativo, ele fica <span style={{ fontWeight: 700, color: t.text }}>travado por 7 dias</span> (pra contar o histórico de forma correta).
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedAssets.map(a => {
              const cur = (tfPerAsset[a] || [])[0];
              return (
                <Card key={a} t={t}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                    <AssetIcon asset={a} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: t.text, fontFamily: FONT }}>{a}</div>
                      <div style={{ fontSize: 11, color: t.sub, fontFamily: FONT }}>{ASSET_NAMES[a] || a}</div>
                    </div>
                    <div style={{ fontSize: 11, color: t.sub, fontFamily: FONT }}>
                      atual: <span style={{ fontWeight: 800, color: t.accent }}>{cur || "—"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {tfs.map(tf => {
                      const active = cur === tf;
                      return (
                        <button key={tf} onClick={() => pick(a, tf)} disabled={!canChange && !active}
                          style={{ flex: 1, height: 42, borderRadius: 11, cursor: canChange ? "pointer" : "default",
                            fontWeight: 800, fontSize: 14, fontFamily: FONT,
                            border: `1.5px solid ${active ? t.accent : t.bdr}`,
                            background: active ? t.accent : "transparent",
                            color: active ? t.activeText : (canChange ? t.text : t.muted),
                            opacity: (!canChange && !active) ? 0.5 : 1 }}>{tf}</button>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>

          {toast && (
            <p style={{ marginTop: 14, fontSize: 13, fontWeight: 700, textAlign: "center",
              color: t.buy, fontFamily: FONT }}>✓ Timeframe atualizado: {toast}</p>
          )}
          <p style={{ marginTop: 16, fontSize: 11.5, color: t.muted, lineHeight: 1.55, fontFamily: FONT }}>
            Para comparar qual timeframe rende mais em cada ativo, veja <span style={{ color: t.accent, fontWeight: 700 }}>Desempenho → Histórico por timeframe</span>.
          </p>
        </div>
      </Scroll>
      <BottomNav active="signals" onNav={onNav} t={t} />
    </div>
  );
};

const MOCK_BREAKDOWN = [
  { asset: "XAUUSD", tf: "M5",  assertividade: 78, pips: 210, total: 40 },
  { asset: "XAUUSD", tf: "M15", assertividade: 65, pips: 140, total: 26 },
  { asset: "XAUUSD", tf: "M1",  assertividade: 71, pips: 95,  total: 33 },
  { asset: "NAS100", tf: "M5",  assertividade: 60, pips: 80,  total: 22 },
  { asset: "NAS100", tf: "M15", assertividade: 74, pips: 180, total: 19 },
  { asset: "NAS100", tf: "M1",  assertividade: 58, pips: 40,  total: 28 },
  { asset: "US30",   tf: "M5",  assertividade: 68, pips: 120, total: 25 },
  { asset: "US30",   tf: "M15", assertividade: 70, pips: 160, total: 21 },
  { asset: "EURUSD", tf: "M5",  assertividade: 55, pips: 30,  total: 14 },
  { asset: "EURUSD", tf: "M15", assertividade: 64, pips: 70,  total: 18 },
  { asset: "GBPUSD", tf: "M5",  assertividade: 52, pips: 20,  total: 12 },
  { asset: "GBPUSD", tf: "M15", assertividade: 58, pips: 40,  total: 15 },
];

const TimeframePerf = ({ t, onNav, onBack, onToggleTheme, selectedAssets, tfPerAsset, plan, breakdown, locked, nextChange, onPick, showMock }) => {
  const data = breakdown?.breakdown?.length ? breakdown.breakdown : (showMock ? MOCK_BREAKDOWN : []);
  const tfs = tfOptionsForPlan(plan);
  const daysLeft = nextChange ? Math.max(1, Math.ceil((nextChange.getTime() - Date.now()) / 86400000)) : 0;
  const statFor = (a, tf) => data.find(d => d.asset === a && d.tf === tf);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Histórico por timeframe" t={t} onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 12px", lineHeight: 1.55, fontFamily: FONT }}>
          Veja qual tempo rende mais em cada ativo e escolha o melhor. Lembre: <span style={{ fontWeight: 700, color: t.text }}>1 troca por semana</span>.
        </p>
        {locked && nextChange && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12,
            background: `${t.warn}12`, border: `1px solid ${t.warn}38`, borderRadius: 12, padding: "11px 14px" }}>
            <span style={{ fontSize: 16 }}>🔒</span>
            <span style={{ fontSize: 12, color: t.warn, lineHeight: 1.55, fontFamily: FONT }}>
              Escolhido em <span style={{ fontWeight: 800 }}>{BRT_DDMM.format(new Date(nextChange.getTime() - 7 * 86400000))}</span> —
              troca liberada em <span style={{ fontWeight: 800 }}>{BRT_DDMM.format(nextChange)}</span> ({daysLeft} dia{daysLeft !== 1 ? "s" : ""}).
            </span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12 }}>
          {selectedAssets.map(a => {
            const cur = (tfPerAsset[a] || [])[0];
            const rows = tfs.map(tf => ({ tf, s: statFor(a, tf) }))
              .sort((x, y) => (y.s?.assertividade || 0) - (x.s?.assertividade || 0));
            const best = rows[0]?.tf;
            return (
              <Card key={a} t={t}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <AssetIcon asset={a} size={28} />
                  <span style={{ fontWeight: 800, fontSize: 14, color: t.text, fontFamily: FONT }}>{a}</span>
                </div>
                {rows.map(({ tf, s }) => {
                  const isCur = cur === tf;
                  const assert = s?.assertividade ?? 0;
                  const pips = s?.pips ?? 0;
                  const col = assert >= 70 ? t.accent : assert >= 60 ? t.blue : t.warn;
                  return (
                    <div key={tf} onClick={() => { if (!locked && !isCur && s) onPick(a, tf); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                        cursor: (!locked && !isCur && s) ? "pointer" : "default", opacity: s ? 1 : 0.45 }}>
                      <div style={{ width: 42, textAlign: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: t.text, fontFamily: FONT }}>{tf}</span>
                        {tf === best && s && <div style={{ fontSize: 8, fontWeight: 800, color: t.accent, fontFamily: FONT }}>MELHOR</div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: t.sub, fontFamily: FONT }}>
                            {s ? `${s.total} ops · ${pips >= 0 ? "+" : ""}${pips} pips` : "sem histórico"}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: col, fontFamily: FONT }}>{assert}%</span>
                        </div>
                        <Bar pct={assert} color={col} t={t} />
                      </div>
                      <div style={{ width: 56, textAlign: "right", flexShrink: 0 }}>
                        {isCur
                          ? <span style={{ fontSize: 10, fontWeight: 800, color: t.accent, fontFamily: FONT }}>● ATUAL</span>
                          : (!locked && s) ? <span style={{ fontSize: 11, fontWeight: 800, color: t.accent, fontFamily: FONT }}>Usar ›</span> : null}
                      </div>
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>
      </Scroll>
      <BottomNav active="performance" onNav={onNav} t={t} />
    </div>
  );
};

// Curva de capital (equity): pips ACUMULADOS ao longo do tempo, a partir dos
// sinais fechados. Reutilizável (Desempenho + boletim). `closed` = lista já
// mapeada (mapSignal) com .ts/.resultPips/.status.
const EquityCurve = ({ t, closed, height = 120, defaultPeriod = "Geral" }) => {
  const [period, setPeriod] = useState(defaultPeriod);
  const all = (closed || []).filter(s => s.status === "ganho" || s.status === "perda");
  if (all.length < 2) return null; // sem track record suficiente ainda

  const cut = period === "Semana" ? Date.now() - 7 * 86400000
    : period === "Mês" ? Date.now() - 30 * 86400000 : 0;
  const ordered = all.filter(s => (s.ts || 0) >= cut).sort((a, b) => (a.ts || 0) - (b.ts || 0));

  let cum = 0;
  const serie = ordered.map(s => (cum += (s.resultPips || 0)));
  const final = serie.length ? serie[serie.length - 1] : 0;
  const pos = final >= 0;
  const col = pos ? t.buy : t.sell;

  let chart = null;
  if (serie.length >= 2) {
    const min = Math.min(0, ...serie);
    const max = Math.max(0, ...serie);
    const range = (max - min) || 1;
    const W = 320, H = height, pad = 8;
    const x = i => (i / (serie.length - 1)) * W;
    const y = v => H - pad - ((v - min) / range) * (H - 2 * pad);
    const line = serie.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const area = `0,${H} ${line} ${W},${H}`;
    const zeroY = y(0).toFixed(1);
    chart = (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.28" />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke={t.bdr} strokeWidth="1" strokeDasharray="3 4" />
        <polygon points={area} fill="url(#eqGrad)" />
        <polyline points={line} fill="none" stroke={col} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <Card t={t} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <Label t={t}>Curva de capital</Label>
        <span style={{ fontSize: 16, fontWeight: 900, color: col, fontFamily: FONT }}>
          {pos ? "+" : ""}{Math.round(final)} pips
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["Semana", "Mês", "Geral"].map(p => (
          <Chip key={p} label={p} active={period === p} onClick={() => setPeriod(p)} t={t} />
        ))}
      </div>
      {chart || (
        <p style={{ fontSize: 12, color: t.sub, margin: "10px 0", textAlign: "center", fontFamily: FONT }}>
          Poucas operações fechadas neste período.
        </p>
      )}
      <p style={{ fontSize: 10.5, color: t.muted, margin: "8px 0 0", fontFamily: FONT }}>
        Pips acumulados em {ordered.length} operações ({period.toLowerCase()}) — laudo da ferramenta.
      </p>
    </Card>
  );
};

const Performance = ({ t, onNav, onToggleTheme, selectedAssets, stats, breakdown, tfPerAsset = {}, onTfPerf, showMock, live }) => {
  // Agrega o desempenho por TIMEFRAME (M5, M15) e o geral — a partir do
  // breakdown por ativo×tf. Deixa claro de onde vem o número acumulado.
  const bd = breakdown?.breakdown || [];
  const aggTf = (tf) => {
    const rows = tf ? bd.filter(d => d.tf === tf) : bd;
    const ganhos = rows.reduce((a, d) => a + (d.ganhos || 0), 0);
    const perdas = rows.reduce((a, d) => a + (d.perdas || 0), 0);
    const pips = rows.reduce((a, d) => a + (d.pips || 0), 0);
    const total = ganhos + perdas;
    return { pips, total, assert: total ? Math.round((ganhos / total) * 100) : 0 };
  };
  const tfRows = [
    { label: "M5", d: aggTf("M5") },
    { label: "M15", d: aggTf("M15") },
    { label: "Geral (todos)", d: aggTf(null), accent: true },
  ].filter(r => r.accent || r.d.total > 0);
  const lineData = [38,52,45,68,62,78,72,88,82,91,85,94];
  const metrics = stats ? [
    { label: "Assertividade",       value: `${Math.round((stats.assertividade || 0) * 100)}%`, color: t.accent },
    { label: "Ganhos",              value: String(stats.ganhos ?? 0),  color: t.buy  },
    { label: "Perdas",              value: String(stats.perdas ?? 0),  color: t.sell },
    { label: "Resultado acumulado", value: `${stats.acumulado_pips >= 0 ? "+" : ""}${stats.acumulado_pips} pips`, color: t.buy },
  ] : (showMock ? [
    { label: "Assertividade",       value: "71%",       color: t.accent },
    { label: "Ganhos",              value: "142",       color: t.buy    },
    { label: "Perdas",              value: "58",        color: t.sell   },
    { label: "Resultado acumulado", value: "+313 pips", color: t.buy    },
  ] : [
    { label: "Assertividade",       value: "—",      color: t.accent },
    { label: "Ganhos",              value: "0",      color: t.buy    },
    { label: "Perdas",              value: "0",      color: t.sell   },
    { label: "Resultado acumulado", value: "+0 pips", color: t.buy   },
  ]);
  const maxV = Math.max(...lineData);
  const W = 300, H = 80;
  const pts = lineData.map((v,i)=>`${(i/(lineData.length-1))*W},${H-(v/maxV)*(H-8)}`).join(" ");
  const perAsset = { XAUUSD: 88, NAS100: 74, EURUSD: 65, GBPUSD: 58, US30: 70 };
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Desempenho" t={t} onToggleTheme={onToggleTheme} />
      <Scroll>
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {metrics.map(m => (
              <Card key={m.label} t={t}>
                <div style={{ fontSize: 11, color: t.sub, marginBottom: 6, fontFamily: FONT }}>{m.label}</div>
                <div style={{ fontSize: 23, fontWeight: 900, color: m.color, fontFamily: FONT }}>{m.value}</div>
              </Card>
            ))}
          </div>

          {/* Resultado discriminado por timeframe — clareza total do acumulado. */}
          {tfRows.length > 0 && (
            <Card t={t} style={{ marginBottom: 16 }}>
              <Label t={t} style={{ marginBottom: 4 }}>Resultado por timeframe</Label>
              <p style={{ fontSize: 11, color: t.sub, margin: "0 0 12px", lineHeight: 1.5, fontFamily: FONT }}>
                Acumulado de cada tempo gráfico e o geral (soma de todos).
              </p>
              {tfRows.map(({ label, d, accent }) => {
                const pos = d.pips >= 0;
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 0", borderTop: accent ? `1px solid ${t.bdr}` : "none" }}>
                    <span style={{ fontSize: 13, fontWeight: accent ? 800 : 700,
                      color: accent ? t.accent : t.text, fontFamily: FONT, width: 100 }}>{label}</span>
                    <span style={{ fontSize: 11.5, color: t.sub, fontFamily: FONT, flex: 1, textAlign: "center" }}>
                      {d.total} ops · {d.assert}%
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: pos ? t.buy : t.sell, fontFamily: FONT,
                      width: 96, textAlign: "right", whiteSpace: "nowrap" }}>
                      {pos ? "+" : ""}{d.pips} pips
                    </span>
                  </div>
                );
              })}
            </Card>
          )}

          <Card t={t} accent onClick={onTfPerf} style={{ marginBottom: 16, display: "flex",
            alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.text, fontFamily: FONT }}>Histórico por timeframe</div>
                <div style={{ fontSize: 11, color: t.sub, marginTop: 1, fontFamily: FONT }}>Veja qual tempo rende mais e escolha o melhor</div>
              </div>
            </div>
            <span style={{ color: t.accent, fontSize: 18 }}>›</span>
          </Card>

          {/* Curva de capital — pips acumulados do laudo (abaixo do histórico por tf). */}
          <EquityCurve t={t} closed={(live?.recentAll || []).map(mapSignal)} />

          {/* Bloco de marca (preenche o espaço; espaço reservado para logo/identidade). */}
          <div style={{ marginTop: 30, marginBottom: 8, display: "flex", flexDirection: "column",
            alignItems: "center", textAlign: "center", gap: 10, opacity: 0.92 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20,
              background: t.accentSoft, border: `2px solid ${t.accentBdr}`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BoltLogo t={t} size={36} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4, color: t.text, fontFamily: FONT }}>
              Infinity <span style={{ color: t.accent }}>Signals</span>
            </div>
            <div style={{ fontSize: 11.5, color: t.sub, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase" }}>
              Desempenho real · operações verificadas
            </div>
            <div style={{ fontSize: 10.5, color: t.muted, fontFamily: FONT, marginTop: 2 }}>
              © {new Date().getFullYear()} MrThiagoFX · Todos os direitos reservados
            </div>
          </div>

          {showMock && (<>
          <Card t={t} style={{ marginBottom: 12 }}>
            <Label t={t} style={{ marginBottom: 14 }}>Evolução — últimos 30 dias</Label>
            <svg width="100%" height={H+10} viewBox={`0 0 ${W} ${H+10}`} style={{ overflow: "visible" }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.blue} stopOpacity=".22" />
                  <stop offset="100%" stopColor={t.blue} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#perfGrad)" />
              <polyline points={pts} fill="none" stroke={t.blue} strokeWidth="2.5" strokeLinejoin="round" />
              {[0, lineData.length-1].map(i => {
                const x=(i/(lineData.length-1))*W, y=H-(lineData[i]/maxV)*(H-8);
                return <circle key={i} cx={x} cy={y} r={4} fill={t.blue} />;
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              {["Jan","Fev","Mar","Abr","Mai","Jun"].map(m => (
                <span key={m} style={{ fontSize: 10, color: t.muted, fontFamily: FONT }}>{m}</span>
              ))}
            </div>
          </Card>
          <Card t={t}>
            <Label t={t} style={{ marginBottom: 14 }}>Assertividade por ativo</Label>
            {selectedAssets.map(a => {
              const v = perAsset[a] || 60;
              return (
                <div key={a} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AssetIcon asset={a} size={22} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: FONT }}>{a}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: FONT,
                      color: v>=75 ? t.accent : v>=65 ? t.blue : t.warn }}>{v}%</span>
                  </div>
                  <Bar pct={v} color={v>=75 ? t.accent : v>=65 ? t.blue : t.warn} t={t} />
                </div>
              );
            })}
          </Card>
          </>)}
        </div>
      </Scroll>
      <BottomNav active="performance" onNav={onNav} t={t} />
    </div>
  );
};

const History = ({ t, onNav, onOpenSignal, onToggleTheme, schedule, live, stats, plan }) => {
  const [tab, setTab] = useState("Todos");
  const [period, setPeriod] = useState("Mês");
  const [tfStats, setTfStats] = useState("Geral"); // Filtro simples: Geral, M5, M15
  const [limit, setLimit] = useState(40);
  // Ao trocar período/filtro, recomeça a paginação.
  useEffect(() => { setLimit(40); }, [period, tab, tfStats]);

  // LAUDO oficial da ferramenta — track record COMPLETO (todos os ativos/tf),
  // IGUAL para todos os usuários. Usa `recentAll` (não filtra por plano).
  const closed = (live?.recentAll || live?.recent || [])
    .filter(r => r.status === "ganho" || r.status === "perda")
    .map(mapSignal);
  // Filtra pelo PERÍODO. "Hoje" = dia do mercado (zera 21:00 BRT).
  const periodStart = period === "Hoje" ? forexDayStartMs()
    : period === "Semana" ? Date.now() - 7 * 86400000
    : period === "Mês" ? Date.now() - 30 * 86400000 : 0;
  const periodLbl = period === "Hoje" ? "hoje"
    : period === "Semana" ? "últimos 7 dias"
    : period === "Mês" ? "últimos 30 dias" : "últimos 90 dias";
  const inPeriod = closed.filter(s => (s.ts || 0) >= periodStart);
  // Filtro simples por timeframe (Geral/M5/M15) — só nos números do resumo.
  const byTf = tfStats === "Geral" ? inPeriod : inPeriod.filter(s => s.tf === tfStats);
  const shown = inPeriod
    .filter(s => tab === "Todos" || (tab === "Ganhos" ? s.status === "ganho" : s.status === "perda"))
    .sort(sortSignals);
  const visible = shown.slice(0, limit);

  // TOTAIS do resumo: se tem filtro por TF, calcula da lista; senão usa stats pré-agregado.
  const useFiltered = tfStats !== "Geral"; // se tem filtro, calcula na mão
  const rec = !useFiltered && (period === "Hoje" ? stats?.dia
    : period === "Semana" ? stats?.semana
    : period === "Mês" ? stats?.mes : stats?.trimestre);
  const wins = rec ? rec.ganhos : byTf.filter(s => s.status === "ganho").length;
  const losses = rec ? rec.perdas : byTf.filter(s => s.status === "perda").length;
  const total = rec ? rec.pips : byTf.reduce((a, s) => a + (s.resultPips || 0), 0);
  const opsCount = rec ? rec.total : byTf.length;
  const winRate = rec ? rec.assertividade
    : ((wins + losses) ? Math.round((wins / (wins + losses)) * 100) : 0);
  const schedTxt = schedule.allDay ? "dia todo" : `${schedule.start}–${schedule.end}`;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Histórico" t={t} onToggleTheme={onToggleTheme} />
      <div style={{ padding: "0 24px", flexShrink: 0 }}>
        {/* Período: Hoje / Semana / Mês */}
        <Label t={t} style={{ marginBottom: 8 }}>Período</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {["Hoje", "Semana", "Mês", "3 meses"].map(x => (
            <Chip key={x} label={x} active={period === x} onClick={() => setPeriod(x)} t={t} />
          ))}
        </div>
        {/* Resultado: Todos / Ganhos / Perdas */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {["Todos","Ganhos","Perdas"].map(x => (
            <Chip key={x} label={x} active={tab === x} onClick={() => setTab(x)} t={t} />
          ))}
        </div>
        <Card t={t} style={{ marginBottom: 12, padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: t.text, fontWeight: 700, fontFamily: FONT }}>
                {period} · {opsCount} operações
              </span>
              {/* Dropdown simples: Geral / M5 / M15 (ícone relógio) */}
              <select value={tfStats} onChange={(e) => setTfStats(e.target.value)}
                style={{
                  background: t.card, border: `1px solid ${t.bdr}`, borderRadius: 8,
                  color: t.text, fontSize: 12, padding: "4px 8px", fontFamily: FONT,
                  cursor: "pointer"
                }}>
                <option value="Geral">⏱️ Geral</option>
                <option value="M5">⏱️ M5</option>
                <option value="M15">⏱️ M15</option>
              </select>
            </div>
            <span style={{ fontSize: 16, fontWeight: 900,
              color: total >= 0 ? t.buy : t.sell, fontFamily: FONT }}>
              {total >= 0 ? "+" : ""}{total} pips
            </span>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 5 }}>
            <span style={{ fontSize: 12.5, color: t.buy, fontWeight: 800, fontFamily: FONT }}>✓ {wins} ganhos</span>
            <span style={{ fontSize: 12.5, color: t.sell, fontWeight: 800, fontFamily: FONT }}>✗ {losses} perdas</span>
            <span style={{ fontSize: 12.5, color: t.accent, fontWeight: 800, fontFamily: FONT }}>{winRate}% acerto</span>
          </div>
          <p style={{ fontSize: 11, color: t.muted, margin: 0, fontFamily: FONT }}>
            📅 {periodLbl} · 📊 laudo da ferramenta (todos os ativos e timeframes)
          </p>
        </Card>
      </div>
      <Scroll style={{ padding: "0 24px" }}>
        {shown.length === 0 ? (
          <Card t={t} style={{ textAlign: "center", padding: "28px 18px" }}>
            <p style={{ fontSize: 13, color: t.sub, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
              Nenhuma operação no período.<br />Seu histórico aparece aqui conforme os sinais são fechados.
            </p>
          </Card>
        ) : (<>
          {visible.map((s, i) => (
            <SignalRow key={s.id ?? i} s={s} t={t} pips={s.resultPips}
              onClick={() => { onOpenSignal(s); onNav("signal-detail"); }} />
          ))}
          {shown.length > visible.length && (
            <button onClick={() => setLimit(l => l + 40)} style={{
              width: "100%", padding: "12px", marginTop: 4, cursor: "pointer",
              background: t.card, border: `1px solid ${t.bdr}`, borderRadius: 14,
              color: t.accent, fontSize: 13, fontWeight: 800, fontFamily: FONT }}>
              Carregar mais ({shown.length - visible.length} restantes)
            </button>
          )}
        </>)}
        <div style={{ height: 16 }} />
      </Scroll>
      <BottomNav active="history" onNav={onNav} t={t} />
    </div>
  );
};

const Notifications = ({ t, onNav, onBack, onToggleTheme, schedule, plan, selectedAssets = [], tfPerAsset = {} }) => {
  // Preferências de notificação — persistem no aparelho (não resetam ao voltar).
  const [tog, setTog] = useState(() => {
    const def = { rt: true, daily: true, fav: true, sound: true };
    try { return { ...def, ...JSON.parse(localStorage.getItem("tfx_notif") || "{}") }; }
    catch { return def; }
  });
  const setTogV = (id, v) => setTog(s => {
    const n = { ...s, [id]: v };
    try { localStorage.setItem("tfx_notif", JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  const [expanded, setExpanded] = useState(null);
  const schedTxt = schedule.allDay ? "Dia todo" : `${schedule.start} – ${schedule.end}`;
  const isFree = plan === "free";
  const ativosTxt = selectedAssets.length
    ? selectedAssets.map(a => `${a} (${(tfPerAsset[a] || []).join("/") || "—"})`).join(", ")
    : "nenhum ativo selecionado";
  const toggles = [
    { id: "rt",    label: "Sinais em tempo real", sub: "Alerta assim que o sinal for detectado" },
    { id: "daily", label: "Boletim diário",        sub: "Resumo do dia, enviado às 21:00 (fecha o dia do mercado)" },
    { id: "fav",   label: "Sinais favoritos",       sub: "Notificações dos ativos preferidos" },
    { id: "sound", label: "Som e vibração",         sub: "Feedback tátil ao receber alertas" },
  ];
  const expandables = [
    { id: "horario", label: "Horário de envio",
      body: isFree
        ? "Plano Free: horários fixos (04:00 · 10:30 · 15:00 · 21:00). Faça upgrade para personalizar."
        : `Janela atual: ${schedTxt}. Para alterar, acesse Perfil → Horário de sinais.` },
    { id: "fav2",    label: "Alerta de fechamento (⭐ por operação)",
      body: "Você recebe a notificação de ENTRADA de todos os sinais. Toque na ⭐ de uma operação em andamento (no Início ou em Sinais) para ser avisado quando ELA fechar (TP/Stop). Sem a estrela, você não recebe o alerta de fechamento daquela operação." },
    { id: "ativos",  label: "Ativos monitorados",
      body: isFree
        ? "Free recebe sinais sortidos dos 5 ativos. No Premium você escolhe."
        : `Você monitora: ${ativosTxt}.` },
    { id: "diaforex", label: "Por que o dia zera às 21:00?",
      body: "O mercado Forex vira o dia à meia-noite do horário do mercado, que dá 21:00 no Brasil. Por isso o contador 'Hoje' zera todo dia às 21:00 e reinicia na hora — e o boletim diário é enviado nesse momento, fechando o resultado do dia que terminou. As estatísticas de Semana e Mês não zeram, só acumulam." },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Scroll>
        <div style={{ padding: "16px 24px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <BackBtn onClick={onBack} t={t} />
            <ThemeToggle t={t} onToggle={onToggleTheme} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 20px", letterSpacing: -0.5,
            color: t.text, fontFamily: FONT }}>Notificações</h1>
          {toggles.map(({ id, label, sub }) => (
            <Card key={id} t={t} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, marginRight: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: t.text, marginBottom: 3, fontFamily: FONT }}>{label}</div>
                <div style={{ fontSize: 11, color: t.sub, lineHeight: 1.45, fontFamily: FONT }}>{sub}</div>
              </div>
              <Toggle on={tog[id]} onChange={v => setTogV(id, v)} t={t} />
            </Card>
          ))}
          <Label t={t} style={{ marginTop: 22, marginBottom: 12 }}>Mais opções</Label>
          {expandables.map(({ id, label, body }) => {
            const open = expanded === id;
            return (
              <div key={id} style={{ marginBottom: 8 }}>
                <Card t={t} onClick={() => setExpanded(open ? null : id)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, color: t.text, fontWeight: 600, fontFamily: FONT }}>{label}</span>
                  <span style={{ color: t.sub, fontSize: 18, transition: "transform .2s",
                    transform: open ? "rotate(90deg)" : "none" }}>›</span>
                </Card>
                {open && (
                  <div style={{ background: t.bg2, border: `1px solid ${t.bdr}`, borderTop: "none",
                    borderRadius: "0 0 14px 14px", padding: "12px 16px", marginTop: -6 }}>
                    <p style={{ fontSize: 12, color: t.sub, lineHeight: 1.6, margin: 0, fontFamily: FONT }}>{body}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Scroll>
      <BottomNav active="profile" onNav={onNav} t={t} />
    </div>
  );
};

// Central de notificações in-app: feed das ENTRADAS e CONCLUSÕES (TP/Stop) dos
// sinais do usuário — derivado de live.recent (não precisa de tabela nova).
const NotifCenter = ({ t, onNav, onBack, onToggleTheme, onOpenSignal, live }) => {
  const fmtBRT = (ms) => new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(ms)).replace(",", " ·");

  const events = [];
  for (const s of (live?.recent || [])) {
    const created = new Date(s.created_at).getTime();
    events.push({ id: `${s.signal_id || s.id}-o`, kind: "entrada", sig: s,
      asset: s.asset, dir: s.direction, tf: s.tf, ts: created });
    if (s.status === "ganho" || s.status === "perda") {
      const closedTs = s.closed_at ? new Date(s.closed_at).getTime() : created;
      events.push({ id: `${s.signal_id || s.id}-c`, kind: "fechamento", sig: s,
        asset: s.asset, dir: s.direction, tf: s.tf, ts: closedTs,
        win: s.status === "ganho", pips: s.result_pips });
    }
  }
  events.sort((a, b) => b.ts - a.ts);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Notificações" t={t} onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        {events.length === 0 ? (
          <Card t={t} style={{ textAlign: "center", padding: "28px 18px" }}>
            <p style={{ fontSize: 13, color: t.sub, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
              Nenhuma notificação ainda.<br />Os alertas de entrada e de fechamento aparecem aqui.
            </p>
          </Card>
        ) : events.map((e) => {
          const entrada = e.kind === "entrada";
          const buy = e.dir === "Compra";
          const icon = entrada ? (buy ? "🟢" : "🔴") : (e.win ? "✅" : "❌");
          const title = entrada
            ? `Nova entrada · ${e.asset}`
            : `Fechou · ${e.asset}`;
          const sub = entrada
            ? `${e.dir} · ${e.tf}`
            : `${e.win ? "Alvo (TP)" : "Stop"} · ${e.pips >= 0 ? "+" : ""}${e.pips} pips`;
          const col = entrada ? t.text : (e.win ? t.buy : t.sell);
          return (
            <div key={e.id} onClick={() => { onOpenSignal(mapSignal(e.sig)); onNav("signal-detail"); }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                marginBottom: 8, background: t.card, border: `1px solid ${t.bdr}`,
                borderRadius: 14, cursor: "pointer" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: col, fontFamily: FONT }}>{title}</div>
                <div style={{ fontSize: 11.5, color: t.sub, fontFamily: FONT, marginTop: 1 }}>{sub}</div>
              </div>
              <span style={{ fontSize: 10.5, color: t.muted, fontFamily: FONT, flexShrink: 0, whiteSpace: "nowrap" }}>
                {fmtBRT(e.ts)}
              </span>
            </div>
          );
        })}
        <div style={{ height: 16 }} />
      </Scroll>
      <BottomNav active="home" onNav={onNav} t={t} />
    </div>
  );
};

// Central de ajuda / FAQ — conteúdo estático com perguntas expansíveis.
const FAQ_ITEMS = [
  { q: "O que é o Infinity Signals?",
    a: "É uma ferramenta que detecta oportunidades operacionais (sinais) no MetaTrader com indicadores técnicos e te avisa em tempo real — para XAUUSD (ouro), US30 e NAS100, nos tempos gráficos M5 e M15. São estudos operacionais de caráter informativo, não recomendação de investimento." },
  { q: "Como eu recebo os sinais?",
    a: "Por notificação (push) assim que o sinal é detectado, e na tela Sinais/Início do app. Ative as notificações em Perfil → Ajustes de notificação e permita o envio quando o app pedir." },
  { q: "O que significa \"Em andamento\"?",
    a: "A operação foi aberta e está rodando, aguardando bater o Alvo (TP) ou o Stop (SL). O próximo sinal do mesmo ativo só abre quando essa fechar. Quando fecha, você vê o resultado em pips." },
  { q: "O que é TP (Alvo) e Stop (SL)?",
    a: "TP (Take Profit / Alvo) é o preço onde a operação fecha no lucro. Stop (SL) é onde fecha no prejuízo, limitando a perda. Todo sinal vem com Entrada, Alvo e Stop definidos." },
  { q: "Qual a diferença entre Free e Premium?",
    a: "No Free você recebe alguns sinais por dia, em horários fixos. No Premium (mensal/anual) você recebe até 20 por dia e escolhe os ativos e timeframes que quer acompanhar." },
  { q: "Por que o dia zera às 21:00?",
    a: "O mercado Forex vira o dia à meia-noite do horário do mercado, que dá 21:00 no Brasil. Por isso o contador \"Hoje\" zera às 21:00 e o boletim diário é enviado nesse momento, fechando o resultado do dia. Semana e Mês não zeram, só acumulam." },
  { q: "O que é o laudo e a curva de capital?",
    a: "O laudo é o histórico oficial e completo da ferramenta (todos os sinais, igual para todos). A curva de capital mostra os pips acumulados ao longo do tempo — a evolução do desempenho. Você vê em Desempenho e Histórico." },
  { q: "Os resultados são garantidos?",
    a: "Não. Desempenho passado NÃO garante resultados futuros. Operar envolve risco de perda. Os sinais são estudos operacionais informativos e não constituem recomendação de investimento (conforme normas da CVM). Opere com responsabilidade." },
  { q: "Como troco ou cancelo meu plano?",
    a: "Para mudar de ativos/timeframes: Perfil → Editar ativos. Para cancelar e voltar ao Free: Perfil → Cancelar plano. Ao vencer sem renovar, sua conta volta automaticamente ao Free." },
];

const Faq = ({ t, onNav, onBack, onToggleTheme, onSupport }) => {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Central de ajuda" t={t} onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        <p style={{ fontSize: 12.5, color: t.sub, margin: "0 0 14px", lineHeight: 1.5, fontFamily: FONT }}>
          Dúvidas frequentes sobre os sinais e o app. Toque para expandir.
        </p>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div onClick={() => setOpen(isOpen ? null : i)} style={{
                background: t.card, border: `1px solid ${isOpen ? t.accentBdr : t.bdr}`,
                borderRadius: isOpen ? "14px 14px 0 0" : 14, padding: "13px 15px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text, fontFamily: FONT }}>{item.q}</span>
                <span style={{ color: t.sub, fontSize: 18, lineHeight: 1, flexShrink: 0,
                  transition: "transform .2s", transform: isOpen ? "rotate(90deg)" : "none" }}>›</span>
              </div>
              {isOpen && (
                <div style={{ background: t.bg2, border: `1px solid ${t.accentBdr}`, borderTop: "none",
                  borderRadius: "0 0 14px 14px", padding: "12px 15px" }}>
                  <p style={{ fontSize: 12.5, color: t.sub, lineHeight: 1.65, margin: 0, fontFamily: FONT }}>{item.a}</p>
                </div>
              )}
            </div>
          );
        })}
        <Card t={t} style={{ marginTop: 14, marginBottom: 16, textAlign: "center", padding: "18px 16px" }}>
          <p style={{ fontSize: 13, color: t.text, margin: "0 0 12px", fontWeight: 700, fontFamily: FONT }}>
            Não achou sua resposta?
          </p>
          <Btn t={t} onClick={onSupport}>💬 Falar com o suporte</Btn>
        </Card>
        <div style={{ height: 16 }} />
      </Scroll>
      <BottomNav active="home" onNav={onNav} t={t} />
    </div>
  );
};

const AvatarCircle = ({ url, t, size = 62, fontSize = 30 }) => (
  url ? (
    <img src={url} alt="" style={{ width: size, height: size, borderRadius: size * 0.32,
      objectFit: "cover", flexShrink: 0, border: `2px solid ${t.accentBdr}` }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0,
      background: t.accentSoft, border: `2px solid ${t.accentBdr}`,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize }}>👤</div>
  )
);

const EditProfile = ({ t, onToggleTheme, onBack, onNav, onUpgrade, plan, profile, userEmail, onSaved }) => {
  const [name, setName] = useState(profile.name || "");
  const [username, setUsername] = useState(profile.username || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(userEmail || "");
  const [avatar, setAvatar] = useState(profile.avatar_url || "");
  const [newAvatarData, setNewAvatarData] = useState(null);
  const [referralCode, setReferralCode] = useState(profile.referral_code || "");
  const [newPass, setNewPass] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const changePass = async () => {
    if (newPass.length < 6) { setPwMsg("A senha precisa de ao menos 6 caracteres."); return; }
    setPwBusy(true); setPwMsg("");
    const r = await api.updatePassword(newPass);
    setPwBusy(false);
    setPwMsg(r.ok ? "✓ Senha alterada com sucesso." : (r.error || "Não foi possível alterar."));
    if (r.ok) setNewPass("");
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const info = PLAN_INFO[plan];

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        const data = c.toDataURL("image/jpeg", 0.85);
        setAvatar(data); setNewAvatarData(data);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true); setMsg("");
    let avatarUrl = profile.avatar_url;
    if (newAvatarData) {
      const up = await api.uploadAvatar(newAvatarData);
      if (!up.ok) { setBusy(false); setMsg(up.error || "Falha ao enviar a foto."); return; }
      avatarUrl = up.url;
    }
    const fields = { name, username, phone, avatar_url: avatarUrl };
    const rc = referralCode.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (rc) fields.referral_code = rc;
    const r = await api.updateProfileFields(fields);
    if (!r.ok && /duplicate|unique/i.test(r.error || "")) {
      setBusy(false); setMsg("Esse código de convite já está em uso. Escolha outro."); return;
    }
    let extra = "";
    if (email && email !== userEmail) {
      const er = await api.updateEmail(email);
      extra = er.ok ? " Confirme o novo e-mail na caixa de entrada." : ` (e-mail não trocou: ${er.error})`;
    }
    setBusy(false);
    if (r.ok) {
      setMsg("✓ Perfil salvo." + extra);
      onSaved?.({ name, username, phone, avatar_url: avatarUrl, ...(rc ? { referral_code: rc } : {}) });
    } else setMsg(r.error || "Não foi possível salvar.");
  };

  const field = (label, value, set, props = {}) => (
    <div style={{ marginBottom: 14 }}>
      <Label t={t} style={{ marginBottom: 6 }}>{label}</Label>
      <input value={value} onChange={e => set(e.target.value)} {...props}
        style={{ width: "100%", height: 50, background: t.card, border: `1.5px solid ${t.bdr}`,
          borderRadius: 14, padding: "0 16px", color: t.text, fontSize: 14, fontFamily: FONT, outline: "none" }} />
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Editar perfil" t={t} onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <AvatarCircle url={avatar} t={t} size={92} fontSize={42} />
          <label style={{ cursor: "pointer", color: t.accent, fontSize: 13, fontWeight: 800, fontFamily: FONT }}>
            📷 Trocar foto
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} style={{ display: "none" }} />
          </label>
        </div>

        {field("Nome completo", name, setName, { placeholder: "Seu nome" })}
        {field("Usuário", username, setUsername, { placeholder: "@usuario" })}
        {field("E-mail", email, setEmail, { type: "email", placeholder: "seu@email.com" })}
        {field("Telefone / WhatsApp", phone, setPhone, { placeholder: "(00) 00000-0000" })}

        <div style={{ marginBottom: 14 }}>
          <Label t={t} style={{ marginBottom: 6 }}>Seu código de convite</Label>
          <input value={referralCode} placeholder="ex.: mrthiago"
            onChange={e => setReferralCode(e.target.value)}
            style={{ width: "100%", height: 50, background: t.card, border: `1.5px solid ${t.bdr}`,
              borderRadius: 14, padding: "0 16px", color: t.text, fontSize: 14, fontFamily: FONT, outline: "none" }} />
          <p style={{ fontSize: 11, color: t.muted, margin: "6px 2px 0", fontFamily: FONT }}>
            É o que vai no seu link de convite (`/?ref=seucódigo`). Só letras e números.
          </p>
        </div>

        <Label t={t} style={{ marginBottom: 6 }}>Plano</Label>
        <Card t={t} onClick={onUpgrade} style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 8, cursor: "pointer" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text, fontFamily: FONT }}>{info.name}</div>
            <div style={{ fontSize: 11, color: t.muted, fontFamily: FONT }}>{info.price}</div>
          </div>
          <span style={{ color: t.accent, fontSize: 13, fontWeight: 800, fontFamily: FONT }}>Mudar ›</span>
        </Card>

        <Label t={t} style={{ margin: "8px 0 6px" }}>🔑 Trocar senha</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="password" value={newPass} placeholder="Nova senha (mín. 6)"
            onChange={e => setNewPass(e.target.value)}
            style={{ flex: 1, minWidth: 0, height: 46, background: t.card,
              border: `1.5px solid ${t.bdr}`, borderRadius: 12, padding: "0 14px",
              color: t.text, fontSize: 14, fontFamily: FONT, outline: "none" }} />
          <button onClick={changePass} disabled={pwBusy} style={{
            flexShrink: 0, height: 46, padding: "0 16px", borderRadius: 12,
            cursor: pwBusy ? "default" : "pointer", fontWeight: 800, fontSize: 13,
            fontFamily: FONT, border: "none", background: t.accent, color: t.activeText,
            opacity: pwBusy ? 0.5 : 1 }}>{pwBusy ? "..." : "Trocar"}</button>
        </div>
        {pwMsg && (
          <p style={{ margin: "8px 0 0", fontSize: 12, fontFamily: FONT,
            color: pwMsg.startsWith("✓") ? t.buy : t.sell }}>{pwMsg}</p>
        )}

        {msg && (
          <p style={{ margin: "12px 0 0", fontSize: 12.5, fontFamily: FONT,
            color: msg.startsWith("✓") ? t.buy : t.sell }}>{msg}</p>
        )}
        <div style={{ height: 14 }} />
      </Scroll>
      <div style={{ padding: "12px 24px 28px", flexShrink: 0 }}>
        <Btn t={t} onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</Btn>
      </div>
    </div>
  );
};

const AdminPanel = ({ t, onNav, onBack, onToggleTheme }) => {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [histDate, setHistDate] = useState("");
  const [freeQuota, setFreeQuota] = useState(4);
  const [alunoCoupon, setAlunoCoupon] = useState("");
  const [q, setQ] = useState("");
  const PLANS = ["free", "mensal", "anual", "aluno", "influencer"];
  const fmtExp = (iso) => {
    if (!iso) return "sem limite";
    const d = new Date(iso);
    const dias = Math.ceil((d.getTime() - Date.now()) / 86400000);
    return `${d.toLocaleDateString("pt-BR")} (${dias > 0 ? dias + "d" : "vencido"})`;
  };

  useEffect(() => {
    let alive = true;
    api.adminList().then(d => { if (alive && d) {
      setData(d);
      setHistDate(d.settings?.history_start_date?.slice(0, 10) || "");
      setFreeQuota(d.settings?.free_quota || 4);
      setAlunoCoupon(d.settings?.aluno_coupon || "");
    } });
    return () => { alive = false; };
  }, []);

  const saveFreeQuota = async (v) => {
    setFreeQuota(v);
    const r = await api.adminSetFreeQuota(v);
    setMsg(r.ok ? `✓ Cota Free = ${v} operações/dia` : (r.error || "erro"));
    setTimeout(() => setMsg(""), 2500);
  };

  const saveAlunoCoupon = async () => {
    const r = await api.adminSetAlunoCoupon(alunoCoupon);
    if (r.ok) setAlunoCoupon(r.aluno_coupon || "");
    setMsg(r.ok ? (r.aluno_coupon ? `✓ Cupom de aluno: ${r.aluno_coupon}` : "✓ Cupom de aluno removido") : (r.error || "erro"));
    setTimeout(() => setMsg(""), 2800);
  };

  const closeStuck = async (signalId, outcome) => {
    const r = await api.adminCloseStuck(signalId, outcome);
    if (r.ok) setData(d => ({ ...d, openSignals: (d.openSignals || []).filter(s => s.signal_id !== signalId) }));
    setMsg(r.ok ? `✓ Reconciliado: ${outcome === "tp" ? "TP" : "STOP"} (${r.result_pips >= 0 ? "+" : ""}${r.result_pips} pips)` : (r.error || "erro"));
    setTimeout(() => setMsg(""), 2800);
  };
  const hrs = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);

  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const runCheck = async (rebuild) => {
    setChecking(true);
    const r = await api.adminSelfcheck(rebuild);
    setChecking(false);
    setHealth(r);
    setMsg(r.ok ? "✓ Sistema íntegro" : (r.reconstruido ? "✓ Laudo reconstruído (estava divergente)" : (r.error || "verificado")));
    setTimeout(() => setMsg(""), 3000);
  };

  const setExpiry = async (userId, days) => {
    const r = await api.adminSetExpiry(userId, days);
    setMsg(r.ok ? (days > 0 ? `✓ Validade: +${days} dias` : "✓ Sem limite") : (r.error || "erro"));
    if (r.ok) setData(d => ({ ...d, users: d.users.map(u => u.id === userId ? { ...u, plan_expires_at: r.plan_expires_at } : u) }));
    setTimeout(() => setMsg(""), 2000);
  };

  const setPlan = async (userId, plan) => {
    const r = await api.adminSetPlan(userId, plan);
    setMsg(r.ok ? "✓ Plano atualizado" : (r.error || "erro"));
    if (r.ok) setData(d => ({ ...d, users: d.users.map(u => u.id === userId ? { ...u, plan } : u) }));
    setTimeout(() => setMsg(""), 2000);
  };
  const saveHist = async () => {
    const iso = histDate ? new Date(histDate + "T00:00:00").toISOString() : null;
    const r = await api.adminSetHistory(iso);
    setMsg(r.ok ? "✓ Data de ativação salva" : (r.error || "erro"));
    setTimeout(() => setMsg(""), 2500);
  };

  const users = (data?.users || []).filter(u =>
    !q || `${u.email} ${u.name} ${u.referral_code}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <ScreenHeader title="Painel admin" t={t} onToggleTheme={onToggleTheme} onBack={onBack} />
      <Scroll style={{ padding: "0 24px" }}>
        {msg && (
          <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 700, fontFamily: FONT,
            color: msg.startsWith("✓") ? t.buy : t.sell }}>{msg}</p>
        )}

        <Card t={t} accent style={{ marginBottom: 14 }}>
          <Label t={t} style={{ marginBottom: 8 }}>🗓️ Ativação do histórico</Label>
          <p style={{ fontSize: 11.5, color: t.sub, margin: "0 0 10px", lineHeight: 1.5, fontFamily: FONT }}>
            Desempenho/Histórico contam só a partir desta data (descarta o período de teste). Vazio = conta tudo.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" value={histDate} onChange={e => setHistDate(e.target.value)}
              style={{ flex: 1, height: 44, background: t.card, border: `1.5px solid ${t.bdr}`,
                borderRadius: 12, padding: "0 12px", color: t.text, fontSize: 14, fontFamily: FONT, outline: "none" }} />
            <button onClick={saveHist} style={{ flexShrink: 0, height: 44, padding: "0 16px", borderRadius: 12,
              cursor: "pointer", fontWeight: 800, fontSize: 13, fontFamily: FONT, border: "none",
              background: t.accent, color: t.activeText }}>Salvar</button>
          </div>
        </Card>

        <Card t={t} accent style={{ marginBottom: 14 }}>
          <Label t={t} style={{ marginBottom: 8 }}>🩺 Saúde do sistema (laudo)</Label>
          <p style={{ fontSize: 11.5, color: t.sub, margin: "0 0 10px", lineHeight: 1.5, fontFamily: FONT }}>
            Recomputa o laudo a partir dos sinais e compara. Se divergir, reconstrói sozinho. Roda automático todo dia; aqui você força na hora.
          </p>
          {health && (
            <div style={{ marginBottom: 10, background: t.card, border: `1px solid ${health.ok ? t.buy : t.warn}55`,
              borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: health.ok ? t.buy : t.warn, fontFamily: FONT, marginBottom: 4 }}>
                {health.ok ? "✓ Tudo íntegro e consistente" : "⚠️ Corrigido / atenção"}
              </div>
              <div style={{ fontSize: 11, color: t.sub, fontFamily: FONT, lineHeight: 1.6 }}>
                Divergências: <b style={{ color: t.text }}>{health.divergencias ?? "—"}</b>{health.reconstruido ? " (reconstruído ✓)" : ""} ·
                Presas: <b style={{ color: (health.presas ? t.warn : t.text) }}>{health.presas ?? "—"}</b><br />
                {health.auto_resolvidas > 0 && (<>Auto-encerradas (+24h): <b style={{ color: t.warn }}>{health.auto_resolvidas}</b><br /></>)}
                Fechados: <b style={{ color: t.text }}>{health.fechados ?? "—"}</b> · Laudo: <b style={{ color: t.buy }}>{health.laudo_pips >= 0 ? "+" : ""}{health.laudo_pips} pips</b>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => runCheck(false)} disabled={checking} style={{
              flex: 1, height: 44, borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 13,
              fontFamily: FONT, border: `1.5px solid ${t.accent}`, background: "transparent", color: t.accent }}>
              {checking ? "Verificando…" : "Verificar agora"}</button>
            <button onClick={() => runCheck(true)} disabled={checking} style={{
              flex: 1, height: 44, borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 13,
              fontFamily: FONT, border: "none", background: t.accent, color: t.activeText }}>
              Reconstruir laudo</button>
          </div>
        </Card>

        <Card t={t} accent style={{ marginBottom: 14 }}>
          <Label t={t} style={{ marginBottom: 8 }}>🩺 Monitoramento de erros</Label>
          <p style={{ fontSize: 11.5, color: t.sub, margin: "0 0 10px", lineHeight: 1.5, fontFamily: FONT }}>
            Últimas falhas 500 registradas nas APIs. Se estiver vazio, está tudo rodando sem erros.
          </p>
          {(() => {
            const errs = data?.errors || [];
            if (errs.length === 0) {
              return (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.buy, fontFamily: FONT,
                  background: t.card, border: `1px solid ${t.buy}44`, borderRadius: 12, padding: "10px 12px" }}>
                  ✓ Nenhum erro registrado
                </div>
              );
            }
            return (
              <>
                {errs.slice(0, 8).map((e) => (
                  <div key={e.id} style={{ marginBottom: 6, background: t.card, border: `1px solid ${t.warn}44`,
                    borderRadius: 10, padding: "8px 11px" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: t.warn, fontFamily: FONT }}>{e.context || "erro"}</div>
                    <div style={{ fontSize: 10.5, color: t.sub, fontFamily: FONT, lineHeight: 1.5, wordBreak: "break-word" }}>
                      {e.detail || "—"}
                    </div>
                    <div style={{ fontSize: 9.5, color: t.muted, fontFamily: FONT, marginTop: 2 }}>
                      {e.ts ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(e.ts)) : ""}
                    </div>
                  </div>
                ))}
                <button onClick={async () => {
                  const r = await api.adminClearErrors();
                  if (r.ok) setData((prev) => ({ ...prev, errors: [] }));
                }} style={{
                  width: "100%", height: 40, marginTop: 10, borderRadius: 10, cursor: "pointer",
                  fontWeight: 700, fontSize: 12, fontFamily: FONT, border: "none",
                  background: t.accent, color: t.activeText }}>
                  🗑️ Limpar erros
                </button>
              </>
            );
          })()}
        </Card>

        <Card t={t} accent style={{ marginBottom: 14 }}>
          <Label t={t} style={{ marginBottom: 8 }}>🎁 Operações grátis por dia (Free)</Label>
          <p style={{ fontSize: 11.5, color: t.sub, margin: "0 0 10px", lineHeight: 1.5, fontFamily: FONT }}>
            Define quantas operações os usuários Free recebem nesta semana (2 a 4). Vale pra todos do plano Free.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {[2, 3, 4].map(v => (
              <button key={v} onClick={() => saveFreeQuota(v)} style={{
                flex: 1, height: 44, borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 15,
                fontFamily: FONT, border: `1.5px solid ${freeQuota === v ? t.accent : t.bdr}`,
                background: freeQuota === v ? t.accent : "transparent",
                color: freeQuota === v ? t.activeText : t.text }}>{v}</button>
            ))}
          </div>
        </Card>

        <Card t={t} accent style={{ marginBottom: 14 }}>
          <Label t={t} style={{ marginBottom: 8 }}>🎓 Cupom de aluno</Label>
          <p style={{ fontSize: 11.5, color: t.sub, margin: "0 0 10px", lineHeight: 1.5, fontFamily: FONT }}>
            Quem se cadastrar com este cupom vira <span style={{ fontWeight: 700, color: t.text }}>aluno por 15 dias</span> automático. Depois você muda pra "sem limite" no usuário. Vazio = desativa.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={alunoCoupon} placeholder="ex.: aluno2026" onChange={e => setAlunoCoupon(e.target.value)}
              style={{ flex: 1, height: 44, background: t.card, border: `1.5px solid ${t.bdr}`,
                borderRadius: 12, padding: "0 14px", color: t.text, fontSize: 14, fontFamily: FONT, outline: "none" }} />
            <button onClick={saveAlunoCoupon} style={{ flexShrink: 0, height: 44, padding: "0 16px", borderRadius: 12,
              cursor: "pointer", fontWeight: 800, fontSize: 13, fontFamily: FONT, border: "none",
              background: t.accent, color: t.activeText }}>Salvar</button>
          </div>
        </Card>

        {(data?.openSignals || []).length > 0 && (
          <Card t={t} accent style={{ marginBottom: 14 }}>
            <Label t={t} style={{ marginBottom: 8 }}>🔧 Operações abertas (reconciliar)</Label>
            <p style={{ fontSize: 11.5, color: t.sub, margin: "0 0 10px", lineHeight: 1.5, fontFamily: FONT }}>
              Se o CLOSE se perdeu (EA reiniciou), feche aqui pelo que aconteceu na VPS. Acima de 12h some do app sozinho.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.openSignals.map(s => {
                const old = hrs(s.created_at) >= 12;
                return (
                  <div key={s.id} style={{ background: t.card, border: `1px solid ${old ? t.warn : t.bdr}`,
                    borderRadius: 12, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: t.text, fontFamily: FONT }}>
                        {s.asset} {s.tf} · {s.dir}
                      </span>
                      <span style={{ fontSize: 10.5, color: old ? t.warn : t.muted, fontWeight: 700, fontFamily: FONT }}>
                        {hrs(s.created_at)}h {old ? "⚠️" : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: t.sub, marginBottom: 8, fontFamily: FONT }}>
                      entrada {s.entry} · alvo {s.tp} · stop {s.sl}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => closeStuck(s.signal_id, "tp")} style={{ flex: 1, height: 38, borderRadius: 10,
                        cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FONT, border: "none",
                        background: t.buy, color: "#04130B" }}>✓ Bateu TP</button>
                      <button onClick={() => closeStuck(s.signal_id, "sl")} style={{ flex: 1, height: 38, borderRadius: 10,
                        cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: FONT, border: "none",
                        background: t.sell, color: "#fff" }}>✗ Bateu Stop</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Label t={t}>Usuários ({data?.count ?? "…"})</Label>
        </div>
        <input value={q} placeholder="Buscar por e-mail, nome ou código" onChange={e => setQ(e.target.value)}
          style={{ width: "100%", height: 44, background: t.card, border: `1.5px solid ${t.bdr}`,
            borderRadius: 12, padding: "0 14px", color: t.text, fontSize: 13, fontFamily: FONT, outline: "none", marginBottom: 12 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12 }}>
          {users.map(u => (
            <Card key={u.id} t={t}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: t.text, fontFamily: FONT,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || u.email.split("@")[0]}</div>
                  <div style={{ fontSize: 11, color: t.sub, marginTop: 2, fontFamily: FONT }}>{u.email}</div>
                  <div style={{ fontSize: 10.5, color: t.muted, marginTop: 3, fontFamily: FONT }}>
                    cód: {u.referral_code || "—"} · <span style={{ color: u.referral_count > 0 ? t.accent : t.muted, fontWeight: 700 }}>leads: {u.referral_count}</span>
                    {u.referred_by ? ` · veio de: ${u.referred_by}` : ""}
                  </div>
                  <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2, fontFamily: FONT }}>
                    validade: {fmtExp(u.plan_expires_at)}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PLANS.map(p => (
                  <button key={p} onClick={() => setPlan(u.id, p)} style={{
                    flex: "1 0 28%", padding: "7px 0", borderRadius: 9, fontSize: 10.5, fontWeight: 800,
                    cursor: "pointer", fontFamily: FONT, textTransform: "uppercase",
                    border: `1.5px solid ${u.plan === p ? t.accent : t.bdr}`,
                    background: u.plan === p ? t.accent : "transparent",
                    color: u.plan === p ? t.activeText : t.sub }}>{p}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                <span style={{ fontSize: 10.5, color: t.muted, fontFamily: FONT, flexShrink: 0 }}>Validade:</span>
                {[["+15d", 15], ["+30d", 30], ["Sem limite", 0]].map(([lbl, d]) => {
                  const active = d === 0 && !u.plan_expires_at; // "Sem limite" aceso quando ilimitado
                  return (
                    <button key={lbl} onClick={() => setExpiry(u.id, d)} style={{
                      flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 10.5, fontWeight: 700,
                      cursor: "pointer", fontFamily: FONT,
                      border: `1px solid ${active ? t.accent : t.bdr}`,
                      background: active ? t.accent : "transparent",
                      color: active ? t.activeText : t.sub }}>{lbl}</button>
                  );
                })}
              </div>
            </Card>
          ))}
          {data && users.length === 0 && (
            <p style={{ fontSize: 12, color: t.sub, textAlign: "center", fontFamily: FONT }}>Nenhum usuário encontrado.</p>
          )}
        </div>
      </Scroll>
      <BottomNav active="profile" onNav={onNav} t={t} />
    </div>
  );
};

const Profile = ({ t, onNav, onToggleTheme, onOpenNotifications, onOpenNotifCenter, onOpenFaq, onEdit, onEditAssets, onUpgrade, onAdmin, onSupport, isAdmin, onLogout, userEmail, profile, referral, plan, schedule, setSchedule, selectedAssets, tfPerAsset, live, showMock }) => {
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState(false);
  const [schedSaved, setSchedSaved] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const doCancel = async () => {
    setCancelling(true);
    const r = await api.cancelPlan();
    setCancelling(false);
    if (r?.ok) window.location.reload(); // recarrega p/ refletir Free em todo o app
    else { setCancelling(false); alert(r?.error || "Não foi possível cancelar agora."); }
  };
  const confirmSched = () => { setSchedSaved(true); setTimeout(() => setSchedSaved(false), 1800); };
  const refCode = referral?.code || "SEUCODIGO";
  const refLink = `https://sinais-tfx.vercel.app/?ref=${refCode}`;
  const copyRef = () => {
    try { navigator.clipboard.writeText(refLink); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const info = PLAN_INFO[plan];
  // Cota e "usados hoje" reais (do backend); fallback p/ mock só com dados fictícios ON.
  const quota = live?.quota ?? dailyQuota(plan);
  const used = live?.delivered ?? (showMock ? Math.min(3, quota) : 0);
  const isAnual = isAnualLikePlan(plan);
  const isFree = plan === "free";
  const items = [
    { id: "termos",  icon: "📄", label: "Termos de uso",
      body: "INFINITY SIGNALS — TERMOS DE USO\n\n"
        + "1. Natureza do serviço. O Infinity Signals fornece alertas e estudos operacionais (sinais) gerados por indicadores técnicos no MetaTrader, de caráter educacional e informativo.\n\n"
        + "2. Não é recomendação. Os sinais NÃO constituem recomendação, oferta ou solicitação de compra/venda de ativos, nem consultoria ou gestão de investimentos, conforme as normas da CVM. Nada aqui é aconselhamento financeiro individualizado.\n\n"
        + "3. Risco. Operar Forex, índices e metais envolve alto risco e pode resultar em perda total do capital. Resultados passados não garantem resultados futuros. As decisões e operações são de sua exclusiva responsabilidade.\n\n"
        + "4. Sem garantia. Não garantimos lucro, assertividade ou desempenho. As estatísticas exibidas são informativas e podem variar.\n\n"
        + "5. Responsabilidade. O Infinity Signals e MrThiagoFX não se responsabilizam por perdas decorrentes do uso dos sinais. Opere conforme seu perfil de risco.\n\n"
        + "6. Conta. Você é responsável por suas credenciais. É proibido revender ou redistribuir os sinais.\n\n"
        + "Versão 1.0 — 2026. Ao usar o app, você declara que leu e concorda com estes termos." },
    { id: "priv",    icon: "🔒", label: "Política de privacidade",
      body: "INFINITY SIGNALS — POLÍTICA DE PRIVACIDADE\n\n"
        + "1. Dados coletados. E-mail, nome, telefone e foto (opcionais) que você fornecer, e suas preferências (ativos, timeframes, horários, plano).\n\n"
        + "2. Uso. Usamos seus dados apenas para autenticar seu acesso, entregar os sinais/alertas e prestar suporte. Não vendemos nem compartilhamos seus dados com terceiros para marketing.\n\n"
        + "3. Notificações. Ao permitir, registramos a inscrição de push do seu dispositivo para enviar alertas. Você pode revogar a qualquer momento nas configurações do navegador/celular.\n\n"
        + "4. Armazenamento. Seus dados ficam em infraestrutura segura (Supabase), com medidas razoáveis de proteção.\n\n"
        + "5. Seus direitos. Você pode solicitar acesso, correção ou exclusão dos seus dados pelo suporte.\n\n"
        + "6. Indicações. Registramos o vínculo de indicação (quem indicou quem) para o programa de bônus.\n\n"
        + "Direitos reservados © MrThiagoFX. Versão 1.0 — 2026." },
    { id: "suporte", icon: "💬", label: "Suporte (Telegram)",
      body: "" },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Scroll>
        <div style={{ padding: "16px 24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: -0.5,
              color: t.text, fontFamily: FONT }}>Meu perfil</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {onEdit && (
                <button onClick={onEdit} aria-label="Editar perfil" style={{
                  width: 38, height: 38, borderRadius: 12, cursor: "pointer",
                  background: t.card, border: `1.5px solid ${t.bdr}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 17, padding: 0 }}>⚙️</button>
              )}
              <ThemeToggle t={t} onToggle={onToggleTheme} />
            </div>
          </div>

          <div onClick={onEdit} style={{ display: "flex", gap: 14, alignItems: "center",
            marginBottom: 22, cursor: onEdit ? "pointer" : "default" }}>
            <AvatarCircle url={profile?.avatar_url} t={t} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, color: t.text, fontFamily: FONT }}>
                {profile?.name || (userEmail ? userEmail.split("@")[0] : "Trader")}
              </div>
              <div style={{ fontSize: 13, color: t.sub, marginTop: 3, fontFamily: FONT }}>
                {profile?.username ? `@${profile.username.replace(/^@/, "")}` : (userEmail || "—")}
              </div>
            </div>
          </div>

          <div style={{ background: t.card2, border: `1.5px solid ${t.accentBdr}`,
            borderRadius: 22, padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <Label t={t} style={{ marginBottom: 4 }}>Plano atual</Label>
                <div style={{ fontSize: 22, fontWeight: 900, color: t.accent, fontFamily: FONT }}>{info.name}</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 2, fontFamily: FONT }}>{info.price}</div>
              </div>
              <div style={{ background: t.accentSoft, border: `1px solid ${t.accentBdr}`,
                borderRadius: 10, padding: "5px 12px", height: "fit-content",
                fontSize: 11, fontWeight: 800, color: t.accent, fontFamily: FONT }}>ATIVO</div>
            </div>
            <Label t={t} style={{ marginBottom: 8 }}>Sinais usados hoje</Label>
            <Bar pct={quota ? (used / quota) * 100 : 0} t={t} />
            <p style={{ fontSize: 12, color: t.sub, margin: "7px 0 0", fontFamily: FONT }}>
              {used} de {quota} sinais
            </p>
          </div>

          <Card t={t} accent style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Label t={t}>🕐 Horário de sinais</Label>
              {isAnual && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: t.sub, fontWeight: 700, fontFamily: FONT }}>Dia todo</span>
                  <Toggle on={schedule.allDay}
                    onChange={v => setSchedule(s => ({ ...s, allDay: v }))} t={t} />
                </div>
              )}
            </div>
            {schedule.allDay && isAnual ? (
              <p style={{ fontSize: 13, color: t.text, margin: 0, lineHeight: 1.6, fontFamily: FONT }}>
                <span style={{ fontWeight: 800, color: t.accent }}>Desbloqueado:</span> você recebe
                todos os sinais, 24 horas por dia — exclusivo do Premium Anual.
              </p>
            ) : isFree ? (
              <>
                <p style={{ fontSize: 12, color: t.sub, margin: "0 0 12px", lineHeight: 1.55, fontFamily: FONT }}>
                  No plano Free as <span style={{ fontWeight: 800, color: t.text }}>operações do dia</span> (2 a 4, M5/M15 sortidos) chegam em <span style={{ fontWeight: 800, color: t.text }}>horários fixos</span>:
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {FREE_SLOTS.map(h => (
                    <div key={h} style={{ flex: 1, textAlign: "center",
                      background: t.bg2, border: `1.5px solid ${t.bdr}`, borderRadius: 12, padding: "10px 4px" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: t.text, fontFamily: FONT }}>🔒 {h}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: t.muted, margin: "10px 0 0", fontFamily: FONT }}>
                  💡 Faça upgrade para o Premium e escolha o seu próprio horário.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: t.sub, margin: "0 0 12px", lineHeight: 1.55, fontFamily: FONT }}>
                  Receba sinais apenas no período que você definir. O histórico contabiliza dentro desta janela.
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <Label t={t} style={{ marginBottom: 6, fontSize: 10 }}>Início</Label>
                    <HourSelect value={schedule.start}
                      onChange={v => setSchedule(s => ({ ...s, start: v }))} t={t} />
                  </div>
                  <span style={{ color: t.muted, fontSize: 16, paddingBottom: 12 }}>→</span>
                  <div style={{ flex: 1 }}>
                    <Label t={t} style={{ marginBottom: 6, fontSize: 10 }}>Fim</Label>
                    <HourSelect value={schedule.end}
                      onChange={v => setSchedule(s => ({ ...s, end: v }))} t={t} />
                  </div>
                </div>
                {parseInt(schedule.end) <= parseInt(schedule.start) ? (
                  <p style={{ fontSize: 11.5, color: t.sell, fontWeight: 700, margin: "12px 0 0", fontFamily: FONT }}>
                    ⚠️ O fim ({schedule.end}) precisa ser depois do início ({schedule.start}).
                  </p>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 10px" }}>
                      <span style={{ fontSize: 12, color: t.sub, fontFamily: FONT }}>
                        Recebendo sinais das <span style={{ fontWeight: 800, color: t.text }}>{schedule.start}</span> às <span style={{ fontWeight: 800, color: t.text }}>{schedule.end}</span>.
                      </span>
                    </div>
                    <button onClick={confirmSched} style={{
                      width: "100%", height: 44, borderRadius: 12, cursor: "pointer", border: "none",
                      fontWeight: 800, fontSize: 14, fontFamily: FONT,
                      background: schedSaved ? t.buy : t.accent, color: t.activeText,
                      transition: "background .2s" }}>
                      {schedSaved ? "✓ Horário confirmado" : "Confirmar horário"}
                    </button>
                  </>
                )}
                {!isAnual && (
                  <p style={{ fontSize: 11, color: t.muted, margin: "10px 0 0", fontFamily: FONT }}>
                    💡 No Premium Anual você desbloqueia sinais o dia todo.
                  </p>
                )}
              </>
            )}
          </Card>

          {isAnual ? (
            <div style={{ marginBottom: 10, background: t.card, border: `1.5px solid ${t.accentBdr}`,
              borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>👑</span>
              <span style={{ fontSize: 12.5, color: t.text, fontFamily: FONT, lineHeight: 1.45 }}>
                Você já está no <span style={{ fontWeight: 800, color: t.accent }}>plano máximo</span> — acesso completo liberado.
              </span>
            </div>
          ) : (
            <Btn t={t} style={{ marginBottom: 10 }} onClick={onUpgrade}>Upgrade de plano</Btn>
          )}
          {onEditAssets && (
            <Btn t={t} variant="secondary" style={{ marginBottom: 10 }} onClick={onEditAssets}>
              📊 Editar ativos e timeframes
            </Btn>
          )}
          <Btn t={t} variant="secondary" style={{ marginBottom: 10 }} onClick={onOpenNotifCenter}>
            🛎️ Central de notificações
          </Btn>
          <Btn t={t} variant="secondary" style={{ marginBottom: 10 }} onClick={onOpenNotifications}>
            🔔 Ajustes de notificação
          </Btn>
          <Btn t={t} variant="secondary" style={{ marginBottom: isAdmin ? 10 : 20 }} onClick={onOpenFaq}>
            ❓ Central de ajuda
          </Btn>
          {isAdmin && (
            <Btn t={t} style={{ marginBottom: 20, background: t.blue, color: t.id === "dark" ? "#05121A" : "#FFFFFF" }}
              onClick={onAdmin}>🛠️ Painel admin</Btn>
          )}

          <Label t={t} style={{ marginBottom: 12 }}>Conta</Label>
          {items.map(({ id, icon, label, body }) => {
            const open = expanded === id;
            const navItem = id === "suporte";
            return (
              <div key={id} style={{ marginBottom: 8 }}>
                <div onClick={() => navItem ? onSupport?.() : setExpanded(open ? null : id)} style={{
                  background: t.card, border: `1px solid ${open ? t.accentBdr : t.bdr}`,
                  borderRadius: open ? "16px 16px 0 0" : 16,
                  padding: "14px 16px", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: t.text, fontFamily: FONT }}>{label}</span>
                  </div>
                  <span style={{ color: t.sub, fontSize: 18, lineHeight: 1,
                    transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>›</span>
                </div>
                {open && (
                  <div style={{ background: t.bg2, border: `1px solid ${t.accentBdr}`, borderTop: "none",
                    borderRadius: "0 0 16px 16px", padding: "12px 16px" }}>
                    <p style={{ fontSize: 12, color: t.sub, lineHeight: 1.65, margin: 0, fontFamily: FONT, whiteSpace: "pre-line" }}>{body}</p>
                  </div>
                )}
              </div>
            );
          })}

          {!isFree && !isAdmin && (
            <div style={{ marginTop: 16 }}>
              {!confirmCancel ? (
                <button onClick={() => setConfirmCancel(true)} style={{
                  width: "100%", padding: "11px", background: "transparent",
                  border: `1px solid ${t.bdr}`, borderRadius: 14, cursor: "pointer",
                  color: t.muted, fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
                  Cancelar plano (voltar ao Free)
                </button>
              ) : (
                <div style={{ background: t.card, border: `1.5px solid ${t.sell}55`,
                  borderRadius: 16, padding: "14px 16px" }}>
                  <p style={{ fontSize: 12.5, color: t.text, margin: "0 0 10px", lineHeight: 1.5, fontFamily: FONT }}>
                    Cancelar agora rebaixa sua conta para o <b>Free</b> imediatamente (você perde o acesso premium). Tem certeza?
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={doCancel} disabled={cancelling} style={{
                      flex: 1, padding: "10px", background: t.sell, border: "none", borderRadius: 12,
                      cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: FONT,
                      opacity: cancelling ? 0.6 : 1 }}>
                      {cancelling ? "Cancelando…" : "Sim, cancelar"}
                    </button>
                    <button onClick={() => setConfirmCancel(false)} disabled={cancelling} style={{
                      flex: 1, padding: "10px", background: "transparent", border: `1px solid ${t.bdr}`,
                      borderRadius: 12, cursor: "pointer", color: t.text, fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
                      Manter plano
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Btn t={t} variant="danger" onClick={onLogout}>Sair da conta</Btn>
          </div>
        </div>
      </Scroll>
      <BottomNav active="profile" onNav={onNav} t={t} />
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   ROOT — responsivo (celular = tela cheia · desktop = frame)
════════════════════════════════════════════════════════════ */
const SCREENS = [
  { id: "splash",        label: "1 · Splash"        },
  { id: "welcome",       label: "2 · Boas-vindas"   },
  { id: "risk",          label: "3 · Aviso"         },
  { id: "login",         label: "4 · Login"         },
  { id: "plans",         label: "5 · Planos"        },
  { id: "assets",        label: "6 · Ativos"        },
  { id: "timeframes",    label: "7 · Timeframes"    },
  { id: "home",          label: "8 · Home"          },
  { id: "signals",       label: "9 · Sinais"        },
  { id: "signal-detail", label: "10 · Detalhe"      },
  { id: "filters",       label: "11 · Filtros"      },
  { id: "performance",   label: "12 · Desempenho"   },
  { id: "history",       label: "13 · Histórico"    },
  { id: "notifications", label: "14 · Notificações" },
  { id: "profile",       label: "15 · Perfil"       },
];

export default function App() {
  const [themeId, setThemeId] = useState("dark");
  const [screen, setScreen] = useState("splash");
  const [signal, setSignal] = useState(null);
  const [plan, setPlan] = useState("anual");
  const [selectedAssets, setSelectedAssets] = useState(["XAUUSD", "NAS100", "US30"]);
  const [tfPerAsset, setTfPerAsset] = useState({
    XAUUSD: ["M5"], NAS100: ["M15"], US30: ["M5"],
  });
  const [schedule, setSchedule] = useState({ start: "08:00", end: "18:00", allDay: false });
  // Viewport real (largura + altura). Recalcula no resize e ao girar a tela,
  // para o app se adaptar a qualquer display: celular, iPad, desktop.
  const [vp, setVp] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 390,
    h: typeof window !== "undefined" ? window.innerHeight : 844,
  }));

  useEffect(() => {
    // window.innerHeight = altura TOTAL da tela (inclui a safe-area inferior) em
    // PWA/standalone. NÃO usar visualViewport.height aqui: ele DESCONTA a safe-area,
    // o que deixava o container menor que a tela e o menu somava o inset de novo
    // (safe-area dobrada → faixa preta embaixo). Aqui o container ocupa a tela
    // inteira e o menu usa o inset só como padding interno.
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Tela estreita (celular) → app ocupa tudo, edge-to-edge.
  // Telas largas (iPad/desktop) → cartão centralizado que escala com o display.
  const edgeToEdge = vp.w <= 540;
  const isMobile = edgeToEdge; // compat. com o restante do render

  // ── Integração com backend (Fase 5) — ativa só quando o Supabase está configurado.
  // Sem credenciais (hasSupabase=false), tudo abaixo é no-op e o app roda em modo demo.
  const [session, setSession] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [live, setLive] = useState(null);    // resposta de GET /api/signals
  const [stats, setStats] = useState(null);  // resposta de GET /api/stats
  const [referralCount, setReferralCount] = useState(0);
  const [profileData, setProfileData] = useState({ name: "", username: "", phone: "", avatar_url: "", referral_code: "" });
  const [tfChangedAt, setTfChangedAt] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [closeAlerts, setCloseAlerts] = useState([]); // signal_id marcados p/ alerta de fechamento

  // Sem dados fictícios: as telas mostram apenas dados reais do servidor
  // (e estados vazios quando não há nada). Mantido como constante para
  // neutralizar os antigos fallbacks de mock sem refatorar cada tela.
  const showMock = false;

  // Captura ?ref=CODE da URL (link de indicação) ao abrir o app.
  useEffect(() => { api.captureRefFromUrl(); }, []);

  // FIX do "menu sobe ao reabrir": no iOS, ao reabrir o PWA, o 100dvh/innerHeight
  // vêm CURTOS (faltam ~62px da status bar), mas a tela física (window.screen.height)
  // é CONSTANTE e correta. Travamos a altura do app nesse valor → o menu fica sempre
  // no fundo real da tela, na 1ª vez e em toda reabertura.
  useEffect(() => {
    const setH = () => {
      // Só no APP INSTALADO no CELULAR (standalone + tela estreita). No navegador
      // e no iPad usa o modo normal (100dvh), pra não arriscar overflow. screen.height
      // é a tela do PRÓPRIO aparelho de cada aluno → adapta sozinho ao device.
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const mobile = window.innerWidth <= 540;
      const h = (window.screen && window.screen.height) || 0;
      if (standalone && mobile && h > 200) {
        document.documentElement.style.setProperty("--screen-h", h + "px");
      } else {
        document.documentElement.style.removeProperty("--screen-h");
      }
    };
    setH();
    const onChange = () => setTimeout(setH, 200);
    window.addEventListener("orientationchange", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("orientationchange", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  // A UI sempre reflete o plano EFETIVO do backend (vencido = free). Sem isso, um
  // usuário vencido veria "Premium" e a cota cheia enquanto o servidor já entrega
  // Free — texto/gating divergindo do que ele realmente recebe.
  useEffect(() => { if (live?.plan) setPlan(live.plan); }, [live?.plan]);

  // Restaura a sessão salva ao abrir o app. Se já estiver logado, entra direto
  // no app (home) em vez de mostrar o onboarding (splash/welcome/login).
  useEffect(() => {
    if (!hasSupabase) return;
    api.getSession().then((s) => {
      setSession(s);
      if (s) {
        // Deep-link: notificação pode abrir o app numa tela (ex.: boletim → ?go=performance).
        let target = "home";
        try {
          const go = new URLSearchParams(window.location.search).get("go");
          const allowed = ["performance", "history", "signals", "notif-center"];
          if (go && allowed.includes(go)) {
            target = go;
            window.history.replaceState({}, "", window.location.pathname); // limpa o ?go da URL
          }
        } catch { /* ignore */ }
        setScreen(target);
      }
    });
  }, []);

  // Ao autenticar: hidrata as preferências do perfil e registra o push.
  useEffect(() => {
    if (!hasSupabase || !session) return;
    let alive = true;
    (async () => {
      const p = await api.loadProfile();
      // Sincroniza nome/telefone do cadastro (metadata) caso ainda não estejam no perfil.
      if (p) {
        const meta = session.user?.user_metadata || {};
        const patch = {};
        if (!p.name && meta.name) patch.name = meta.name;
        if (!p.phone && meta.phone) patch.phone = meta.phone;
        if (Object.keys(patch).length) { try { await api.updateProfileFields(patch); Object.assign(p, patch); } catch { /* ignore */ } }
      }
      if (alive && p) {
        if (p.plan) setPlan(p.plan);
        if (Array.isArray(p.assets) && p.assets.length) setSelectedAssets(p.assets);
        if (p.tf_per_asset && Object.keys(p.tf_per_asset).length) setTfPerAsset(sanitizeTfPerAsset(p.tf_per_asset));
        setSchedule({
          start: p.schedule_start || "08:00",
          end: p.schedule_end || "18:00",
          allDay: !!p.schedule_all_day,
        });
        setReferralCount(p.referral_count || 0);
        setProfileData({
          name: p.name || "", username: p.username || "",
          phone: p.phone || "", avatar_url: p.avatar_url || "",
          referral_code: p.referral_code || "",
        });
        setTfChangedAt(p.tf_changed_at || null);
        if (Array.isArray(p.close_alerts)) setCloseAlerts(p.close_alerts);

        // Resgata o cupom de aluno pendente (do cadastro) — libera aluno 15 dias.
        let pendingAluno = "";
        try { pendingAluno = localStorage.getItem("tfx_aluno_coupon") || ""; } catch { /* ignore */ }
        if (pendingAluno && (!p.plan || p.plan === "free")) {
          const r = await api.redeemAluno(pendingAluno);
          if (r?.ok && r?.plan) { if (alive) setPlan(r.plan); }
          try { localStorage.removeItem("tfx_aluno_coupon"); } catch { /* ignore */ }
        }

        // Onboarding: se o perfil ainda não passou pela escolha de ativos/TF
        // (flag onboarded = false), leva ao onboarding em vez de cair na home.
        // (=== false: se a coluna ainda não existir, não redireciona ninguém.)
        if (alive && p.onboarded === false) setScreen("plans");
      }
      if (alive) setProfileLoaded(true);
      api.registerPush();
    })();
    return () => { alive = false; };
  }, [session]);

  // Persiste preferências no Supabase sempre que mudarem (após carregar o perfil).
  useEffect(() => {
    if (!hasSupabase || !session || !profileLoaded) return;
    api.saveProfile({ plan, selectedAssets, tfPerAsset,
      schedule: plan === "free" ? FREE_SCHEDULE : schedule });
  }, [plan, selectedAssets, tfPerAsset, schedule, session, profileLoaded]);

  // Atualização do feed: realtime (Supabase) + polling 15s + ao voltar pro app.
  // Cobre o caso de bater TP/SL com o app aberto ou ao tocar na notificação.
  useEffect(() => {
    if (!hasSupabase || !session) return;
    if (!["home", "signals", "performance", "history", "profile"].includes(screen)) return;
    let alive = true;
    const pull = async () => {
      const [s, st] = await Promise.all([api.fetchSignals(), api.fetchStats()]);
      if (!alive) return;
      if (s) setLive(s);
      if (st) setStats(st);
    };
    pull();
    const id = setInterval(pull, 15000);
    // Atualiza na hora ao voltar pro app (ex.: tocar na notificação de fechamento).
    const onVisible = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", pull);
    // Realtime: qualquer mudança em signals refaz o fetch imediatamente.
    const unsub = api.subscribeSignals(() => pull());
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", pull);
      unsub();
    };
  }, [screen, session]);

  // Busca o desempenho por timeframe ao abrir a tela.
  useEffect(() => {
    if (!hasSupabase || !session || !["tf-perf", "performance"].includes(screen)) return;
    api.fetchBreakdown().then((b) => { if (b) setBreakdown(b); });
  }, [screen, session]);

  const handleAuth = useCallback(async (email, pass) => {
    const r = await api.signIn(email, pass);
    if (r.ok && !r.demo) setSession(await api.getSession());
    return r;
  }, []);

  const handleSignup = useCallback(async ({ name, email, phone, pass, coupon }) => {
    const r = await api.signUp(email, pass, name, coupon, phone);
    if (!r.ok || r.demo) return r;
    if (r.session) {
      setSession(r.session);
      try { await api.updateProfileFields({ name, phone }); } catch { /* sincroniza no 1º login */ }
      return { ok: true };
    }
    return { ok: true, needsConfirm: true }; // confirmação de e-mail ligada
  }, []);

  const handleLogout = useCallback(async () => {
    await api.signOut();
    setSession(null); setProfileLoaded(false); setLive(null); setStats(null);
    setScreen("login");
  }, []);

  // Fluxo de upgrade: abre a tela de Planos a partir do Perfil e volta pra lá.
  const [upgradeFrom, setUpgradeFrom] = useState(null);
  const openUpgrade = useCallback(() => { setUpgradeFrom(plan); setScreen("plans"); }, [plan]);
  const closeUpgrade = useCallback(() => { setUpgradeFrom(null); setScreen("profile"); }, []);

  // Edição de config (ativos/timeframes) pós-onboarding: entra pela tela de
  // Ativos e volta pro Perfil. A trava de 7 dias (tfLocked) vale aqui também.
  const [editingConfig, setEditingConfig] = useState(false);
  const openEditAssets = useCallback(() => { setEditingConfig(true); setScreen("assets"); }, []);

  // Admin (conta interna) tem privilégios: troca o timeframe quando quiser.
  const isAdmin = !!(session?.user && session.user.app_metadata?.role === "admin");

  // Trava de timeframe: 1 troca por semana (mantém o histórico limpo).
  // O admin não é travado — pode alternar M5/M15 sem esperar a semana.
  const TF_LOCK_DAYS = 7;
  const tfNextChange = tfChangedAt ? new Date(new Date(tfChangedAt).getTime() + TF_LOCK_DAYS * 86400000) : null;
  const tfLocked = !isAdmin && !!(tfNextChange && Date.now() < tfNextChange.getTime());
  const stampTfChange = useCallback(() => {
    const now = new Date().toISOString();
    setTfChangedAt(now);
    api.updateProfileFields({ tf_changed_at: now });
  }, []);
  // Define o timeframe de um ativo (respeitando a trava). Usado no histórico por TF.
  const pickTimeframe = useCallback((asset, tf) => {
    setTfPerAsset(cfg => ({ ...cfg, [asset]: [tf] }));
    stampTfChange();
  }, [stampTfChange]);
  // Marca/desmarca uma OPERAÇÃO (signal_id) para receber alerta de fechamento. Persiste.
  const toggleCloseAlert = useCallback((signalId) => {
    if (!signalId) return;
    setCloseAlerts(curr => {
      const next = curr.includes(signalId) ? curr.filter(x => x !== signalId) : [...curr, signalId];
      api.updateProfileFields({ close_alerts: next });
      return next;
    });
  }, []);

  const t = THEMES[themeId];
  const toggleTheme = useCallback(() => setThemeId(x => x === "dark" ? "light" : "dark"), []);
  const go = useCallback(id => setScreen(id), []);
  const nav = useCallback(id => {
    const map = { home: "home", signals: "signals", performance: "performance",
      history: "history", profile: "profile", "signal-detail": "signal-detail" };
    if (map[id]) setScreen(map[id]);
  }, []);

  const common = { t, onToggleTheme: toggleTheme };
  // Free usa horário fixo; Premium usa a janela escolhida.
  const effSchedule = plan === "free" ? FREE_SCHEDULE : schedule;
  const bizState = { plan, selectedAssets, tfPerAsset, schedule: effSchedule };

  const render = () => {
    switch (screen) {
      case "splash":        return <Splash {...common} onNext={() => go("welcome")} />;
      case "welcome":       return <Welcome {...common} onNext={() => go("risk")} onLogin={() => go("login")} />;
      case "risk":          return <RiskWarning {...common} onNext={() => go("signup")} />;
      case "login":         return <Login {...common} onNext={() => go("home")} onAuth={hasSupabase ? handleAuth : undefined} onForgot={hasSupabase ? (email) => api.resetPassword(email) : undefined} onCreateAccount={() => go("signup")} />;
      case "signup":        return <Signup {...common} onNext={() => go("plans")} onSignup={hasSupabase ? handleSignup : undefined} onHaveAccount={() => go("login")} />;
      case "plans":         return <Plans {...common} onNext={upgradeFrom ? closeUpgrade : () => go("assets")} onBack={upgradeFrom ? closeUpgrade : undefined} currentPlan={upgradeFrom} plan={plan} setPlan={setPlan} />;
      case "assets":        return <Assets {...common} onNext={() => go("timeframes")} onBack={() => go(editingConfig ? "profile" : "plans")} selected={selectedAssets} setSelected={setSelectedAssets} locked={tfLocked} nextChange={tfNextChange} />;
      case "timeframes":    return <Timeframes {...common} onNext={() => { if (!tfLocked) stampTfChange(); api.updateProfileFields({ onboarded: true }); setEditingConfig(false); go("home"); }} onBack={() => go("assets")} selectedAssets={selectedAssets} tfPerAsset={tfPerAsset} setTfPerAsset={setTfPerAsset} plan={plan} locked={tfLocked} nextChange={tfNextChange} />;
      case "home":          return <Home {...common} onNav={nav} onOpenSignal={setSignal} {...bizState} live={live} stats={stats} closeAlerts={closeAlerts} onToggleCloseAlert={toggleCloseAlert} userName={profileData?.name || (session?.user?.email ? session.user.email.split("@")[0] : "")} />;
      case "signals":       return <SignalsFeed {...common} onNav={nav} onOpenSignal={setSignal} onOpenFilters={() => go("filters")} {...bizState} live={live} stats={stats} showMock={showMock} closeAlerts={closeAlerts} onToggleCloseAlert={toggleCloseAlert} />;
      case "signal-detail": return <SignalDetail {...common} signal={signal} onNav={nav} onBack={() => go("signals")} showMock={showMock} />;
      case "filters":       return <Filters {...common} onNav={nav} onBack={() => go("signals")} selectedAssets={selectedAssets} plan={plan} tfPerAsset={tfPerAsset} onPick={pickTimeframe} locked={tfLocked} nextChange={tfNextChange} isAdmin={isAdmin} />;
      case "performance":   return <Performance {...common} onNav={nav} selectedAssets={selectedAssets} stats={stats} breakdown={breakdown} tfPerAsset={tfPerAsset} onTfPerf={() => go("tf-perf")} showMock={showMock} live={live} />;
      case "tf-perf":       return <TimeframePerf {...common} onNav={nav} onBack={() => go("performance")} selectedAssets={selectedAssets} tfPerAsset={tfPerAsset} plan={plan} breakdown={breakdown} locked={tfLocked} nextChange={tfNextChange} onPick={pickTimeframe} showMock={showMock} />;
      case "history":       return <History {...common} onNav={nav} onOpenSignal={setSignal} {...bizState} live={live} stats={stats} />;
      case "notifications": return <Notifications {...common} onNav={nav} onBack={() => go("profile")} schedule={effSchedule} plan={plan} selectedAssets={selectedAssets} tfPerAsset={tfPerAsset} />;
      case "notif-center":  return <NotifCenter {...common} onNav={nav} onBack={() => go("profile")} onOpenSignal={setSignal} live={live} />;
      case "faq":           return <Faq {...common} onNav={nav} onBack={() => go("profile")} onSupport={() => { try { window.open("https://t.me/mrthiagofx", "_blank", "noopener"); } catch { /* ignore */ } }} />;
      case "profile":       return <Profile {...common} onNav={nav} onOpenNotifications={() => go("notifications")} onOpenNotifCenter={() => go("notif-center")} onOpenFaq={() => go("faq")} onEdit={() => go("edit-profile")} onEditAssets={openEditAssets} onUpgrade={openUpgrade} onAdmin={() => go("admin")} onSupport={() => { try { window.open("https://t.me/mrthiagofx", "_blank", "noopener"); } catch { /* ignore */ } }} isAdmin={isAdmin} onLogout={handleLogout} userEmail={session?.user?.email} profile={profileData} referral={{ code: profileData.referral_code || api.refCode(session?.user?.id) || "SEUCODIGO", count: referralCount }} {...bizState} setSchedule={setSchedule} live={live} showMock={showMock} />;
      case "admin":         return <AdminPanel {...common} onNav={nav} onBack={() => go("profile")} />;
      case "edit-profile":  return <EditProfile {...common} onNav={nav} onBack={() => go("profile")} onUpgrade={openUpgrade} plan={plan} profile={profileData} userEmail={session?.user?.email} onSaved={(d) => setProfileData(p => ({ ...p, ...d }))} />;
      default:              return <Splash {...common} onNext={() => go("welcome")} />;
    }
  };

  const isDev = import.meta.env.DEV;

  /* ── APP REAL: produção (qualquer display) e também o celular em dev.
     Sistema fluido: mede o viewport e se adapta.
       • Celular (estreito)  → ocupa a tela inteira (edge-to-edge).
       • iPad / desktop      → cartão centralizado que escala com a tela. ── */
  // CELULAR (tela estreita): o app PREENCHE exatamente a tela, sem centralizar
  // nem altura fixa — o card flui com flex:1, então o menu inferior encosta no
  // rodapé (nada de "flutuar" por causa de 100dvh menor que a área visível).
  if (edgeToEdge) {
    return (
      // Container em FLUXO com 100dvh (estado aprovado como perfeito na 1ª abertura).
      <div style={{ height: "var(--screen-h, 100dvh)", display: "flex", flexDirection: "column",
        background: t.bg0, fontFamily: FONT }}>
        <GlobalStyle t={t} />
        <div className="safe-top" style={{ flex: 1, minHeight: 0, display: "flex",
          flexDirection: "column", overflow: "hidden", background: t.bg0 }}>
          <div className="screen-anim" key={screen}>{render()}</div>
        </div>
      </div>
    );
  }

  // iPad / DESKTOP em produção: cartão centralizado que escala com a tela.
  if (!isDev) {
    const cardW = Math.min(vp.w - 32, 460);
    const cardH = Math.min(vp.h - 32, 920);
    return (
      <div style={{ minHeight: "100dvh", height: "100dvh", display: "flex",
        justifyContent: "center", alignItems: "center", fontFamily: FONT,
        background: themeId === "dark"
          ? "radial-gradient(circle at 50% 30%, #11161f 0%, #03050a 78%)"
          : "radial-gradient(circle at 50% 30%, #FFFFFF 0%, #D2E0ED 80%)",
        transition: "background .3s" }}>
        <GlobalStyle t={t} />
        <div style={{ width: cardW, height: cardH,
          display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg0,
          borderRadius: 28, border: `1px solid ${t.bdr}`,
          boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}>
          <div className="screen-anim" key={screen}>{render()}</div>
        </div>
      </div>
    );
  }

  /* ── DEV (npm run dev) no desktop: frame de celular + painel de telas/planos ── */
  return (
    <div className="scrollarea" style={{
      height: "100vh", background: themeId === "dark" ? "#000" : "#DDE8F2",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "24px 16px 48px", fontFamily: FONT, transition: "background .3s",
    }}>
      <GlobalStyle t={t} />
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 20, flexShrink: 0,
        background: themeId === "dark" ? "#0A0A0A" : "#FFFFFF",
        border: `1px solid ${t.bdr}`, borderRadius: 18, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BoltLogo t={t} size={18} />
            <Label t={t} color={t.muted}>Infinity Signals · telas (dev)</Label>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {["free", "mensal", "anual"].map(p => (
              <button key={p} onClick={() => setPlan(p)} style={{
                padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800,
                cursor: "pointer", fontFamily: FONT,
                border: `1px solid ${plan === p ? t.accent : t.bdr}`,
                background: plan === p ? t.accent : "transparent",
                color: plan === p ? t.activeText : t.muted,
              }}>{p.toUpperCase()}</button>
            ))}
            <ThemeToggle t={t} onToggle={toggleTheme} />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SCREENS.map(({ id, label }) => (
            <button key={id} onClick={() => go(id)} style={{
              padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: FONT,
              border: `1px solid ${screen === id ? t.accent : t.bdr}`,
              background: screen === id ? t.accent : (themeId === "dark" ? "#111" : "#F0F6FC"),
              color: screen === id ? t.activeText : t.muted,
              whiteSpace: "nowrap",
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{
        width: 390, height: 780, maxHeight: "calc(100vh - 180px)", minHeight: 560,
        background: t.bg0, borderRadius: 50, overflow: "hidden",
        display: "flex", flexDirection: "column", flexShrink: 0,
        boxShadow: `0 0 0 2px ${t.bdr}, 0 0 0 10px ${themeId === "dark" ? "#080808" : "#C5D5E5"},
          0 0 0 12px ${t.bdrMid}, 0 40px 100px rgba(0,0,0,${themeId === "dark" ? 0.95 : 0.25})`,
        position: "relative", transition: "background .3s",
      }}>
        <div style={{ height: 40, background: t.bg0, flexShrink: 0,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          paddingBottom: 4, transition: "background .3s" }}>
          <div style={{ width: 120, height: 28,
            background: themeId === "dark" ? "#000" : "#1A2B3C",
            borderRadius: "0 0 20px 20px" }} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          {render()}
        </div>
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: themeId === "dark" ? "#2A2A2A" : "#8AA0B5",
        textAlign: "center", fontFamily: FONT, flexShrink: 0 }}>
        Infinity Signals · v4.1 · PWA · Vercel ready
      </p>
    </div>
  );
}
