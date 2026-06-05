import { describe, it, expect, vi } from "vitest";
import { sendTelegram } from "./telegram";
import { sendEmail, notifyEmail } from "./email";
import { formatSignalTelegram, formatAlertTelegram, type BroadcastSignal } from "./format";

const SIGNAL: BroadcastSignal = {
  symbol: "BTCUSDT", timeframe: "4h", direction: "STRONG_BUY", side: "buy",
  entry: 100000, stopLoss: 96000, tp1: 108000, tp2: 116000, tp3: 124000, seal: "green", rr1: 2,
};

type Init = { headers?: Record<string, string>; body: string };
const okFetch = () => vi.fn((_url: string, _init?: unknown): Promise<{ ok: boolean }> => Promise.resolve({ ok: true }));

describe("sendTelegram", () => {
  it("chama a Bot API com chat_id + texto e retorna ok", async () => {
    const fetchImpl = okFetch();
    const ok = await sendTelegram("TOKEN123", "555", "olá", fetchImpl);
    expect(ok).toBe(true);
    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe("https://api.telegram.org/botTOKEN123/sendMessage");
    const body = JSON.parse((call[1] as Init).body);
    expect(body.chat_id).toBe("555");
    expect(body.text).toBe("olá");
  });

  it("falha graciosa (retorna false) quando o fetch lança", async () => {
    const throwing = vi.fn((_url: string, _init?: unknown): Promise<{ ok: boolean }> => Promise.reject(new Error("net")));
    expect(await sendTelegram("T", "1", "x", throwing)).toBe(false);
  });
});

describe("sendEmail", () => {
  it("POSTa no Resend com Authorization e payload", async () => {
    const fetchImpl = okFetch();
    const ok = await sendEmail("re_key", "a@x.com", "b@y.com", "Assunto", "<p>oi</p>", fetchImpl);
    expect(ok).toBe(true);
    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe("https://api.resend.com/emails");
    const i = call[1] as Init;
    expect(i.headers?.Authorization).toBe("Bearer re_key");
    expect(JSON.parse(i.body).to).toBe("b@y.com");
  });

  it("falha graciosa (false) quando o fetch lança", async () => {
    const throwing = vi.fn((_url: string, _init?: unknown): Promise<{ ok: boolean }> => Promise.reject(new Error("net")));
    expect(await sendEmail("re_k", "a@x.com", "b@y.com", "S", "<p>x</p>", throwing)).toBe(false);
  });
});

describe("notifyEmail", () => {
  it("no-op gracioso ('unconfigured') quando falta destinatário", async () => {
    expect(await notifyEmail(null, "S", "<p>x</p>")).toBe("unconfigured");
    expect(await notifyEmail("", "S", "<p>x</p>")).toBe("unconfigured");
  });

  it("no-op gracioso quando falta RESEND_API_KEY/EMAIL_FROM", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    expect(await notifyEmail("dest@y.com", "S", "<p>x</p>")).toBe("unconfigured");
    vi.unstubAllEnvs();
  });
});

describe("format", () => {
  it("mensagem do sinal traz ativo, níveis e aviso de risco", () => {
    const msg = formatSignalTelegram(SIGNAL);
    expect(msg).toContain("BTCUSDT");
    expect(msg).toContain("COMPRA FORTE");
    expect(msg).toContain("não recomendação");
  });
  it("alerta de watchlist traz força e aviso", () => {
    const msg = formatAlertTelegram({ symbol: "ETHUSDT", timeframe: "1d", signal: "BUY", strength: 72 });
    expect(msg).toContain("ETHUSDT");
    expect(msg).toContain("72");
    expect(msg).toContain("risco");
  });
});
