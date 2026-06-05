import { describe, expect, it } from "vitest";
import { rateLimit } from "./limit";

function req(ip: string): Request {
  return new Request("https://x.test/api/whatever", { headers: { "x-forwarded-for": ip } });
}

describe("rateLimit", () => {
  it("libera até o limite e bloqueia o excedente com 429 + Retry-After", async () => {
    const name = "test-burst";
    // 3 permitidas
    for (let i = 0; i < 3; i++) {
      expect(await rateLimit(req("1.1.1.1"), name, 3)).toBeNull();
    }
    // 4ª estoura
    const blocked = await rateLimit(req("1.1.1.1"), name, 3);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();
    const body = await blocked!.json();
    expect(body.error).toMatch(/Muitas requisições/);
  });

  it("isola clientes por IP", async () => {
    const name = "test-iso";
    expect(await rateLimit(req("2.2.2.2"), name, 1)).toBeNull();
    // mesmo IP estoura...
    expect(await rateLimit(req("2.2.2.2"), name, 1)).not.toBeNull();
    // ...mas outro IP ainda passa
    expect(await rateLimit(req("3.3.3.3"), name, 1)).toBeNull();
  });

  it("usa x-real-ip quando não há x-forwarded-for", async () => {
    const name = "test-realip";
    const r = new Request("https://x.test/", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(await rateLimit(r, name, 1)).toBeNull();
    expect(await rateLimit(r, name, 1)).not.toBeNull();
  });
});
