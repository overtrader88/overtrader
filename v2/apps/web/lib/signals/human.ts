/**
 * DESAFIO HUMANOS vs MÁQUINAS — helpers PUROS dos competidores humanos.
 *
 * Sinais humanos entram no MESMO track record forward dos motores, com
 * `engine = "humano_<slug>"` (ex.: humano_joao). Como os registries de motor
 * são estáticos (rótulo/cor/tag), tudo que é `humano_*` usa o fallback
 * genérico daqui: label = slug capitalizado, cor rosa (#fb7185), tag 🧑.
 * Módulo sem dependência de server — importável no client e no server.
 */
import { z } from "zod";
import { ASSET_TYPES, TIMEFRAMES } from "@tradeai/shared";

export const HUMAN_ENGINE_PREFIX = "humano_";
/** Cor única dos humanos nas UIs (rosa — distinta do amarelo dos LLM). */
export const HUMAN_ENGINE_COLOR = "#fb7185";

export const isHumanEngine = (id: string): boolean => id.startsWith(HUMAN_ENGINE_PREFIX);

/** Slug do competidor a partir do id do motor ("humano_joao_silva" → "joao_silva"). */
export const humanSlug = (id: string): string => id.slice(HUMAN_ENGINE_PREFIX.length);

/** Rótulo genérico: slug capitalizado ("humano_joao_silva" → "Joao Silva"). */
export function humanEngineLabel(id: string): string {
  const words = humanSlug(id).split(/[_-]+/).filter(Boolean);
  if (words.length === 0) return id;
  return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");
}

/** Tag com ícone p/ listas ("humano_joao" → "🧑 Joao"). */
export const humanEngineTag = (id: string): string => `🧑 ${humanEngineLabel(id)}`;

/** Normaliza um nome digitado para slug ("João Silva" → "joao_silva"). */
export function slugifyCompetitor(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (marcas combinantes do NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

/** Body do POST /api/admin/human-signal (plano manual do competidor). */
export const humanSignalSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,23}$/, "slug inválido (a-z, 0-9, _ ou -; até 24)"),
  symbol: z.string().min(2).max(20),
  assetType: z.enum(ASSET_TYPES),
  timeframe: z.enum(TIMEFRAMES),
  side: z.enum(["buy", "sell"]),
  /** Convicção alta → direção STRONG (afeta o sizing do Ringue de Sobrevivência). */
  strong: z.boolean().optional(),
  entry: z.number().finite().positive(),
  stop: z.number().finite().positive(),
  tp1: z.number().finite().positive(),
  tp2: z.number().finite().positive(),
  tp3: z.number().finite().positive(),
});
export type HumanSignalInput = z.infer<typeof humanSignalSchema>;

/**
 * Coerência geométrica do plano manual: compra → stop < entrada < tp1 < tp2 < tp3;
 * venda espelhada. Devolve a mensagem do problema ou null se o plano fecha.
 */
export function validateHumanPlan(p: Pick<HumanSignalInput, "side" | "entry" | "stop" | "tp1" | "tp2" | "tp3">): string | null {
  if (p.side === "buy") {
    if (!(p.stop < p.entry)) return "Compra: o stop precisa ficar ABAIXO da entrada.";
    if (!(p.entry < p.tp1 && p.tp1 < p.tp2 && p.tp2 < p.tp3)) return "Compra: os alvos precisam ficar ACIMA da entrada, em ordem (tp1 < tp2 < tp3).";
  } else {
    if (!(p.stop > p.entry)) return "Venda: o stop precisa ficar ACIMA da entrada.";
    if (!(p.entry > p.tp1 && p.tp1 > p.tp2 && p.tp2 > p.tp3)) return "Venda: os alvos precisam ficar ABAIXO da entrada, em ordem (tp1 > tp2 > tp3).";
  }
  return null;
}
