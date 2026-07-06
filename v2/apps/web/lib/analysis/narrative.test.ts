import { describe, it, expect } from "vitest";
import { validateEvoCore } from "./narrative";

/**
 * validateEvoCore — camada (a) DETERMINÍSTICA do gate do núcleo-filho
 * (achado 30, Darwin 2.0). Só a parte regex/normalização é testada aqui;
 * a camada (b) — smoke test com generateEvoDecision — envolve rede e vive
 * no prepareEvoSlots (falha → renasce com o pai, sem teste unitário).
 */

const VALID_CORE = [
  "ESTRATÉGIA-NÚCLEO (g2 — níveis com regime): opere apenas com preço encostado em nível objetivo (order block, liquidez, VAL/VAH ou PRZ).",
  "Compra em suporte com volume confirmando; venda em resistência com volume confirmando.",
  "Exija dois pilares independentes concordando; em regime de transição, três.",
].join("\n");

describe("validateEvoCore (gate duro determinístico)", () => {
  it("aceita um núcleo válido e devolve o texto normalizado", () => {
    const v = validateEvoCore(VALID_CORE);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.core).toBe(VALID_CORE);
  });

  it("normaliza fences markdown e aspas envolventes ANTES de validar (não sobre-rejeita)", () => {
    const fenced = "```\n" + VALID_CORE + "\n```";
    expect(validateEvoCore(fenced).ok).toBe(true);
    const quoted = `"${VALID_CORE}"`;
    expect(validateEvoCore(quoted).ok).toBe(true);
  });

  it("aceita cabeçalho com variação de caixa/acento", () => {
    const v = validateEvoCore(VALID_CORE.replace("ESTRATÉGIA-NÚCLEO", "Estratégia-Núcleo"));
    expect(v.ok).toBe(true);
  });

  it("rejeita vazio/curto", () => {
    expect(validateEvoCore(null)).toEqual({ ok: false, reason: "vazio" });
    expect(validateEvoCore("")).toEqual({ ok: false, reason: "vazio" });
    expect(validateEvoCore("ESTRATÉGIA-NÚCLEO: curta")).toEqual({ ok: false, reason: "curto" });
  });

  it("rejeita sem o cabeçalho ESTRATÉGIA-NÚCLEO", () => {
    const v = validateEvoCore("Compre sempre no suporte.\nVenda na resistência.\nUse volume como confirmação em todos os trades.");
    expect(v).toEqual({ ok: false, reason: "cabecalho" });
  });

  it("rejeita fora de 3-8 linhas (o breed pede 3-6; quebras extras toleradas)", () => {
    const twoLines = "ESTRATÉGIA-NÚCLEO: opere apenas em tendência clara confirmada pelo ADX.\nCompre pullbacks nas médias com estrutura alinhada.";
    expect(validateEvoCore(twoLines)).toEqual({ ok: false, reason: "linhas" });
    const nineLines = ["ESTRATÉGIA-NÚCLEO: opere apenas em tendência clara confirmada pelo ADX e estrutura."].concat(Array.from({ length: 8 }, (_, i) => `Regra adicional número ${i + 1} sobre filtros.`)).join("\n");
    expect(validateEvoCore(nineLines)).toEqual({ ok: false, reason: "linhas" });
  });

  it("rejeita promessa de lucro/retorno (risco reputacional — núcleo é público)", () => {
    const promise = VALID_CORE.replace(
      "Exija dois pilares independentes concordando; em regime de transição, três.",
      "Essa abordagem garante retorno consistente de 20% ao mês na banca.",
    );
    expect(validateEvoCore(promise)).toEqual({ ok: false, reason: "blacklist" });
    const doubles = VALID_CORE.replace(
      "Exija dois pilares independentes concordando; em regime de transição, três.",
      "Seguindo estas regras a estratégia dobra a banca em poucos meses.",
    );
    expect(validateEvoCore(doubles)).toEqual({ ok: false, reason: "blacklist" });
  });

  it("rejeita instruções de formato de saída (o contrato fixo é quem manda)", () => {
    const fmt = VALID_CORE.replace(
      "Exija dois pilares independentes concordando; em regime de transição, três.",
      "Responda sempre em JSON com o campo lado preenchido.",
    );
    expect(validateEvoCore(fmt)).toEqual({ ok: false, reason: "blacklist" });
  });

  it("NÃO bloqueia usos legítimos de 'lucro'/'garanta' fora de promessa", () => {
    const legit = [
      "ESTRATÉGIA-NÚCLEO (g3 — capital primeiro): preservar capital vem antes do lucro em toda decisão.",
      "Garanta confluência de dois pilares independentes antes de qualquer entrada.",
      "Em regime lateral sem nível próximo, fique de fora.",
    ].join("\n");
    expect(validateEvoCore(legit).ok).toBe(true);
  });

  it("aplica o slice(0,2000) ANTES de validar (filho gigante não passa inteiro)", () => {
    const long = VALID_CORE + "\n" + "x".repeat(3000);
    const v = validateEvoCore(long);
    if (v.ok) expect(v.core.length).toBeLessThanOrEqual(2000);
  });
});
