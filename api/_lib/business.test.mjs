// Testes dos cálculos CRÍTICOS do laudo/sinais (node --test, sem dependências).
// Garante que a matemática nunca regrida: pips, plano efetivo, cota, elegibilidade.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePips, effectivePlan, dailyQuota, normalizeAsset, normalizeTf, normalizeDir,
  isEligible, startOfForexDayMs, TFS, ASSETS,
} from "./business.js";

test("computePips — XAUUSD (pip 0.1)", () => {
  // Compra 4332.49 → 4351.40 = +189
  assert.equal(computePips("XAUUSD", "Compra", 4332.49, 4351.40), 189);
  // Venda 4352.15 → 4330.11 = +220 (sell ganha caindo)
  assert.equal(computePips("XAUUSD", "Venda", 4352.15, 4330.11), 220);
});

test("computePips — US30/NAS100 (pip 1)", () => {
  assert.equal(computePips("US30", "Venda", 51740.25, 51808.05), -68); // stop
  assert.equal(computePips("NAS100", "Venda", 30533.73, 30365.91), 168); // tp
});

test("TFS e ASSETS — só M5/M15 e 3 ativos (sem M1, sem EUR/GBP)", () => {
  assert.deepEqual([...TFS].sort(), ["M15", "M5"]);
  assert.ok(!TFS.includes("M1"));
  assert.deepEqual([...ASSETS].sort(), ["NAS100", "US30", "XAUUSD"]);
  assert.ok(!ASSETS.includes("EURUSD") && !ASSETS.includes("GBPUSD"));
});

test("effectivePlan — vencido vira free; válido mantém", () => {
  const ontem = new Date(Date.now() - 86400000).toISOString();
  const amanha = new Date(Date.now() + 86400000).toISOString();
  assert.equal(effectivePlan({ plan: "anual", plan_expires_at: ontem }), "free");
  assert.equal(effectivePlan({ plan: "anual", plan_expires_at: amanha }), "anual");
  assert.equal(effectivePlan({ plan: "anual", plan_expires_at: null }), "anual");
  assert.equal(effectivePlan(null), "free");
});

test("dailyQuota — free=config(2-4) · premium=20 · vencido=free", () => {
  assert.equal(dailyQuota({ plan: "free" }, 4), 4);
  assert.equal(dailyQuota({ plan: "free" }, 2), 2);
  assert.equal(dailyQuota({ plan: "anual" }), 20);
  const vencido = { plan: "anual", plan_expires_at: new Date(Date.now() - 1000).toISOString() };
  assert.equal(dailyQuota(vencido, 3), 3); // caiu pra free
});

test("normalizeAsset/Tf/Dir", () => {
  assert.equal(normalizeAsset("US100.cash"), "NAS100");
  assert.equal(normalizeAsset("US30.cash"), "US30");
  assert.equal(normalizeAsset("XAUUSD.m"), "XAUUSD");
  assert.equal(normalizeAsset("EURUSD"), null); // removido
  assert.equal(normalizeTf("M5"), "M5");
  assert.equal(normalizeTf("M1"), null); // removido
  assert.equal(normalizeDir("BUY"), "Compra");
  assert.equal(normalizeDir("SELL"), "Venda");
});

test("isEligible — premium filtra ativo/tf; free vê tudo", () => {
  // 15:00 UTC = 12:00 BRT → dentro da janela fixa do Free (8-18). Determinístico.
  const sig = { asset: "XAUUSD", tf: "M5", created_at: "2026-06-16T15:00:00Z" };
  const anual = { plan: "anual", schedule_all_day: true, assets: ["XAUUSD"], tf_per_asset: { XAUUSD: ["M5"] } };
  assert.equal(isEligible(sig, anual), true);
  const anualM15 = { plan: "anual", schedule_all_day: true, assets: ["XAUUSD"], tf_per_asset: { XAUUSD: ["M15"] } };
  assert.equal(isEligible(sig, anualM15), false); // segue M15, sinal é M5
  const free = { plan: "free" }; // free ignora seleção (vê tudo dentro da janela)
  assert.equal(isEligible(sig, free), true);
});

test("startOfForexDayMs — meia-noite UTC (21h BRT)", () => {
  const ms = startOfForexDayMs();
  const d = new Date(ms);
  assert.equal(d.getUTCHours(), 0);
  assert.equal(d.getUTCMinutes(), 0);
  assert.ok(ms <= Date.now());
});
