/**
 * Canal e-mail (Fase C2) via Resend (API HTTP simples). `sendEmail` é a chamada
 * crua (fetch injetável → testável). `notifyEmail` lê `RESEND_API_KEY`/`EMAIL_FROM`
 * do ambiente e vira no-op gracioso quando não configurado.
 */
import { withTimeout } from "@/lib/http/with-timeout";
import type { NotifyResult } from "./telegram";

type FetchLike = (url: string, init?: unknown) => Promise<{ ok: boolean }>;

export async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html }),
      }),
      10000,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyEmail(to: string | undefined | null, subject: string, html: string): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || !to) return "unconfigured";
  // Mostra "Overtrader <addr>" como remetente; se o env já trouxer display name, respeita.
  const fromHeader = from.includes("<") ? from : `Overtrader <${from}>`;
  return (await sendEmail(apiKey, fromHeader, to, subject, html)) ? "sent" : "error";
}
