import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { hublaProvider } from "./hubla";
import { applyBillingEvent } from "./apply";
import type { BillingEvent } from "./types";

const SECRET = "whsec_test_123";
function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}
function hdrs(sig: string): Headers {
  return new Headers({ "x-hubla-signature": sig });
}

beforeEach(() => {
  vi.stubEnv("HUBLA_PRODUCT_PRO_MONTHLY", "prod_pro_m");
  vi.stubEnv("HUBLA_PRODUCT_PRO_ANNUAL", "prod_pro_a");
  vi.stubEnv("HUBLA_PRODUCT_PRO_PLUS_MONTHLY", "prod_plus_m");
  vi.stubEnv("HUBLA_PRODUCT_PRO_PLUS_ANNUAL", "prod_plus_a");
});
afterEach(() => vi.unstubAllEnvs());

describe("hublaProvider.verify", () => {
  it("aceita HMAC-SHA256 hex correto", () => {
    const body = '{"type":"invoice.payment_succeeded"}';
    expect(hublaProvider.verify(body, hdrs(sign(body)), SECRET)).toBe(true);
  });
  it("aceita prefixo sha256=", () => {
    const body = '{"a":1}';
    expect(hublaProvider.verify(body, hdrs("sha256=" + sign(body)), SECRET)).toBe(true);
  });
  it("aceita token estático no header", () => {
    expect(hublaProvider.verify("qualquer", new Headers({ "x-hubla-token": SECRET }), SECRET)).toBe(true);
  });
  it("rejeita assinatura errada", () => {
    expect(hublaProvider.verify('{"a":1}', hdrs("deadbeef"), SECRET)).toBe(false);
  });
  it("rejeita quando não há header de assinatura", () => {
    expect(hublaProvider.verify('{"a":1}', new Headers(), SECRET)).toBe(false);
  });
  it("aceita token estático em Authorization: Bearer", () => {
    expect(hublaProvider.verify("x", new Headers({ authorization: "Bearer " + SECRET }), SECRET)).toBe(true);
  });
  it("aceita token estático em x-hubla-token (esquema real da Hubla)", () => {
    expect(hublaProvider.verify("x", new Headers({ "x-hubla-token": SECRET }), SECRET)).toBe(true);
  });
});

describe("hublaProvider.parse", () => {
  it("ativa PRO mensal mapeando produto→plano", () => {
    const body = JSON.stringify({
      type: "invoice.payment_succeeded",
      event: { id: "evt_1", user: { email: "joao@x.com" }, product: { id: "prod_pro_m" } },
    });
    const ev = hublaProvider.parse(body);
    expect(ev).toMatchObject({ action: "activate", plan: "pro", period: "monthly", email: "joao@x.com", providerEventId: "evt_1" });
  });

  it("ativa PRO+ anual", () => {
    const body = JSON.stringify({
      type: "subscription.created",
      event: { id: "evt_2", userEmail: "ana@x.com", productId: "prod_plus_a" },
    });
    expect(hublaProvider.parse(body)).toMatchObject({ action: "activate", plan: "pro_plus", period: "annual", email: "ana@x.com" });
  });

  it("desativa em cancelamento (rebaixa para free)", () => {
    const body = JSON.stringify({ type: "subscription.canceled", event: { id: "evt_3", customer: { email: "z@x.com" } } });
    expect(hublaProvider.parse(body)).toMatchObject({ action: "deactivate", plan: "free", email: "z@x.com" });
  });

  it("ignora tipo de evento não mapeado", () => {
    expect(hublaProvider.parse(JSON.stringify({ type: "customer.updated", event: { user: { email: "a@x.com" } } }))).toBeNull();
  });

  it("ignora produto desconhecido (não promove plano errado)", () => {
    const body = JSON.stringify({ type: "invoice.payment_succeeded", event: { id: "e", user: { email: "a@x.com" }, product: { id: "prod_desconhecido" } } });
    expect(hublaProvider.parse(body)).toBeNull();
  });

  it("ignora evento sem e-mail", () => {
    expect(hublaProvider.parse(JSON.stringify({ type: "invoice.payment_succeeded", event: { product: { id: "prod_pro_m" } } }))).toBeNull();
  });

  it("retorna null em JSON inválido", () => {
    expect(hublaProvider.parse("não é json")).toBeNull();
  });

  // Nomes/rótulos reais da Hubla v2 (classificação por palavra-chave)
  it("classifica 'Assinatura ativa (v2)' como activate", () => {
    const body = JSON.stringify({ type: "Assinatura ativa (v2)", event: { id: "e", user: { email: "a@x.com" }, product: { id: "prod_pro_m" } } });
    expect(hublaProvider.parse(body)).toMatchObject({ action: "activate", plan: "pro", email: "a@x.com" });
  });
  it("classifica 'Solicitação reembolso' como deactivate", () => {
    const body = JSON.stringify({ type: "Solicitação reembolso", event: { id: "e", user: { email: "a@x.com" } } });
    expect(hublaProvider.parse(body)).toMatchObject({ action: "deactivate", plan: "free" });
  });
  it("'subscription.deactivated' (contém 'activ') vira deactivate, não activate", () => {
    const body = JSON.stringify({ type: "subscription.deactivated", event: { id: "e", user: { email: "a@x.com" } } });
    expect(hublaProvider.parse(body)).toMatchObject({ action: "deactivate" });
  });
});

describe("applyBillingEvent", () => {
  const activateEvent: BillingEvent = {
    action: "activate", providerEventId: "evt_1", email: "joao@x.com", plan: "pro", period: "monthly", periodEnd: null,
  };

  function fakeSb(rpcImpl: (fn: string, args: unknown) => { data?: unknown; error?: unknown }) {
    return { rpc: vi.fn((fn: string, args: unknown) => Promise.resolve(rpcImpl(fn, args))) } as never;
  }

  it("activated quando o RPC aplica", async () => {
    const sb = fakeSb((fn) =>
      fn === "get_user_id_by_email" ? { data: "uuid-1" } : { data: true },
    );
    expect(await applyBillingEvent(sb, activateEvent)).toBe("activated");
  });

  it("duplicate quando activate_subscription retorna false (idempotência)", async () => {
    const sb = fakeSb((fn) =>
      fn === "get_user_id_by_email" ? { data: "uuid-1" } : { data: false },
    );
    expect(await applyBillingEvent(sb, activateEvent)).toBe("duplicate");
  });

  it("user_not_found quando o e-mail não existe", async () => {
    const sb = fakeSb(() => ({ data: null }));
    expect(await applyBillingEvent(sb, activateEvent)).toBe("user_not_found");
  });

  it("deactivated chama o RPC certo", async () => {
    const calls: string[] = [];
    const sb = { rpc: vi.fn((fn: string) => { calls.push(fn); return Promise.resolve(fn === "get_user_id_by_email" ? { data: "uuid-1" } : { data: true }); }) } as never;
    const r = await applyBillingEvent(sb, { ...activateEvent, action: "deactivate", plan: "free" });
    expect(r).toBe("deactivated");
    expect(calls).toContain("deactivate_subscription");
  });

  it("error quando o RPC falha", async () => {
    const sb = fakeSb((fn) =>
      fn === "get_user_id_by_email" ? { data: "uuid-1" } : { error: { message: "boom" } },
    );
    expect(await applyBillingEvent(sb, activateEvent)).toBe("error");
  });
});
