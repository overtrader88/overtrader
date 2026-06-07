import { AppBar, Panel, PanelLabel, RadialGauge } from "@/components/ui";
import { AnalysisShell } from "@/components/analysis-shell";
import { analyzeSymbol } from "@/lib/analysis/service";
import { findAsset } from "@/lib/market/catalog";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { recordAnalysisView, getAnalysisById, recentAnalyses } from "@/lib/history";
import { LastAnalysisBanner } from "@/components/last-analysis-banner";
import { checkAnalysisCredit, chargeAnalysis } from "@/lib/credits";
import { AiNarrative } from "@/components/ai-narrative";
import { NewsCard } from "@/components/news-card";
import { FundamentalCard } from "@/components/fundamental-card";
import { PriceChart } from "@/components/price-chart";
import { ReportActions } from "@/components/report-actions";
import { BacktestLab } from "@/components/backtest-lab";
import { buildPriceLines } from "@/lib/analysis/chart-overlays";
import { buildTradeGuard } from "@/lib/analysis/trade-guard";
import { signalSide } from "@tradeai/shared";
import type { AssetType, Timeframe, SignalDirection } from "@tradeai/shared";
import type { ScenarioSide } from "@tradeai/engine";
import type { FullAnalysis } from "@/lib/analysis/full";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

