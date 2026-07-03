import { AppBar, Panel, PanelLabel } from "@/components/ui";
import { PositionForm } from "@/components/position-form";
import { analyzeSymbol } from "@/lib/analysis/service";
import { findAsset } from "@/lib/market/catalog";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { checkAnalysisCredit, chargeAnalysis } from "@/lib/credits";
import { recordAnalysisView } from "@/lib/history";
import { computeClassReading, classReadingToSignal } from "@/lib/analysis/engines";
import { loadServerExtras } from "@/lib/analysis/class-extras";
import {
  generateLlmDecision, generateLlmDecisionDS, generateLlmDecisionSurv, generateLlmDecisionDsSurv,
  generateLlmDecisionVsf, generateLlmDecisionDsVsf, generateLlmDecisionVsfSurv, generateLlmDecisionDsVsfSurv,
} from "@/lib/analysis/narrative";
import { fetchBank } from "@/lib/signals/emit";
import {
  buildOpinion, llmOpinion, tallyVerdicts, computePositionRisk,
  conditionalDirection, consensusDirection, invertDirection, isPositionSide,
  type PositionSide, type EngineOpinion, type PositionRisk, type StressTally, type PositionVerdict,
} from "@/lib/analysis/position-stress";
import type { AssetType, Timeframe, SignalDirection } from "@tradeai/shared";
import type { FullAnalysis } from "@/lib/analysis/full";

export const dynamic = "force-dynamic";

/** TF do stress test — swing (mesmo default do /analise). A regra de crédito é a
 *  mesma da análise: 1 crédito por (ativo, TF), re-rodar em ≤10 min é grátis. */
const TF: Timeframe = "4h";

