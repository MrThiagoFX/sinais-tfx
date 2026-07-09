// ============================================================================
//  tfx_enviador.js  —  Envia o spool2 usando o TLS PROPRIO do Node
//
//  POR QUE: o Windows Server 2012 da VPS nao consegue fazer TLS moderno com a
//  Vercel (schannel velho -> "canal seguro SSL/TLS" no PowerShell e 5203 no MT4).
//  O Node.js traz o proprio motor de TLS (OpenSSL) e as CAs proprias -> conecta
//  na Vercel IGNORANDO o TLS quebrado do Windows. Resolve de vez.
//
//  COMO USAR NA VPS:
//    1) Baixe o Node.js no Chrome da VPS:  https://nodejs.org  (versao LTS, .msi)
//       Instale (Next -> Next -> Finish).
//    2) Coloque este arquivo numa pasta (ex.: Area de Trabalho).
//    3) Abra o CMD/PowerShell nessa pasta e rode:
//         node tfx_enviador.js
//       (ele acha a pasta tfx_outbox sozinho e fica enviando a cada 5s)
//    Se nao achar a pasta, passe o caminho:
//         node tfx_enviador.js "C:\Users\Administrador\AppData\Roaming\MetaQuotes\Terminal\SEU_ID\MQL4\Files\tfx_outbox"
// ============================================================================

const fs = require("fs");
const path = require("path");
const https = require("https");

const ENDPOINT = "https://sinais-tfx.vercel.app/api/signals";
const HEALTH = "https://sinais-tfx.vercel.app/api/health";
const TOKEN = "0393df6d014741badd6a55f12b62f69627168dabf17f60dd63af1fa9fdd9cebf";
const INTERVALO = 5000;

function acharOutbox() {
  const arg = process.argv[2];
  if (arg && fs.existsSync(arg)) return arg;
  const base = path.join(process.env.APPDATA || "", "MetaQuotes", "Terminal");
  try {
    for (const d of fs.readdirSync(base)) {
      const p = path.join(base, d, "MQL4", "Files", "tfx_outbox");
      if (fs.existsSync(p)) return p;
    }
  } catch (e) {}
  return null;
}

const outbox = acharOutbox();
if (!outbox) {
  console.log('ERRO: pasta tfx_outbox nao encontrada. Rode: node tfx_enviador.js "C:\\...\\MQL4\\Files\\tfx_outbox"');
  process.exit(1);
}
const badDir = path.join(outbox, "bad");
if (!fs.existsSync(badDir)) fs.mkdirSync(badDir, { recursive: true });
console.log("===============================================");
console.log("TFX Enviador (Node) — TLS proprio, bypass do Windows");
console.log("Outbox  :", outbox);
console.log("Endpoint:", ENDPOINT);
console.log("===============================================");

function getHealth() {
  return new Promise((resolve) => {
    https.get(HEALTH, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => resolve({ code: r.statusCode, body: b })); })
      .on("error", (e) => resolve({ code: 0, err: e.message }));
  });
}

function post(json) {
  return new Promise((resolve) => {
    const data = Buffer.from(json, "utf8");
    const req = https.request(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": data.length, "X-TFX-Token": TOKEN },
      timeout: 20000,
    }, (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ code: res.statusCode, body: b })); });
    req.on("error", (e) => resolve({ code: 0, err: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ code: 0, err: "timeout" }); });
    req.write(data);
    req.end();
  });
}

function epochDe(nome) {
  const sig = nome.split("__")[0];
  const m = sig.match(/_(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function ciclo() {
  let files = [];
  try { files = fs.readdirSync(outbox).filter((f) => f.endsWith("__OPEN.json") || f.endsWith("__CLOSE.json")); } catch (e) {}
  files.sort((a, b) => {
    const d = epochDe(a) - epochDe(b); if (d !== 0) return d;
    const pa = a.endsWith("__OPEN.json") ? 0 : 1, pb = b.endsWith("__OPEN.json") ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
  let env = 0;
  for (const f of files) {
    const full = path.join(outbox, f);
    let json; try { json = fs.readFileSync(full, "utf8"); } catch (e) { continue; }
    if (!json.trim()) { try { fs.unlinkSync(full); } catch (e) {} continue; }
    const r = await post(json);
    if (r.code >= 200 && r.code < 300) { try { fs.unlinkSync(full); } catch (e) {} env++; console.log("  OK  ", f, "HTTP", r.code); }
    else if (r.code === 400) { try { fs.renameSync(full, path.join(badDir, f)); } catch (e) {} console.log("  BAD ", f, "HTTP 400 -> bad"); }
    else if (r.code === 401) { console.log("  401 - token invalido. Parando."); return false; }
    else { console.log("  FALHOU", f, "->", r.err || "HTTP " + r.code); break; }
    await new Promise((s) => setTimeout(s, 150));
  }
  let rest = 0;
  try { rest = fs.readdirSync(outbox).filter((f) => f.endsWith("__OPEN.json") || f.endsWith("__CLOSE.json")).length; } catch (e) {}
  console.log("[" + new Date().toLocaleTimeString() + "] enviados: " + env + " | pendentes: " + rest);
  return true;
}

(async () => {
  const t = await getHealth();
  if (t.code >= 200 && t.code < 300) console.log("CONEXAO OK (HTTP " + t.code + "): " + t.body);
  else { console.log("CONEXAO FALHOU -> " + (t.err || "HTTP " + t.code)); console.log("(se falhou ate no Node, e rede/firewall da VPS, nao TLS)"); }
  while (true) { const ok = await ciclo(); if (!ok) break; await new Promise((s) => setTimeout(s, INTERVALO)); }
})();
