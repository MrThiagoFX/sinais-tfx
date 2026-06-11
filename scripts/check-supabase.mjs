// Verificação de conexão e schema do Supabase. Lê o .env manualmente.
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

const tables = ["profiles", "signals", "push_subscriptions", "daily_usage"];
let allOk = true;
for (const tbl of tables) {
  const { error } = await sb.from(tbl).select("*", { count: "exact", head: true });
  if (error) {
    allOk = false;
    console.log(`❌ ${tbl}: ${error.message}`);
  } else {
    console.log(`✅ ${tbl}: existe`);
  }
}
console.log(allOk ? "\nSCHEMA_OK" : "\nSCHEMA_FALTA");