const fmtPrice = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 });
const signed = (x: number, d = 2) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: d })}`;

const SIGNAL_PT: Record<SignalDirection, string> = {
  STRONG_BUY: "COMPRA FORTE",
  BUY: "COMPRA",
  WEAK_BUY: "COMPRA FRACA",
  NEUTRAL: "NEUTRO",
  WEAK_SELL: "VENDA FRACA",
  SELL: "VENDA",
  STRONG_SELL: "VENDA FORTE",
};

const VERDICT_PT: Record<PositionVerdict, string> = {
  aumentaria: "AUMENTARIA",
  seguraria: "SEGURARIA",
  sairia: "SAIRIA",
};
const VERDICT_CLS: Record<PositionVerdict, string> = { aumentaria: "up", seguraria: "hold", sairia: "out" };

// selo de qualidade (única cor âmbar permitida na página)
type SealStatus = "green" | "yellow" | "red" | "grey";
const SEAL: Record<SealStatus, { label: string; color: string }> = {
  green: { label: "SELO VERDE · validado", color: "var(--bull)" },
  yellow: { label: "SELO AMARELO · ressalva", color: "var(--amber)" },
  red: { label: "SELO VERMELHO · reprovado", color: "var(--bear)" },
  grey: { label: "SEM SELO · amostra insuficiente", color: "var(--ink-faint)" },
};
function sealOf(status?: string) {
  const k: SealStatus = status === "green" || status === "yellow" || status === "red" ? status : "grey";
  return SEAL[k];
}

const ASSET_TYPES: readonly AssetType[] = ["crypto", "forex", "commodities", "indices", "stocks"];
function resolveAssetType(raw: unknown, symbol: string): AssetType {
  return findAsset(symbol)?.assetType ?? (typeof raw === "string" && (ASSET_TYPES as readonly string[]).includes(raw) ? (raw as AssetType) : "crypto");
}

function dirTone(d: SignalDirection | null): string {
  if (!d) return "var(--ink-faint)";
  const s = d.includes("BUY") ? "buy" : d.includes("SELL") ? "sell" : "neutral";
  return s === "buy" ? "var(--bull)" : s === "sell" ? "var(--bear)" : "var(--ink-soft)";
}

// ======================= blocos =======================

function XRayPanel({ dto, pos, entry, risk }: { dto: FullAnalysis; pos: PositionSide; entry: number; risk: PositionRisk }) {
  const seal = sealOf(dto.quality?.status);
  const rTone = risk.unrealizedR == null ? "var(--ink-soft)" : risk.unrealizedR >= 0 ? "var(--bull)" : "var(--bear)";
  const farFromPrice = Math.abs(entry - risk.current) / risk.current > 0.5;
  return (
    <Panel>
      <PanelLabel>Sua posição · raio-x contra o mercado agora</PanelLabel>
      <div className="pos-xray">
        <div className="s">
          <div className="k">Posição</div>
          <div className="v">
            <span className={`pos-side-tag ${pos === "long" ? "buy" : "sell"}`}>{pos === "long" ? "▲ COMPRADO" : "▼ VENDIDO"}</span>
          </div>
        </div>
        <div className="s"><div className="k">Entrada informada</div><div className="v">{fmtPrice(entry)}</div></div>
        <div className="s"><div className="k">Preço atual</div><div className="v" style={{ color: "var(--cyan)" }}>{fmtPrice(risk.current)}</div></div>
        <div className="s"><div className="k">Resultado aberto</div><div className="v" style={{ color: rTone }}>{signed(risk.unrealizedPct, 1)}%</div></div>
        <div className="s pos-r">
          <div className="k">R não-realizado</div>
          <div className="v big" style={{ color: rTone }}>{risk.unrealizedR != null ? `${signed(risk.unrealizedR, 2)} R` : "—"}</div>
          <div className="hint">em múltiplos do stop da casa (ATR)</div>
        </div>
        <div className="s pos-stop">
          <div className="k">Onde a tese morre</div>
          <div className="v" style={{ color: "var(--bear)" }}>{risk.houseStop != null ? fmtPrice(risk.houseStop) : "—"}</div>
          <div className="hint">
            {risk.houseStop != null && risk.stopDistPct != null
              ? `stop da casa · ${pos === "long" ? "abaixo" : "acima"} do preço atual (${risk.stopDistPct.toFixed(1)}%)`
              : "sem ATR suficiente pra projetar o stop"}
          </div>
        </div>
      </div>
      <div className="pos-seal">
        <span className="led" style={{ background: seal.color, boxShadow: `0 0 10px ${seal.color}` }} />
        <span style={{ color: seal.color }}>{seal.label}</span>
        <small>qualidade do sinal da casa neste ativo/TF (backtest n · IC)</small>
      </div>
      {farFromPrice ? (
        <p className="note">⚠ A entrada informada está a mais de 50% do preço atual — confira se digitou o preço certo.</p>
      ) : null}
    </Panel>
  );
}

function BoardPanel({ tally }: { tally: StressTally }) {
  const max = Math.max(tally.aumentaria, tally.seguraria, tally.sairia);
  const winners = ([
    ["aumentaria", tally.aumentaria],
    ["seguraria", tally.seguraria],
    ["sairia", tally.sairia],
  ] as const).filter(([, n]) => n === max && max > 0);
  const solo = winners.length === 1 ? winners[0] : undefined;
  const headline = solo ? `MAIORIA ${VERDICT_PT[solo[0]]}` : "MESA DIVIDIDA";
  return (
    <Panel>
      <PanelLabel>Placar da mesa · {tally.read} motores leram sua posição{tally.unavailable > 0 ? ` · ${tally.unavailable} indisponíveis` : ""}</PanelLabel>
      <div className="pos-headline">{headline}</div>
      <div className="pos-board">
        <div className="cell up"><div className="n">{tally.aumentaria}</div><div className="l">aumentariam</div></div>
        <div className="cell hold"><div className="n">{tally.seguraria}</div><div className="l">segurariam</div></div>
        <div className="cell out"><div className="n">{tally.sairia}</div><div className="l">sairiam</div></div>
      </div>
      <p className="note">
        Tradução da leitura de cada motor pra sua posição: lado <b>oposto</b> → sairia · <b>neutro</b> ou mesmo lado sem força →
        seguraria · mesmo lado <b>forte</b> (sinal forte / convicção ≥80) → aumentaria. Conteúdo educativo — não é recomendação.
      </p>
    </Panel>
  );
}

function EnginesPanel({ opinions }: { opinions: EngineOpinion[] }) {
  return (
    <Panel>
      <PanelLabel>Mesa de motores · como cada um votou</PanelLabel>
      <div className="pos-engines">
        {opinions.map((o) => (
          <div className="pos-row" key={o.id}>
            <span className="nm">
              {o.label}
              <small>{o.kind === "llm" ? "IA · LLM" : "determinístico"}</small>
            </span>
            <span className="dir" style={{ color: dirTone(o.direction) }}>{o.direction ? SIGNAL_PT[o.direction] : "SEM LEITURA"}</span>
            <span className="rat">
              {o.rationale ?? (o.direction == null ? (o.kind === "llm" ? "IA indisponível nesta rodada" : "dados insuficientes no dto") : "")}
              {o.conviction != null ? <b> · convicção {o.conviction}</b> : null}
            </span>
            {o.verdict ? (
              <span className={`pv ${VERDICT_CLS[o.verdict]}`}>{VERDICT_PT[o.verdict]}</span>
            ) : (
              <span className="pv na">—</span>
            )}
          </div>
        ))}
      </div>
      <p className="note">
        Motores determinísticos derivam da mesma análise (indicadores, SMC, regime, classe); os LLM decidem a partir dos dados
        brutos, sem ver o veredito da casa. O desempenho de cada motor é auditável no <a href="/track-record">track record</a>.
      </p>
    </Panel>
  );
}

// ======================= página =======================
export default async function PosicaoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const symbol = typeof sp.symbol === "string" && sp.symbol.trim() ? sp.symbol.trim().toUpperCase() : null;
  const posSide: PositionSide | null = sp.side === "comprado" ? "long" : sp.side === "vendido" ? "short" : isPositionSide(sp.side) ? sp.side : null;
  const entry = typeof sp.entry === "string" ? Number(sp.entry.replace(",", ".")) : NaN;
  const hasQuery = !!symbol && !!posSide && Number.isFinite(entry) && entry > 0;
  const assetType: AssetType = symbol ? resolveAssetType(sp.type, symbol) : "crypto";

  const user = await getCurrentUser();

  let dto: FullAnalysis | null = null;
  let error: string | null = null;
  let blocked = false;
  let displayCredits = user?.credits;
  let opinions: EngineOpinion[] = [];
  let risk: PositionRisk | null = null;

  if (hasQuery && symbol && posSide) {
    if (!user) {
      blocked = true;
    } else {
      // Mesma regra do /analise: gate de crédito + dedup de 10 min por (ativo, TF).
      const gate = await checkAnalysisCredit(user.id, symbol, TF);
      if (!gate.allowed) {
        blocked = true;
        displayCredits = gate.balance;
      } else {
        try {
          dto = await analyzeSymbol(symbol, assetType, TF, "complete");
        } catch (e) {
          error = e instanceof Error ? e.message : "Falha desconhecida.";
        }
        if (dto) {
          if (gate.needsCharge) {
            const remaining = await chargeAnalysis(user.id, symbol, TF);
            if (remaining != null) displayCredits = remaining;
          }
          await recordAnalysisView(dto); // histórico + habilita o dedup (best-effort)

          const extras = await loadServerExtras(symbol, assetType);
          const reading = computeClassReading(dto, assetType, extras);

          // 8 motores LLM em paralelo (25s de timeout cada; falha → "indisponível").
          // Os de sobrevivência recebem a banca REAL do próprio motor (feedback).
          const d = dto;
          const [gpt, ds, surv, dsSurv, vsf, dsVsf, vsfSurv, dsVsfSurv] = await Promise.all([
            generateLlmDecision(d, assetType, extras),
            generateLlmDecisionDS(d, assetType, extras),
            fetchBank("llm_surv").then((b) => generateLlmDecisionSurv(d, assetType, extras, b)),
            fetchBank("llm_ds_surv").then((b) => generateLlmDecisionDsSurv(d, assetType, extras, b)),
            generateLlmDecisionVsf(d, assetType, extras),
            generateLlmDecisionDsVsf(d, assetType, extras),
            fetchBank("llm_vsf_surv").then((b) => generateLlmDecisionVsfSurv(d, assetType, extras, b)),
            fetchBank("llm_ds_vsf_surv").then((b) => generateLlmDecisionDsVsfSurv(d, assetType, extras, b)),
          ]);

          opinions = [
            buildOpinion("padrao", "Padrão (15 camadas)", "deterministico", dto.analysis.signal.signal, posSide),
            buildOpinion("classe", "Por classe", "deterministico", classReadingToSignal(reading), posSide),
            buildOpinion("condicional", "Condicional", "deterministico", conditionalDirection(dto), posSide),
            buildOpinion("contrario", "Contrário", "deterministico", invertDirection(dto.analysis.signal.signal), posSide),
            buildOpinion("consenso", "Consenso", "deterministico", consensusDirection(dto, reading), posSide),
            llmOpinion("llm", "LLM·GPT", gpt, posSide),
            llmOpinion("llm_ds", "LLM·DS", ds, posSide),
            llmOpinion("llm_surv", "Sobrev·GPT", surv, posSide),
            llmOpinion("llm_ds_surv", "Sobrev·DS", dsSurv, posSide),
            llmOpinion("llm_vsf", "VSF·GPT", vsf, posSide),
            llmOpinion("llm_ds_vsf", "VSF·DS", dsVsf, posSide),
            llmOpinion("llm_vsf_surv", "VSF+S·GPT", vsfSurv, posSide),
            llmOpinion("llm_ds_vsf_surv", "VSF+S·DS", dsVsfSurv, posSide),
          ];
          risk = computePositionRisk(dto, posSide, entry);
        }
      }
    }
  }

  const tally = tallyVerdicts(opinions);

  return (
    <>
      <AppBar
        active="posicao"
        credits={displayCredits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />
      <div className="analysis-page pos-page">
        <div className="wrap">
          <PositionForm credits={displayCredits ?? 0} />

          {blocked ? (
            <Panel>
              <PanelLabel>{user ? "Créditos esgotados" : "Entre para continuar"}</PanelLabel>
              <p className="note" style={{ marginBottom: 14 }}>
                {user
                  ? `Você usou todos os seus créditos (saldo: ${displayCredits ?? 0}). Cada stress test consome 1 crédito. Assine um plano para continuar.`
                  : "O stress test roda uma análise completa da sua posição — entre na sua conta para usar."}
              </p>
              <a href={user ? "/planos" : "/login?next=%2Fposicao"} className="btn primary" style={{ display: "inline-block" }}>
                {user ? "Ver planos →" : "Entrar →"}
              </a>
            </Panel>
          ) : error ? (
            <Panel>
              <PanelLabel>Sem análise</PanelLabel>
              <p className="note">
                Não foi possível analisar <b>{symbol}</b> ({TF.toUpperCase()}): {error} Confira o símbolo e a classe do ativo.
              </p>
            </Panel>
          ) : !dto || !posSide ? (
            <Panel>
              <PanelLabel>Como funciona</PanelLabel>
              <p className="note">
                Você informa uma posição <b>já aberta</b> (ativo, lado e preço de entrada). A casa roda a análise completa
                ({TF.toUpperCase()}) e cada motor — 5 determinísticos + 8 de IA — responde o que faria com a <b>sua</b> posição:
                aumentaria, seguraria ou sairia. Você vê também o <b>R não-realizado</b> e o nível onde a tese morre
                (stop da casa por ATR). Custa 1 crédito, como qualquer análise.
              </p>
            </Panel>
          ) : (
            <>
              {risk ? <XRayPanel dto={dto} pos={posSide} entry={entry} risk={risk} /> : null}
              <BoardPanel tally={tally} />
              <EnginesPanel opinions={opinions} />
            </>
          )}
          <div style={{ height: 60 }} />
        </div>
      </div>
    </>
  );
}