// ---------- formatação ----------
const fmtPrice = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 });
const pct = (x: number) => `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const signed = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

const SIGNAL_PT: Record<SignalDirection, string> = {
  STRONG_BUY: "COMPRA FORTE",
  BUY: "COMPRA",
  WEAK_BUY: "COMPRA FRACA",
  NEUTRAL: "NEUTRO",
  WEAK_SELL: "VENDA FRACA",
  SELL: "VENDA",
  STRONG_SELL: "VENDA FORTE",
};

// ---------- resolução de parâmetros ----------
const ASSET_TYPES: readonly AssetType[] = ["crypto", "forex", "commodities", "indices", "stocks"];
const TFS: readonly Timeframe[] = ["15m", "1h", "4h", "1d", "1w", "1M"];

function resolveAssetType(raw: unknown, symbol: string): AssetType {
  if (typeof raw === "string" && (ASSET_TYPES as readonly string[]).includes(raw)) return raw as AssetType;
  return findAsset(symbol)?.assetType ?? "crypto";
}
function resolveTf(raw: unknown): Timeframe {
  if (typeof raw === "string" && (TFS as readonly string[]).includes(raw)) return raw as Timeframe;
  return "4h";
}

type Tone = "bull" | "bear" | "neu";
function toneOf(s: SignalDirection): Tone {
  const side = signalSide(s);
  return side === "buy" ? "bull" : side === "sell" ? "bear" : "neu";
}
function bigStyle(tone: Tone): CSSProperties {
  const c = tone === "bull" ? "var(--bull)" : tone === "bear" ? "var(--bear)" : "var(--ink-soft)";
  const shadow = tone === "bull" ? "0 0 38px rgba(43,212,158,.36)" : tone === "bear" ? "0 0 38px rgba(255,107,138,.36)" : "none";
  return { color: c, textShadow: shadow };
}

// ---------- selo ----------
type SealStatus = "green" | "yellow" | "red" | "grey";
const SEAL: Record<SealStatus, { label: string; sub: string; color: string }> = {
  green: { label: "VALIDADO", sub: "SELO VERDE", color: "var(--bull)" },
  yellow: { label: "RESSALVA", sub: "SELO AMARELO", color: "var(--amber)" },
  red: { label: "REPROVADO", sub: "SELO VERMELHO", color: "var(--bear)" },
  grey: { label: "INSUFICIENTE", sub: "SEM SELO", color: "var(--ink-faint)" },
};
function sealOf(status?: string) {
  const k: SealStatus = status === "green" || status === "yellow" || status === "red" ? status : "grey";
  return SEAL[k];
}

function voteClass(v: string): string {
  const u = v.toUpperCase();
  return u.includes("BUY") ? "up" : u.includes("SELL") ? "dn" : "";
}
function fmtIndicator(value: number | Record<string, number> | null): string {
  if (typeof value === "number") return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (value == null || typeof value !== "object") return "—"; // VWMA null em ativo sem volume
  const first = Object.values(value)[0];
  return typeof first === "number" ? first.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—";
}

// ======================= blocos =======================
function Verdict({ dto }: { dto: FullAnalysis }) {
  const sig = dto.analysis.signal;
  const tone = toneOf(sig.signal);
  return (
    <Panel>
      <span className="cn tl" /><span className="cn tr" /><span className="cn bl" /><span className="cn br" />
      <PanelLabel>Sinal final · {dto.analysis.indicators.length} indicadores</PanelLabel>
      <div className="hero2">
        <div className="verdict">
          <div className="kick">Recomendação</div>
          <div className="big" style={bigStyle(tone)}>{SIGNAL_PT[sig.signal]}</div>
          <div className="sub">{dto.analysis.explanation.summary}</div>
          <div className="telem">
            <div><div className="k">Confluência</div><div className="v">{sig.confluence}<small>/10</small></div></div>
            <div><div className="k">Votos B·N·S</div><div className="v"><span className="b">{sig.votes.buy}</span><span className="n">·{sig.votes.neutral}·</span><span className="s">{sig.votes.sell}</span></div></div>
            <div><div className="k">R:R (TP1)</div><div className="v">{dto.analysis.risk.rr1.toFixed(1)}</div></div>
          </div>
        </div>
        <RadialGauge value={sig.strength} caption="Força do sinal" showOutOf />
      </div>
    </Panel>
  );
}

const GUARD_TONE: Record<string, string> = {
  green: "var(--bull)", yellow: "var(--amber)", red: "var(--bear)", grey: "var(--ink-faint)",
};

/**
 * Painel "Decisão · operar ou não" (Fase B2) — o diferencial honesto. Quando há
 * impeditivos, lista os motivos OBJETIVOS para NÃO operar; quando não há, mostra
 * os pontos a favor. Confronta o "sempre opere" do concorrente.
 */
function TradeGuardPanel({ dto }: { dto: FullAnalysis }) {
  const g = buildTradeGuard(dto);
  const color = GUARD_TONE[g.tone] ?? "var(--ink-faint)";
  return (
    <Panel>
      <PanelLabel>Decisão · operar ou não</PanelLabel>
      <div className={`guard ${g.operate ? "ok" : "no"}`} style={{ ["--gc" as string]: color }}>
        <div className="g-head">
          <span className="g-led" />
          <span className="g-title">{g.headline}</span>
          <span className="g-verdict">{g.operate ? "OPERÁVEL" : "NÃO OPERAR"}</span>
        </div>
        {g.reasons.length > 0 ? (
          <div className="g-list">
            {g.reasons.map((r, i) => (
              <div className={`g-reason ${r.severity}`} key={i}>
                <span className="g-tag">{r.severity === "block" ? "IMPEDITIVO" : "RESSALVA"}</span>
                <span className="g-rx"><b>{r.title}</b> — {r.detail}</span>
              </div>
            ))}
          </div>
        ) : null}
        {g.pros.length > 0 ? (
          <div className="g-pros">
            <span className="g-pk">A favor</span>
            {g.pros.map((p, i) => <span className="g-pi" key={i}>{p}</span>)}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function LevelsAndSeal({ dto }: { dto: FullAnalysis }) {
  const { risk, signal } = dto.analysis;
  const side = signalSide(signal.signal);
  const bt = dto.backtest;
  const seal = sealOf(dto.quality?.status);
  const rOf = (price: number) => (risk.distSL > 0 ? Math.abs(price - risk.entry) / risk.distSL : 0);
  const r1 = risk.rr1, r2 = rOf(risk.takeProfit2), r3 = rOf(risk.takeProfit3);
  const maxR = Math.max(r1, r2, r3, 1);
  const w = (r: number) => `${Math.max(6, (r / maxR) * 100)}%`;
  return (
    <div className="grid2" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
      <Panel>
        <PanelLabel>Plano operacional · níveis por ATR</PanelLabel>
        {side === "neutral" ? (
          <p className="note">Sinal <b>neutro</b> — sem plano operacional. O motor não aponta entrada com convicção suficiente neste momento.</p>
        ) : (
          <div className="ladder">
            <div className="rung tp"><span className="tag">TP3</span><div className="dist"><i style={{ width: w(r3) }} /></div><span className="px">{fmtPrice(risk.takeProfit3)}</span><span className="rr">R {r3.toFixed(1)}</span></div>
            <div className="rung tp"><span className="tag">TP2</span><div className="dist"><i style={{ width: w(r2) }} /></div><span className="px">{fmtPrice(risk.takeProfit2)}</span><span className="rr">R {r2.toFixed(1)}</span></div>
            <div className="rung tp"><span className="tag">TP1</span><div className="dist"><i style={{ width: w(r1) }} /></div><span className="px">{fmtPrice(risk.takeProfit1)}</span><span className="rr">R {r1.toFixed(1)}</span></div>
            <div className="rung entry"><span className="tag">ENTRADA</span><div className="dist"><i style={{ width: "50%" }} /></div><span className="px">{fmtPrice(risk.entry)}</span><span className="rr">agora</span></div>
            <div className="rung sl"><span className="tag">STOP</span><div className="dist"><i style={{ width: w(1) }} /></div><span className="px">{fmtPrice(risk.stopLoss)}</span><span className="rr">R −1.0</span></div>
          </div>
        )}
      </Panel>
      <Panel>
        <PanelLabel>Selo de qualidade</PanelLabel>
        <div className="seal-head">
          <span className="seal-led" style={{ background: seal.color, boxShadow: `0 0 0 4px color-mix(in srgb, ${seal.color} 18%, transparent), 0 0 16px ${seal.color}` }} />
          <span className="st" style={{ color: seal.color }}>{seal.label}<small>{seal.sub} · BACKTEST n={bt?.decisiveTrades ?? 0}</small></span>
        </div>
        {dto.quality ? (
          <div className="chk simples-only" style={{ borderBottom: "none" }}><span className="i">▸</span> {dto.quality.reason}</div>
        ) : null}
        {bt ? (
          <>
            <div className="chk adv-only"><span className="i">▸</span> PF lower-CI <b>{bt.profitFactor.ci95[0].toFixed(2)}</b> <span className="v">{bt.profitFactor.ci95[0] >= 1.5 ? "≥ 1.50 ✓" : "< 1.50 ⚠"}</span></div>
            <div className="chk adv-only"><span className="i">▸</span> Win rate lower-CI <b>{(bt.winRate.ci95[0] * 100).toFixed(1)}%</b> <span className="v">{bt.winRate.ci95[0] >= 0.5 ? "≥ 50% ✓" : "< 50% ⚠"}</span></div>
            <div className="chk adv-only"><span className="i">▸</span> Amostra <b>n={bt.decisiveTrades}</b> <span className="v">{bt.decisiveTrades >= bt.minDecisiveTrades ? `≥ ${bt.minDecisiveTrades} ✓` : `< ${bt.minDecisiveTrades} ⚠`}</span></div>
            <div className="chk adv-only"><span className="i">▸</span> Out-of-sample <b>{bt.outOfSample ? (bt.outOfSample.profitFactor.value > 1 ? "robusto" : "fraco") : "n/d"}</b> <span className="v">{bt.outOfSample && bt.outOfSample.profitFactor.value > 1 ? "✓" : "⚠"}</span></div>
          </>
        ) : null}
        <div className="seal-note">Verde só quando o <b>limite inferior do IC</b> supera o limiar — nunca sobre amostra pequena. "Prova antes de prometer", medido.</div>
      </Panel>
    </div>
  );
}

function MomentumPanel({ analysis }: { analysis: FullAnalysis["analysis"] }) {
  const inds = analysis.indicators;
  const rsi = inds.find((i) => i.name.toUpperCase().includes("RSI"));
  const rsiVal = rsi && typeof rsi.value === "number" ? rsi.value : null;
  return (
    <Panel className="adv-only">
      <PanelLabel>Momentum &amp; confirmações</PanelLabel>
      <div className="momentum">
        {rsiVal != null ? <RadialGauge value={rsiVal} decimals={1} solid size={128} stroke={10} caption="RSI" /> : null}
        <div className="ind-grid">
          {inds.slice(0, 6).map((ind) => (
            <div className="s" key={ind.name}>
              <div className="k">{ind.name}</div>
              <div className={`v ${voteClass(String(ind.vote))}`}>{fmtIndicator(ind.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function MonteCarloPanel({ mc }: { mc: NonNullable<FullAnalysis["montecarlo"]> }) {
  const lo = Math.min(mc.pessimistic, mc.currentPrice);
  const hi = Math.max(mc.optimistic, mc.currentPrice);
  const pad = (hi - lo) * 0.08 || Math.abs(mc.currentPrice) * 0.02 || 1;
  const min = lo - pad, max = hi + pad, span = max - min || 1;
  const xN = (p: number) => Math.max(0, Math.min(100, ((p - min) / span) * 100));
  const xNow = xN(mc.currentPrice), xMed = xN(mc.median), xLo = xN(mc.pessimistic), xHi = xN(mc.optimistic);
  const up = mc.winRateUp;
  return (
    <Panel className="adv-only">
      <PanelLabel>Monte Carlo · {mc.simulations.toLocaleString("pt-BR")} trajetórias · {mc.horizonCandles} candles à frente</PanelLabel>
      <div className="cone">
        <span className="pin t" style={{ left: `${xNow}%`, color: "var(--cyan)" }}>AGORA {fmtPrice(mc.currentPrice)}</span>
        <div className="band" style={{ left: `${xLo}%`, right: `${100 - xHi}%` }} />
        <div className="now" style={{ left: `${xNow}%` }} />
        <div className="med" style={{ left: `${xMed}%` }} />
        <span className="pin b" style={{ left: `${xLo}%` }}>P10 · {fmtPrice(mc.pessimistic)}</span>
        <span className="pin b" style={{ left: `${xMed}%` }}>MEDIANA · {fmtPrice(mc.median)}</span>
        <span className="pin b" style={{ left: `${xHi}%` }}>P90 · {fmtPrice(mc.optimistic)}</span>
      </div>
      <div className="mc-stats">
        <div className="s"><div className="k">Prob. de alta</div><div className="v" style={{ color: "var(--bull)" }}>{pct(up.value * 100)} <em>[{(up.ci95[0] * 100).toFixed(1)}–{(up.ci95[1] * 100).toFixed(1)}]</em></div></div>
        <div className="s"><div className="k">Vol. anualizada</div><div className="v">{pct(mc.volatilityAnnualized)}</div></div>
        <div className="s"><div className="k">Vol. / passo</div><div className="v">{pct(mc.volatilityPerStep * 100)}</div></div>
        <div className="s"><div className="k">Amostra</div><div className="v">n={mc.simulations.toLocaleString("pt-BR")}</div></div>
      </div>
    </Panel>
  );
}

function ScenarioCol({ s, reco }: { s: ScenarioSide; reco: boolean }) {
  const cls = s.side === "buy" ? "buy" : "sell";
  const tps: { k: string; t: ScenarioSide["tp1"] }[] = [
    { k: "TP1", t: s.tp1 },
    { k: "TP2", t: s.tp2 },
    { k: "TP3", t: s.tp3 },
  ];
  return (
    <div className={`side ${cls}${reco ? " reco" : ""}`}>
      {reco ? <span className="tag-reco">Recomendado</span> : null}
      <div className="h"><span className="t">{s.side === "buy" ? "Compra" : "Venda"}</span><span className="er">R esperado {signed(s.expectedR)}</span></div>
      {tps.map(({ k, t }) => {
        const v = t.probability.value * 100, lo = t.probability.ci95[0] * 100, hi = t.probability.ci95[1] * 100;
        return (
          <div className="prob" key={k}>
            <div className="pl"><span>{k}</span><span>{Math.round(v)}% <span className="ci-in">[{Math.round(lo)}–{Math.round(hi)}]</span></span></div>
            <div className="pbar"><div className="pf" style={{ width: `${v}%` }} /><div className="rng" style={{ left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }} /></div>
          </div>
        );
      })}
      <div className="prob">
        <div className="pl"><span>Stop antes do TP1</span><span>{Math.round(s.stopProbability.value * 100)}% <span className="ci-in">[{Math.round(s.stopProbability.ci95[0] * 100)}–{Math.round(s.stopProbability.ci95[1] * 100)}]</span></span></div>
        <div className="pbar"><div className="pf" style={{ width: `${s.stopProbability.value * 100}%`, background: "var(--bear)" }} /></div>
      </div>
    </div>
  );
}

function ScenariosPanel({ sc }: { sc: NonNullable<FullAnalysis["scenarios"]> }) {
  return (
    <Panel className="adv-only">
      <PanelLabel>Cenários compra × venda · probabilidade por first-passage</PanelLabel>
      <div className="scen">
        <ScenarioCol s={sc.buy} reco={sc.recommended === "buy"} />
        <ScenarioCol s={sc.sell} reco={sc.recommended === "sell"} />
      </div>
      <div className="note">
        Probabilidades estimadas contando trajetórias simuladas que tocam cada nível <b>antes</b> do stop — não por fórmula
        fechada. <b>{sc.recommended === "buy" ? "Compra" : "Venda"}</b> recomendada pelo maior R esperado (vantagem de{" "}
        <b>{signed(sc.edge)} R</b>).
      </div>
    </Panel>
  );
}

const SMC_BIAS_PT: Record<"bullish" | "bearish" | "neutral", { label: string; cls: string }> = {
  bullish: { label: "ALTA", cls: "bull" },
  bearish: { label: "BAIXA", cls: "bear" },
  neutral: { label: "NEUTRO", cls: "neu" },
};
const SMC_STRUCT_PT: Record<string, string> = {
  bullish_bos: "BOS de alta · continuação",
  bearish_bos: "BOS de baixa · continuação",
  bullish_choch: "CHoCH de alta · possível reversão ↑",
  bearish_choch: "CHoCH de baixa · possível reversão ↓",
  consolidating: "Consolidando · sem quebra recente",
};

function SmcPanel({ smc, price }: { smc: NonNullable<FullAnalysis["smc"]>; price: number }) {
  const bias = SMC_BIAS_PT[smc.bias];
  const activeObs = smc.orderBlocks.filter((o) => !o.mitigated).length;
  const activeFvgs = smc.fvgs.filter((f) => f.status === "active").length;
  const unswept = smc.liquidityZones.filter((z) => !z.swept).length;
  const empty = smc.orderBlocks.length === 0 && smc.fvgs.length === 0 && smc.liquidityZones.length === 0;
  return (
    <Panel className="adv-only">
      <PanelLabel>Smart Money Concepts · contexto institucional</PanelLabel>
      <div className="smc-head">
        <div className={`smc-bias ${bias.cls}`}>
          <div className="k">Viés institucional</div>
          <div className="b">{bias.label}</div>
        </div>
        <div className="smc-struct">
          <div className="k">Estrutura de mercado</div>
          <div className="v">{SMC_STRUCT_PT[smc.marketStructure] ?? smc.marketStructure}</div>
          <div className="counts">
            <span><b>{activeObs}</b> OB ativos</span>
            <span><b>{activeFvgs}</b> FVG ativos</span>
            <span><b>{unswept}</b> zonas intactas</span>
          </div>
        </div>
      </div>

      {empty ? (
        <p className="note">Nenhuma estrutura institucional relevante detectada na janela atual.</p>
      ) : (
        <div className="smc-groups">
          {smc.orderBlocks.length ? (
            <div className="smc-group">
              <div className="smc-gh">Order Blocks <span>{smc.orderBlocks.length}</span></div>
              {smc.orderBlocks.map((ob, i) => (
                <div className={`smc-row ${ob.type === "bullish" ? "bull" : "bear"}`} key={`ob-${ob.formedAt}-${i}`}>
                  <span className="dir">{ob.type === "bullish" ? "ALTA" : "BAIXA"}</span>
                  <span className="zone">{fmtPrice(ob.zoneBottom)}–{fmtPrice(ob.zoneTop)}</span>
                  <span className="str">impulso {ob.strength}</span>
                  <span className={`bdg ${ob.mitigated ? "off" : "on"}`}>{ob.mitigated ? "mitigado" : "ativo"}</span>
                </div>
              ))}
            </div>
          ) : null}

          {smc.fvgs.length ? (
            <div className="smc-group">
              <div className="smc-gh">Fair Value Gaps <span>{smc.fvgs.length}</span></div>
              {smc.fvgs.map((f, i) => (
                <div className={`smc-row ${f.type === "bullish" ? "bull" : "bear"}`} key={`fvg-${f.formedAt}-${i}`}>
                  <span className="dir">{f.type === "bullish" ? "ALTA" : "BAIXA"}</span>
                  <span className="zone">{fmtPrice(f.zoneBottom)}–{fmtPrice(f.zoneTop)}</span>
                  <span className="str">gap</span>
                  <span className={`bdg ${f.status === "active" ? "on" : "off"}`}>{f.status === "active" ? "ativo" : "preenchido"}</span>
                </div>
              ))}
            </div>
          ) : null}

          {smc.liquidityZones.length || smc.lastSwingLow || smc.lastSwingHigh ? (() => {
            const zones = smc.liquidityZones
              .filter((z) => Number.isFinite(z.level))
              .map((z) => ({ ...z, isAbove: z.level >= price, pct: ((z.level - price) / price) * 100 }));
            const above = zones.filter((z) => z.isAbove).sort((a, b) => a.level - b.level);
            const below = zones.filter((z) => !z.isAbove).sort((a, b) => b.level - a.level);
            const typePt = (t: string) => (t === "buy_stops_above" ? "buy-side" : "sell-side");
            const Row = (z: (typeof zones)[number], i: number) => (
              <div className="smc-row lq" key={`lz-${z.type}-${z.formedAt}-${i}`}>
                <span className={`dir ${z.isAbove ? "bear" : "bull"}`}>{z.isAbove ? "↑ acima" : "↓ abaixo"}</span>
                <span className="zone">{fmtPrice(z.level)}</span>
                <span className="str">{typePt(z.type)} · {z.pct >= 0 ? "+" : ""}{z.pct.toFixed(1)}%</span>
                <span className={`bdg ${z.swept ? "off" : "on"}`}>{z.swept ? "varrida" : "intacta"}</span>
              </div>
            );
            return (
              <div className="smc-group">
                <div className="smc-gh">Zonas de liquidez <span>{smc.liquidityZones.length}</span></div>
                <p className="note smc-hint">
                  Pools de ordens (stops) que funcionam como ímãs de preço. <b>Buy-side</b> = acima de topos; <b>sell-side</b> = abaixo de fundos.
                  Aqui <b>↑ acima / ↓ abaixo</b> e a % são em relação ao <b>preço atual ({fmtPrice(price)})</b>.
                </p>
                <div className="smc-sub">Acima do preço ({above.length})</div>
                {above.length ? above.map(Row) : <p className="note" style={{ padding: "2px 2px 8px" }}>Nenhuma zona acima{smc.lastSwingHigh ? ` — topo estrutural mais próximo: ${fmtPrice(smc.lastSwingHigh.price)}` : ""}.</p>}
                <div className="smc-sub">Abaixo do preço ({below.length})</div>
                {below.length ? below.map(Row) : <p className="note" style={{ padding: "2px 2px 8px" }}>Nenhuma zona de liquidez detectada abaixo{smc.lastSwingLow ? ` — suporte estrutural mais próximo (swing): ${fmtPrice(smc.lastSwingLow.price)}` : ""}.</p>}
              </div>
            );
          })() : null}
        </div>
      )}

      <p className="note">{smc.disclaimer}</p>
    </Panel>
  );
}

const HARM_DIR_PT: Record<"bullish" | "bearish", { label: string; cls: string }> = {
  bullish: { label: "ALTA", cls: "bull" },
  bearish: { label: "BAIXA", cls: "bear" },
};

function HarmonicsPanel({ harm }: { harm: NonNullable<FullAnalysis["harmonics"]> }) {
  return (
    <Panel className="adv-only">
      <PanelLabel>Padrões Harmônicos · Fibonacci XABCD</PanelLabel>
      {harm.patterns.length === 0 ? (
        <p className="note">{harm.summary}</p>
      ) : (
        <div className="harm-list">
          {harm.patterns.map((p, i) => {
            const d = HARM_DIR_PT[p.direction];
            return (
              <div className={`harm-row ${d.cls}`} key={`${p.name}-${p.C.index}-${i}`}>
                <div className="harm-top">
                  <span className="nm">{p.name}</span>
                  <span className="db">{d.label}</span>
                  <span className={`stt${p.status === "completed" ? " done" : ""}`}>
                    {p.status === "completed" ? "completo" : "em formação"}
                  </span>
                </div>
                <div className="harm-cmp">
                  <div className="harm-bar"><i style={{ width: `${p.completion}%` }} /></div>
                  <span className="pc">{p.completion}%</span>
                </div>
                <div className="harm-foot">
                  <span className="prz">PRZ <small>{fmtPrice(p.prz.low)}–{fmtPrice(p.prz.high)}</small></span>
                  <span className="ql">match <b>{p.quality}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="note">{harm.disclaimer}</p>
    </Panel>
  );
}

const WK_PT: Record<string, { label: string; tone: Tone }> = {
  accumulation: { label: "Acumulação", tone: "bull" },
  markup: { label: "Markup (alta)", tone: "bull" },
  distribution: { label: "Distribuição", tone: "bear" },
  markdown: { label: "Markdown (baixa)", tone: "bear" },
  transition: { label: "Transição", tone: "neu" },
};
const ELLIOTT_PT: Record<string, string> = {
  wave_1: "Onda 1", wave_2: "Onda 2", wave_3: "Onda 3", wave_4: "Onda 4", wave_5: "Onda 5",
  wave_a: "Onda A", wave_b: "Onda B", wave_c: "Onda C", indefinido: "Indefinido",
};
const DOW_PT: Record<string, { label: string; tone: Tone }> = {
  primary_uptrend: { label: "Alta primária", tone: "bull" },
  primary_downtrend: { label: "Baixa primária", tone: "bear" },
  sideways: { label: "Lateral", tone: "neu" },
};
const GANN_POS_PT: Record<string, { label: string; tone: Tone }> = {
  above: { label: "acima do 1×1", tone: "bull" },
  below: { label: "abaixo do 1×1", tone: "bear" },
  on: { label: "no 1×1", tone: "neu" },
};
function toneColor(t: Tone): string {
  return t === "bull" ? "var(--bull)" : t === "bear" ? "var(--bear)" : "var(--ink-soft)";
}

function WegdPanel({ wegd }: { wegd: NonNullable<FullAnalysis["wegd"]> }) {
  const wk = WK_PT[wegd.wyckoff.phase] ?? { label: wegd.wyckoff.phase, tone: "neu" as Tone };
  const dow = DOW_PT[wegd.dow.primaryTrend] ?? { label: wegd.dow.primaryTrend, tone: "neu" as Tone };
  const gann = GANN_POS_PT[wegd.gann.positionVs1x1] ?? { label: wegd.gann.positionVs1x1, tone: "neu" as Tone };
  const ell = wegd.elliott;
  return (
    <Panel className="adv-only">
      <PanelLabel>WEGD · Wyckoff · Elliott · Gann · Dow</PanelLabel>
      <div className="wegd-grid">
        <div className="wegd-cell">
          <div className="wk">Wyckoff</div>
          <div className="vv" style={{ color: toneColor(wk.tone) }}>{wk.label}</div>
          <div className="cf">confiança {wegd.wyckoff.confidence}%</div>
          <div className="ds">{wegd.wyckoff.description}</div>
        </div>
        <div className="wegd-cell">
          <div className="wk">Elliott</div>
          <div className="vv">{ELLIOTT_PT[ell.currentWave] ?? ell.currentWave}</div>
          <div className="cf">{ell.type === "impulsive" ? "impulsiva" : ell.type === "corrective" ? "corretiva" : "—"} · {ell.probability}%</div>
          <div className="ds">{ell.description}</div>
        </div>
        <div className="wegd-cell">
          <div className="wk">Gann</div>
          <div className="vv" style={{ color: toneColor(gann.tone) }}>1×1 {gann.label}</div>
          <div className="cf">{wegd.gann.angle1x1 > 0 ? `1×1 @ ${fmtPrice(wegd.gann.angle1x1)}` : "sem projeção"}</div>
          <div className="ds">{wegd.gann.description}</div>
        </div>
        <div className="wegd-cell">
          <div className="wk">Dow</div>
          <div className="vv" style={{ color: toneColor(dow.tone) }}>{dow.label}</div>
          <div className="cf">{wegd.dow.confirmed ? "confirmada ✓" : "não confirmada"}</div>
          <div className="ds">{wegd.dow.description}</div>
        </div>
      </div>
      <p className="note">{wegd.disclaimer}</p>
    </Panel>
  );
}

const MON_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const signedPct1 = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function SeasonalityPanel({ seas }: { seas: NonNullable<FullAnalysis["seasonality"]> }) {
  const maxAbs = Math.max(0.01, ...seas.monthly.filter((m) => m.sufficient).map((m) => Math.abs(m.avgReturn.value)));
  return (
    <Panel className="adv-only">
      <PanelLabel>Sazonalidade · {seas.yearsAnalyzed} anos · retorno médio mensal</PanelLabel>
      <div className="seas-grid">
        {seas.monthly.map((m) => {
          const v = m.avgReturn.value;
          const tone = !m.sufficient ? "insuf" : v > 0 ? "bull" : v < 0 ? "bear" : "neu";
          const alpha = m.sufficient ? 0.12 + 0.45 * Math.min(1, Math.abs(v) / maxAbs) : 0;
          const bg = tone === "bull" ? `rgba(43,212,158,${alpha})` : tone === "bear" ? `rgba(255,107,138,${alpha})` : "transparent";
          return (
            <div className={`seas-cell ${tone}${m.month === seas.currentMonth ? " cur" : ""}`} style={{ background: bg }} key={m.month}>
              <div className="mn">{MON_ABBR[m.month - 1]}</div>
              <div className="rv">{m.sufficient ? signedPct1(v) : "—"}</div>
              <div className="sn">n={m.sampleSize}</div>
            </div>
          );
        })}
      </div>
      <p className="note">{seas.summary}</p>
      <p className="note" style={{ marginTop: 6 }}>
        Células cinza tracejadas = <b>amostra insuficiente</b> (n &lt; {seas.minSampleSize} anos): sem veredito, em vez de cravar um
        número. Cada mês carrega IC 95% e <b>n</b> — o oposto do "mês cravado" sem incerteza.
      </p>
    </Panel>
  );
}

const WD_ABBR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Heatmap de horários ideais (D2) — hora × dia (UTC). Cinza = amostra fraca (honesto). */
function SessionHeatmapPanel({ sessions }: { sessions: NonNullable<FullAnalysis["sessions"]> }) {
  const cells = new Map(sessions.cells.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const maxAbs = Math.max(0.01, ...sessions.cells.filter((c) => c.sufficient).map((c) => Math.abs(c.avgReturn)));
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <Panel className="adv-only">
      <PanelLabel>Horários ideais · hora × dia (UTC) · {sessions.totalCandles.toLocaleString("pt-BR")} candles 1h</PanelLabel>
      <div className="heat">
        <div className="heat-row heat-head">
          <span className="hd" />
          {hours.map((h) => <span className="hh" key={h}>{h % 6 === 0 ? `${h}h` : ""}</span>)}
        </div>
        {WD_ABBR.map((d, wd) => (
          <div className="heat-row" key={wd}>
            <span className="hd">{d}</span>
            {hours.map((h) => {
              const c = cells.get(`${wd}-${h}`);
              const v = c?.avgReturn ?? 0;
              const ok = c?.sufficient;
              const alpha = ok ? 0.14 + 0.5 * Math.min(1, Math.abs(v) / maxAbs) : 0;
              const bg = !ok ? "transparent" : v > 0 ? `rgba(43,212,158,${alpha})` : v < 0 ? `rgba(255,107,138,${alpha})` : "transparent";
              const isBest = sessions.best && c && c.weekday === sessions.best.weekday && c.hour === sessions.best.hour;
              return (
                <span
                  key={h}
                  className={`hc${ok ? "" : " insuf"}${isBest ? " best" : ""}`}
                  style={{ background: bg }}
                  title={c ? `${d} ${String(h).padStart(2, "0")}h UTC · ${ok ? `${v > 0 ? "+" : ""}${v}% médio · ${(c.winRate * 100).toFixed(0)}% verde` : "amostra fraca"} · n=${c.sampleSize}` : "sem dado"}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="note">{sessions.summary}</p>
      <p className="note" style={{ marginTop: 6 }}>
        Células vazias/tracejadas = <b>amostra insuficiente</b> (n &lt; {sessions.minSampleSize}) — sem veredito, em vez de cravar
        um "melhor horário". Horário em UTC. Observado, não promessa.
      </p>
    </Panel>
  );
}

const ALIGN_PT: Record<string, { label: string; cls: string }> = {
  fully_aligned: { label: "Alinhamento total", cls: "full" },
  partially_aligned: { label: "Alinhamento parcial", cls: "partial" },
  divergent: { label: "Divergência", cls: "diverg" },
  neutral: { label: "Sem direção clara", cls: "neu" },
};
const MTF_SIDE_PT: Record<string, { label: string; cls: string }> = {
  buy: { label: "COMPRA", cls: "bull" },
  sell: { label: "VENDA", cls: "bear" },
  neutral: { label: "NEUTRO", cls: "neu" },
};

function MultiTimeframePanel({ mtf }: { mtf: NonNullable<FullAnalysis["multiTimeframe"]> }) {
  const al = ALIGN_PT[mtf.alignment] ?? { label: mtf.alignment, cls: "neu" };
  return (
    <Panel className="adv-only">
      <PanelLabel>Confluência Multi-Timeframe</PanelLabel>
      <div className="mtf-head">
        <div className={`mtf-score ${al.cls}`}>
          <div className="sc">{mtf.confluenceScore}<small>/100</small></div>
          <div className="al">{al.label}</div>
        </div>
        <div className="mtf-tfs">
          {[mtf.current, mtf.higher, mtf.highest].map((t) => {
            if (!t) return null;
            const s = MTF_SIDE_PT[t.side] ?? { label: t.side, cls: "neu" };
            return (
              <div className="mtf-tf" key={t.timeframe}>
                <span className="t">{t.timeframe.toUpperCase()}</span>
                <span className={`bd ${s.cls}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="note">{mtf.summary}</p>
    </Panel>
  );
}

