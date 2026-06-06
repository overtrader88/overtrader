"use client";

import type { FullAnalysis } from "@/lib/analysis/full";
import { nearestLiquidity } from "@/lib/analysis/liquidity";

type Tone = "bull" | "bear" | "neu";

const WYCKOFF_PT: Record<string, { label: string; tone: Tone }> = {
  accumulation: { label: "Acumulação", tone: "bull" },
  markup: { label: "Markup (alta)", tone: "bull" },
  distribution: { label: "Distribuição", tone: "bear" },
  markdown: { label: "Markdown (baixa)", tone: "bear" },
  transition: { label: "Transição", tone: "neu" },
};
const BIAS_PT: Record<string, { label: string; tone: Tone }> = {
  bullish: { label: "Comprador", tone: "bull" },
  bearish: { label: "Vendedor", tone: "bear" },
  neutral: { label: "Neutro", tone: "neu" },
};

function Conf({ label, value, tone, sub }: { label: string; value: string; tone: Tone; sub?: string }) {
  return (
    <div className="ep-conf">
      <span className={`ep-dot ${tone}`} />
      <div className="ep-conf-b">
        <span className="ep-conf-l">{label}</span>
        <span className={`ep-conf-v ${tone}`}>{value}{sub ? <em> · {sub}</em> : null}</span>
      </div>
    </div>
  );
}

/**
 * "Análise ao Vivo" — mostra o motor CRUZANDO os sistemas (igual ao painel
 * ANALISANDO da concorrência, mas com nossos dados reais): confirmações
 * (regime, MTF, SMC, Wyckoff, Monte Carlo, harmônicos) + os Gates A–E que o
 * sinal precisa passar. Tudo medido — nada decorativo.
 */
export function EnginePipeline({ dto }: { dto: FullAnalysis }) {
  const a = dto.analysis;
  const mtf = dto.multiTimeframe;
  const mc = dto.montecarlo;
  const smc = dto.smc;
  const wy = dto.wegd?.wyckoff;
  const gates = a.gates ?? [];

  const confs: { label: string; value: string; tone: Tone; sub?: string }[] = [];
  if (a.meta.regime) confs.push({ label: "Regime", value: a.meta.regime, tone: "neu", sub: a.meta.adxValue != null ? `ADX ${a.meta.adxValue.toFixed(0)}` : undefined });
  if (mtf) confs.push({ label: "Multi-timeframe", value: `${mtf.confluenceScore}% confluência`, tone: mtf.confluenceScore >= 60 ? "bull" : mtf.confluenceScore <= 40 ? "bear" : "neu", sub: mtf.alignment });
  if (smc) { const b = BIAS_PT[smc.bias] ?? BIAS_PT.neutral!; confs.push({ label: "SMC (institucional)", value: b.label, tone: b.tone, sub: `${smc.orderBlocks.length} OB · ${smc.fvgs.length} FVG` }); }
  if (wy) { const w = WYCKOFF_PT[wy.phase] ?? WYCKOFF_PT.transition!; confs.push({ label: "Wyckoff", value: w.label, tone: w.tone, sub: `${Math.round(wy.confidence * 100)}% conf.` }); }
  if (mc) { const up = mc.winRateUp.value * 100; confs.push({ label: "Monte Carlo", value: `${up.toFixed(0)}% ↑`, tone: up >= 55 ? "bull" : up <= 45 ? "bear" : "neu", sub: `${mc.simulations.toLocaleString("pt-BR")} sims` }); }
  if (dto.harmonics && dto.harmonics.patterns.length) confs.push({ label: "Harmônicos", value: dto.harmonics.patterns[0]!.name, tone: "neu", sub: `${dto.harmonics.patterns.length} padrão(ões)` });
  const fp = (n: number) => (n >= 1000 ? n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : n.toFixed(2));
  if (dto.volumeProfile) confs.push({ label: "Volume Profile", value: `POC ${fp(dto.volumeProfile.poc)}`, tone: "neu", sub: `VA ${fp(dto.volumeProfile.val)}–${fp(dto.volumeProfile.vah)}` });
  if (dto.wyckoffEvents && dto.wyckoffEvents.length) { const last = dto.wyckoffEvents[dto.wyckoffEvents.length - 1]!; confs.push({ label: "Wyckoff (eventos)", value: `${last.type}`, tone: last.side, sub: `${dto.wyckoffEvents.length} no período` }); }
  const nl = nearestLiquidity(dto);
  if (nl && nl.above != null) confs.push({ label: "Alvo acima", value: fp(nl.above), tone: "bear", sub: `${nl.abovePct! >= 0 ? "+" : ""}${nl.abovePct!.toFixed(1)}% · ${nl.aboveLabel}` });
  if (nl && nl.below != null) confs.push({ label: "Alvo abaixo", value: fp(nl.below), tone: "bull", sub: `${nl.belowPct!.toFixed(1)}% · ${nl.belowLabel}` });

  const passed = gates.filter((g) => g.passed).length;

  return (
    <section className="ep">
      <div className="ep-head">
        <span className="ep-orb" /> Análise ao Vivo
        <span className="ep-sub">cruzamento de {confs.length} sistemas · {gates.length ? `${passed}/${gates.length} gates` : "sem gates"}</span>
      </div>

      <div className="ep-grid">
        <div className="ep-col">
          <div className="ep-col-h">Confirmações</div>
          {confs.map((c) => <Conf key={c.label} {...c} />)}
        </div>

        <div className="ep-col">
          <div className="ep-col-h">Gates obrigatórios</div>
          {gates.length === 0 ? <p className="note" style={{ fontSize: 12 }}>Sem gates neste modo.</p> : null}
          {gates.map((g) => (
            <div className="ep-gate" key={g.id}>
              <span className={`ep-gate-x ${g.passed ? "ok" : "no"}`}>{g.passed ? "✓" : "✕"}</span>
              <div className="ep-gate-b">
                <span className="ep-gate-n">{g.name}</span>
                <span className="ep-gate-d">{g.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
