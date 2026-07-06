/**
 * Carrega .env.local no process.env para os scripts de MEDIÇÃO offline (tsx não
 * carrega env do Next). Não sobrescreve variáveis já presentes no ambiente.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvLocal(): void {
  for (const dir of [process.cwd(), resolve(process.cwd(), "..")]) {
    try {
      const txt = readFileSync(resolve(dir, ".env.local"), "utf8");
      for (const line of txt.split(/\r?\n/)) {
        const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
        if (!m) continue;
        const key = m[1]!;
        if (process.env[key] !== undefined) continue;
        process.env[key] = m[2]!.replace(/^["']|["']$/g, "");
      }
      return;
    } catch { /* tenta o próximo diretório */ }
  }
}