// ======================= página =======================
export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const explicit = typeof sp.symbol === "string"; // veio do form/link com um ativo
  const fromId = typeof sp.id === "string";
  let savedId = typeof sp.id === "string" ? sp.id : null;
  let symbol = (explicit ? (sp.symbol as string) : "BTCUSDT").toUpperCase();
  let timeframe = resolveTf(sp.tf);
  let assetType = resolveAssetType(sp.type, symbol);

  const user = await getCurrentUser();

  // Regras de crédito:
  //  - LANDING (sem ?symbol e sem ?id) → mostra a ÚLTIMA análise SALVA (grátis);
  //    NÃO gera nem cobra. Abrir a aba Análise nunca consome crédito.
  //  - ?id=<id> → snapshot salvo do histórico (grátis).
  //  - ?symbol=... (form/link "Analisar") → gera análise NOVA: 1 crédito
  //    (re-gerar a mesma em ≤10min é grátis).
  let dto: FullAnalysis | null = null;
  let error: string | null = null;
  let blocked = false;
  let landingEmpty = false;
  let displayCredits = user?.credits;

  if (!user) {
    blocked = true;
  } else {
    if (!savedId && !explicit) {
      const recents = await recentAnalyses(1);
      savedId = recents[0]?.id ?? null;
      if (!savedId) landingEmpty = true; // sem histórico → prompt, sem cobrar
    }
    if (!landingEmpty && savedId) {
      const saved = await getAnalysisById(savedId);
      if (saved) {
        dto = saved.dto;
        symbol = saved.symbol;
        timeframe = saved.timeframe as Timeframe;
        assetType = saved.assetType as AssetType;
      } else if (explicit) {
        error = "Análise não encontrada no seu histórico.";
      } else {
        landingEmpty = true;
      }
    } else if (!landingEmpty) {
      // explícito (escolheu um ativo e clicou Analisar) → gera + cobra
      const gate = await checkAnalysisCredit(user.id, symbol, timeframe);
      if (!gate.allowed) {
        blocked = true; // créditos esgotados
        displayCredits = gate.balance;
      } else {
        try {
          dto = await analyzeSymbol(symbol, assetType, timeframe, "complete");
        } catch (e) {
          error = e instanceof Error ? e.message : "Falha desconhecida.";
        }
        if (dto) {
          if (gate.needsCharge) {
            const remaining = await chargeAnalysis(user.id, symbol, timeframe);
            if (remaining != null) displayCredits = remaining;
          }
          await recordAnalysisView(dto); // salva no histórico (best-effort, deduplicado)
        }
      }
    }
  }

  // Landing mostrando a última análise salva → exibe minimizada (com data/hora).
  const isLastSaved = !explicit && !fromId && !!dto && !blocked && !landingEmpty;

  return (
    <>
      <AppBar
        active="analise"
        credits={displayCredits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />
      <AnalysisShell
        symbol={symbol}
        timeframe={timeframe}
        assetType={assetType}
        regime={dto?.analysis.meta.regime}
        adx={dto?.analysis.meta.adxValue}
      >
        {landingEmpty ? (
          <Panel>
            <PanelLabel>Escolha um ativo para analisar</PanelLabel>
            <p className="note" style={{ maxWidth: "70ch" }}>
              Selecione o ativo e o timeframe no seletor acima e clique em <b>Analisar</b>. Cada análise nova consome
              <b> 1 crédito</b> — e fica salva no seu histórico para reabrir quando quiser, de graça. Abrir esta aba não consome nada.
            </p>
          </Panel>
        ) : blocked ? (
          <Panel>
            <PanelLabel>Créditos esgotados</PanelLabel>
            <p className="note" style={{ marginBottom: 14 }}>
              Você usou todos os seus créditos de análise{user ? ` (saldo: ${displayCredits ?? 0})` : ""}. Cada análise completa
              consome 1 crédito. Assine um plano para continuar analisando com prova (n · IC · selo).
            </p>
            <a href="/planos" className="btn primary" style={{ display: "inline-block" }}>Ver planos →</a>
          </Panel>
        ) : error ? (
          <Panel>
            <PanelLabel>Sem análise</PanelLabel>
            <p className="note">
              Não foi possível analisar <b>{symbol}</b> ({timeframe.toUpperCase()}): {error} Confira o símbolo e a classe de
              ativo no seletor acima.
            </p>
          </Panel>
        ) : !dto ? null : (
          <LastAnalysisBanner enabled={isLastSaved} generatedAt={dto.generatedAt}>
          <>
            <ReportActions dto={dto} symbol={symbol} assetType={assetType} timeframe={timeframe} />
            <Verdict dto={dto} />
            <TradeGuardPanel dto={dto} />
            <Panel>
              <PanelLabel>Gráfico · {symbol} · {timeframe.toUpperCase()} · níveis + zonas</PanelLabel>
              <PriceChart symbol={symbol} assetType={assetType} timeframe={timeframe} lines={buildPriceLines(dto)} />
            </Panel>
            <Panel>
              <PanelLabel>Leitura do analista · IA</PanelLabel>
              <AiNarrative symbol={symbol} assetType={assetType} timeframe={timeframe} />
            </Panel>
            <LevelsAndSeal dto={dto} />
            {dto.backtest && dto.equityCurve && dto.quality ? (
              <Panel className="adv-only">
                <PanelLabel>Backtest sob demanda · escolha estratégia / período / R:R</PanelLabel>
                <BacktestLab
                  symbol={symbol}
                  assetType={assetType}
                  timeframe={timeframe}
                  initial={{ backtest: dto.backtest, quality: dto.quality, equityCurve: dto.equityCurve }}
                />
              </Panel>
            ) : null}
            <MomentumPanel analysis={dto.analysis} />
            {dto.multiTimeframe ? <MultiTimeframePanel mtf={dto.multiTimeframe} /> : null}
            {dto.montecarlo ? <MonteCarloPanel mc={dto.montecarlo} /> : null}
            {dto.scenarios ? <ScenariosPanel sc={dto.scenarios} /> : null}
            {dto.smc ? <SmcPanel smc={dto.smc} price={dto.montecarlo?.currentPrice ?? dto.analysis.risk.entry} /> : null}
            {dto.harmonics ? <HarmonicsPanel harm={dto.harmonics} /> : null}
            {dto.wegd ? <WegdPanel wegd={dto.wegd} /> : null}
            {dto.seasonality ? <SeasonalityPanel seas={dto.seasonality} /> : null}
            {dto.sessions && dto.sessions.cells.length > 0 ? <SessionHeatmapPanel sessions={dto.sessions} /> : null}
            <Panel className="adv-only">
              <PanelLabel>Contexto macro · notícias</PanelLabel>
              <NewsCard symbol={symbol} assetType={assetType} timeframe={timeframe} />
            </Panel>
            {assetType === "crypto" ? (
              <Panel className="adv-only">
                <PanelLabel>Fundamento on-chain · TVL (DefiLlama)</PanelLabel>
                <FundamentalCard
                  symbol={symbol}
                  assetType={assetType}
                  timeframe={timeframe}
                  bias={signalSide(dto.analysis.signal.signal)}
                />
              </Panel>
            ) : null}
            <div style={{ height: 60 }} />
          </>
          </LastAnalysisBanner>
        )}
      </AnalysisShell>
    </>
  );
}
