import { Panel, PanelLabel, RadialGauge } from "@/components/ui";
import { computeClassReading, type ClassExtras } from "@/lib/analysis/engines";
import { getMacroContext } from "@/lib/market/macro-yahoo";
import { fetchFmpFundamental } from "@/lib/market/fmp";
import { getCotPositioning } from "@/lib/market/cot-cftc";
import { DerivativesLive } from "@/components/derivatives-live";
import type { FullAnalysis } from "@/lib/analysis/full";
import type { AssetType } from "@tradeai/shared";

const SIDE_PT = {
  buy: { label: "COMPRA", cls: "bull", color: "var(--bull)" },
  sell: { label: "VENDA", cls: "bear", color: "var(--bear)" },
  neutral: { label: "NEUTRO", cls: "neu", color: "var(--ink-soft)" },
} as const;

/**
 * MOTOR 2 — leitura "por classe de ativo". Re-pondera os MESMOS dados reais do
 * Motor 1 conforme a metodologia da família (o que manda / apoia / cruzamentos /
 * cuidados) e expõe, com honestidade, os dados que a classe pede e ainda não
 * integramos (`pending`). Não substitui o Motor 1 — é uma segunda lente.
 */
export async function ClassReadingPanel({ dto, assetType }: { dto: FullAnalysis; assetType: AssetType }) {
  // Derivativos da Binance são buscados NO NAVEGADOR (DerivativesLive) — a Vercel
  // é bloqueada por IP de cloud. Macro (Yahoo) funciona server-side.
  const extras: ClassExtras = {};
  const asset = dto.analysis.meta.asset;
  const [macro, cot, fundamental] = await Promise.all([
    assetType === "forex" || assetType === "commodities" || assetType === "indices"
      ? getMacroContext({ dxy: assetType !== "indices", vix: assetType === "indices" })
      : Promise.resolve(null),
    assetType === "forex" || assetType === "commodities" ? getCotPositioning(asset) : Promise.resolve(null),
    assetType === "stocks" && process.env.FMP_API_KEY ? fetchFmpFundamental(asset, process.env.FMP_API_KEY) : Promise.resolve(null),
  ]);
  extras.macro = macro;
  extras.cot = cot;
  extras.fundamental = fundamental;
  const r = computeClassReading(dto, assetType, extras);
  const m = r.methodology;
  const side = SIDE_PT[r.side];
  const mc = extras.macro;
  const fnd = extras.fundamental;
  const ct = extras.cot;

  return (
    <Panel style={{ ["--gc" as string]: side.color }}>
      <span className="cn tl" /><span className="cn tr" /><span className="cn bl" /><span className="cn br" />
      <PanelLabel>Motor 2 · leitura por classe · {m.label}</PanelLabel>

      <div className="hero2">
        <div className="verdict">
          <div className="kick">Leitura ponderada para {m.label}</div>
          <div className="big" style={{ color: side.color }}>{side.label}</div>
          <div className="sub">{r.label}</div>
          <div className="telem">
            <div><div className="k">A favor</div><div className="v"><span className="b">{r.agree.length}</span></div></div>
            <div><div className="k">Contra</div><div className="v"><span className="s">{r.against.length}</span></div></div>
            <div><div className="k">Fatores</div><div className="v">{r.factors.length}</div></div>
          </div>
        </div>
        <RadialGauge value={r.score} caption="Convicção da classe" />
      </div>

      <div className="cls-method">
        <div className="cm-cell"><div className="k">Manda</div><div className="v">{m.manda}</div></div>
        <div className="cm-cell"><div className="k">Apoio</div><div className="v">{m.apoio}</div></div>
        <div className="cm-cell"><div className="k">Cruzamentos-chave</div><div className="v">{m.cruzamentos}</div></div>
        <div className="cm-cell warn"><div className="k">Cuidados</div><div className="v">{m.cuidados}</div></div>
      </div>

      {assetType === "crypto" && <DerivativesLive symbol={dto.analysis.meta.asset} />}

      {fnd && (
        <div className="cls-deriv">
          <div className="cd-h">Fundamentos · FMP <span>dados reais</span></div>
          <div className="cd-grid">
            {fnd.revenueGrowthYoY != null && (
              <div className="cd-cell">
                <div className="k">Receita YoY</div>
                <div className={`v ${fnd.revenueGrowthYoY >= 0 ? "bull" : "bear"}`}>{fnd.revenueGrowthYoY >= 0 ? "+" : ""}{(fnd.revenueGrowthYoY * 100).toFixed(1)}%</div>
                <div className="s">crescimento anual</div>
              </div>
            )}
            {fnd.netMarginTTM != null && (
              <div className="cd-cell">
                <div className="k">Margem líquida</div>
                <div className={`v ${fnd.netMarginTTM >= 0 ? "bull" : "bear"}`}>{(fnd.netMarginTTM * 100).toFixed(1)}%</div>
                <div className="s">TTM</div>
              </div>
            )}
            {fnd.peRatioTTM != null && (
              <div className="cd-cell">
                <div className="k">P/L</div>
                <div className="v">{fnd.peRatioTTM.toFixed(1)}</div>
                <div className="s">{fnd.roeTTM != null ? `ROE ${(fnd.roeTTM * 100).toFixed(0)}%` : "TTM"}</div>
              </div>
            )}
          </div>
          <p className="note" style={{ margin: "6px 0 0" }}>
            {fnd.companyName}{fnd.sector ? ` · ${fnd.sector}` : ""}. Fundamentos pesam pouco no curtíssimo prazo, mas dão viés;
            <b> evite TA pura perto de earnings</b>.
          </p>
        </div>
      )}

      {ct && (
        <div className="cls-deriv">
          <div className="cd-h">COT · CFTC <span>dados reais · semanal</span></div>
          <div className="cd-grid">
            <div className="cd-cell">
              <div className="k">Specs líquido</div>
              <div className={`v ${ct.netPctOfOi >= 0 ? "bull" : "bear"}`}>{ct.netPctOfOi >= 0 ? "+" : ""}{(ct.netPctOfOi * 100).toFixed(1)}%</div>
              <div className="s">do open interest</div>
            </div>
            <div className="cd-cell">
              <div className="k">Variação semanal</div>
              <div className={`v ${ct.weekChangePctOfOi >= 0 ? "bull" : "bear"}`}>{ct.weekChangePctOfOi >= 0 ? "+" : ""}{(ct.weekChangePctOfOi * 100).toFixed(1)}%</div>
              <div className="s">{ct.weekChangePctOfOi >= 0 ? "aumentando compra" : "reduzindo compra"}</div>
            </div>
            <div className="cd-cell">
              <div className="k">Faixa 6 meses</div>
              <div className="v">{(ct.rangePos * 100).toFixed(0)}%</div>
              <div className="s">{ct.extreme ? "posição esticada" : "dentro da faixa"}</div>
            </div>
          </div>
          <p className="note" style={{ margin: "6px 0 0" }}>
            Posição dos grandes especuladores no contrato <b>{ct.contract}</b> ({new Date(ct.reportDate).toLocaleDateString("pt-BR")}).
            Net comprado = viés de alta; <b>esticado</b> perto da máx/mín de 6 meses sinaliza risco de reversão.
          </p>
        </div>
      )}

      {mc && (mc.dxy || mc.vix) && (
        <div className="cls-deriv">
          <div className="cd-h">Macro · Yahoo Finance <span>dados reais</span></div>
          <div className="cd-grid">
            {mc.dxy && (
              <div className="cd-cell">
                <div className="k">DXY · dólar</div>
                <div className={`v ${mc.dxy.changePct >= 0 ? "bear" : "bull"}`}>{mc.dxy.value.toFixed(2)}</div>
                <div className="s">{mc.dxy.changePct >= 0 ? "+" : ""}{mc.dxy.changePct.toFixed(2)}% · dólar {mc.dxy.changePct >= 0 ? "forte" : "fraco"}</div>
              </div>
            )}
            {mc.vix && (
              <div className="cd-cell">
                <div className="k">VIX · medo</div>
                <div className={`v ${mc.vix.changePct >= 0 ? "bear" : "bull"}`}>{mc.vix.value.toFixed(2)}</div>
                <div className="s">{mc.vix.changePct >= 0 ? "+" : ""}{mc.vix.changePct.toFixed(1)}% · {mc.vix.value >= 20 ? "estresse elevado" : "calmo"}</div>
              </div>
            )}
          </div>
          <p className="note" style={{ margin: "6px 0 0" }}>
            {assetType === "indices"
              ? "VIX subindo = aversão a risco (vento contra índices); caindo = apetite a risco."
              : "Dólar forte costuma ser vento contra ativos cotados em USD; a direção é aplicada conforme o par."}
          </p>
        </div>
      )}

      {(r.agree.length > 0 || r.against.length > 0) && (
        <div className="cls-factors">
          {r.agree.length > 0 && (
            <div className="cf-col bull">
              <div className="cf-h">A favor de {side.label.toLowerCase()}</div>
              {r.agree.map((f, i) => <span className="cf-i" key={`a${i}`}>{f}</span>)}
            </div>
          )}
          {r.against.length > 0 && (
            <div className="cf-col bear">
              <div className="cf-h">Contra</div>
              {r.against.map((f, i) => <span className="cf-i" key={`c${i}`}>{f}</span>)}
            </div>
          )}
        </div>
      )}

      {r.stillPending.length > 0 && (
        <div className="cls-pending">
          <div className="cp-h">Dados desta classe ainda não integrados <span>honestidade</span></div>
          <ul>
            {r.stillPending.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className="note" style={{ margin: "6px 0 0" }}>
            Esta leitura usa <b>apenas dados reais já medidos</b>, re-ponderados para a classe. Os itens acima entram nas próximas
            ondas — enquanto não chegam, <b>não são inventados</b>.
          </p>
        </div>
      )}
    </Panel>
  );
}
