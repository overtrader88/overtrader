import type { CSSProperties } from "react";

export interface ConfidenceBadgeProps {
  /** Rótulo curto da métrica (ex.: "Profit factor"). */
  label: string;
  /** Estimativa pontual. */
  value: number;
  /** Intervalo de confiança [inferior, superior]. */
  ci: [number, number];
  /** Tamanho da amostra. */
  n: number;
  /** Método do IC (ex.: "bootstrap", "Wilson", "t-Student"). */
  method?: string;
  /** Período coberto, legível (ex.: "jan/24–mai/26"). */
  period?: string;
  /** Limites do eixo de leitura. */
  min: number;
  max: number;
  /** Direção visual: positiva (verde) ou negativa (rosa). */
  tone?: "pos" | "neg";
  /** Formatação dos números (default: pt-BR, 2 casas). */
  format?: (n: number) => string;
}

const defaultFormat = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * ConfidenceBadge — o componente-assinatura do Overtrader.
 * Desenha a estimativa como leitura de instrumento: régua, faixa do IC e
 * retícula em cruz no ponto-estimativa. Materializa "prova antes de prometer":
 * todo número carrega amostra (n), intervalo de confiança e período.
 */
export function ConfidenceBadge({
  label,
  value,
  ci,
  n,
  method,
  period,
  min,
  max,
  tone = "pos",
  format = defaultFormat,
}: ConfidenceBadgeProps) {
  const [lo, hi] = ci;
  // A POSIÇÃO visual é clampada a [min,max] — com amostra minúscula o IC pode
  // estourar a régua (ex.: R médio IC −9,78 numa faixa −1..1,5). A faixa então
  // "encosta" nas bordas (sinaliza incerteza enorme) sem vazar o medidor. O TEXTO
  // do IC abaixo continua mostrando os números reais, sem clamp.
  const clamp = (x: number) => Math.min(max, Math.max(min, x));
  const style: CSSProperties & Record<`--${string}`, number> = {
    "--min": min,
    "--max": max,
    "--lo": clamp(lo),
    "--hi": clamp(hi),
    "--v": clamp(value),
  };
  const meta = [`n=${n}`, method, period].filter(Boolean).join(" · ");
  return (
    <div className={`cib ${tone}`} style={style}>
      <div className="t">
        <span className="nm">{label}</span>
        <span className="pt">{format(value)}</span>
      </div>
      <div className="sc">
        <div className="ax" />
        <div className="bd" />
        <div className="rt" />
        <div className="dot" />
      </div>
      <div className="ft">
        <span>
          IC 95%{" "}
          <b>
            {format(lo)} — {format(hi)}
          </b>
        </span>
        <span>{meta}</span>
      </div>
    </div>
  );
}
