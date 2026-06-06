// Diagnóstico temporário: testa o caminho exato do /api/admin/set-credits
// para o usuário admin. Chama credit_user com amount 0 (não altera saldo) e
// reporta sucesso/erro. Limpa a trilha 'diagnostic-noop' ao final.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (env.ADMIN_EMAILS || "").split(",")[0].trim();
console.log("URL:", url ? "ok" : "FALTA", "| service key:", key ? "ok" : "FALTA", "| admin:", adminEmail);

const sb = createClient(url, key, { auth: { persistSession: false } });

// 1) resolver id do admin
const { data: uid, error: e0 } = await sb.rpc("get_user_id_by_email", { p_email: adminEmail });
console.log("get_user_id_by_email ->", uid, e0 ? `ERRO: ${e0.message}` : "");
if (!uid) { console.log("sem id; abortando"); process.exit(1); }

// 2) saldo atual
const { data: row, error: e1 } = await sb.from("user_credits").select("balance").eq("user_id", uid).maybeSingle();
console.log("saldo atual ->", row?.balance ?? "(sem linha)", e1 ? `ERRO: ${e1.message}` : "");

// 3) chamar credit_user com amount 0 (no-op de saldo)
const { data: rpc, error: e2 } = await sb.rpc("credit_user", {
  p_user_id: uid, p_amount: 0, p_source: "diagnostic-noop", p_metadata: { diag: true },
});
console.log("credit_user(0) ->", rpc, e2 ? `ERRO: ${JSON.stringify(e2)}` : "OK");

// 4) testar audit_log insert (o que a rota faz depois)
const { error: e3 } = await sb.from("audit_log").insert({ actor: adminEmail, action: "diagnostic", target: uid, metadata: { diag: true } });
console.log("audit_log insert ->", e3 ? `ERRO: ${JSON.stringify(e3)}` : "OK");

// 5) limpeza
await sb.from("credit_transactions").delete().eq("source", "diagnostic-noop");
await sb.from("audit_log").delete().eq("action", "diagnostic");
console.log("limpeza concluída");
