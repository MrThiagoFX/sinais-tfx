// Teste e2e local contra o Supabase real: signup → profile (trigger) → insert de sinal.
// Limpa tudo no final.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `teste+${Date.now()}@infinitysignals.app`;
let userId = null, signalId = null;

try {
  // 1) Cria usuário (dispara trigger handle_new_user → cria profile)
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email, password: "Senha#12345", email_confirm: true,
    user_metadata: { name: "Trader Teste" },
  });
  if (cErr) throw new Error("createUser: " + cErr.message);
  userId = created.user.id;
  console.log("✅ usuário criado:", email);

  // 2) Confere o profile criado pelo trigger
  await new Promise(r => setTimeout(r, 800));
  const { data: profile, error: pErr } = await sb
    .from("profiles").select("*").eq("id", userId).maybeSingle();
  if (pErr) throw new Error("ler profile: " + pErr.message);
  if (!profile) throw new Error("profile NÃO foi criado pelo trigger");
  console.log(`✅ profile criado pelo trigger (plan=${profile.plan}, name=${profile.name})`);

  // 3) Insere um sinal (mesma lógica do POST /api/signals)
  const { data: sig, error: sErr } = await sb.from("signals")
    .insert({ asset: "XAUUSD", dir: "Compra", tf: "M5", entry: 2365.4, sl: 2360, tp: 2373 })
    .select().single();
  if (sErr) throw new Error("inserir signal: " + sErr.message);
  signalId = sig.id;
  console.log("✅ sinal inserido:", sig.asset, sig.dir, sig.tf, "id=", sig.id);

  console.log("\nE2E_OK");
} catch (e) {
  console.log("❌ FALHA:", e.message);
  console.log("\nE2E_FALHA");
} finally {
  // Limpeza
  if (signalId) await sb.from("signals").delete().eq("id", signalId);
  if (userId) await sb.auth.admin.deleteUser(userId);
  console.log("(limpeza concluída)");
}
