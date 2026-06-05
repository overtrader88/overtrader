/**
 * Parser dos comandos do bot Telegram (Fase C5). PURO e testável.
 * Trata `/start <token>`, `/stop`, e o sufixo de menção (`/start@bot`).
 */
export interface ParsedCommand {
  cmd: string;
  arg: string;
}

export function parseCommand(text: string | undefined | null): ParsedCommand | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  // remove menção: "/start@OvertraderBot" → "start"
  const cmd = head!.slice(1).split("@")[0]!.toLowerCase();
  return { cmd, arg: rest.join(" ").trim() };
}
