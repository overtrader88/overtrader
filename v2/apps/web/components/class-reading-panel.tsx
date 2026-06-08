import { Panel, PanelLabel, RadialGauge } from "@/components/ui";
import { computeClassReading } from "@/lib/analysis/engines";
import { loadServerExtras } from "@/lib/analysis/class-extras";
import { DerivativesLive } from "@/components/derivatives-live";
import { LiquidationHeatmap } from "@/components/liquidation-heatmap";
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
  // Derivativos da Binance + heatmap são buscados NO NAVEGADOR (Vercel bloqueada
  // por IP de cloud). Os demais extras rodam server-side (helper compartilhado).
  const extras = await loadServerExtras(dto.analysis.meta.asset, assetType);
  const r = computeClassReading(dto, assetType, extras);
  const m = r.methodology;
  const side = SIDE_PT[r.side];
  const mc = extras.macro;
  const fnd = extras.fundamental;
  const ct = extras.cot;
  const oc = extras.onchain;
  const br = extras.breadth;
  const ern = extras.earnings;
  const oil = extras.oil;

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
      {assetType === "crypto" && <LiquidationHeatmap symbol={dto.analysis.meta.asset} />}

      {oc && oc.applicability !== "not_applicable" && oc.tvlUsd != null && (
        <div className="cls-deriv">
          <div className="cd-h">On-chain · DefiLlama <span>dados reais</span></div>
          <div className="cd-grid">
            <div className="cd-cell">
              <div className="k">TVL da rede</div>
              <div className="v">${(oc.tvlUsd / 1e9).toFixed(2)}B</div>
              <div className="s">valor on-chain</div>
            </div>
            {oc.tvlChange30dPct != null && (
              <div className="cd-cell">
                <div className="k">Variação 30d</div>
                <div className={`v ${oc.tvlChange30dPct >= 0 ? "bull" : "bear"}`}>{oc.tvlChange30dPct >= 0 ? "+" : ""}{oc.tvlChange30dPct}%</div>
                <div className="s">{oc.tvlTrend === "rising" ? "adoção subindo" : oc.tvlTrend === "declining" ? "adoção caindo" : "estável"}</div>
              </div>
            )}
          </div>
          <p className="note" style={{ margin: "6px 0 0" }}>
            TVL é <b>contexto de adoção</b>, ruim para timing curto{oc.applicability === "limited" ? " (DeFi raso nesta rede — leitura fraca)" : ""}. Observado, não probabilidade.
          </p>
        </div>
      )}

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

      {oil && (
        <div className="cls-deriv">
          <div className="cd-h">Estoques de petróleo · EIA <span>dados reais · semanal</span></div>
          <div className="cd-grid">
            <div className="cd-cell">
              <div className="k">Estoque atual</div>
              <div className="v">{(oil.latestKb / 1000).toFixed(1)}M</div>
              <div className="s">barris</div>
            </div>
            <div className="cd-cell">
              <div className="k">Variação semanal</div>
              <div className={`v ${oil.weekChangeKb > 0 ? "bear" : "bull"}`}>{oil.weekChangePct >= 0 ? "+" : ""}{oil.weekChangePct.toFixed(1)}%</div>
              <div className="s">{oil.weekChangeKb > 0 ? "estoque subindo" : "estoque caindo"}</div>
            </div>
          </div>
          <p className="note" style={{ margin: "6px 0 0" }}>
            Estoque <b>subindo</b> = oferta folgada (vento contra o petróleo); <b>caindo</b> = aperto (a favor). Semana de {new Date(oil.period).toLocaleDateString("pt-BR")}.
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

      {br && (
        <div className="cls-deriv">
          <div className="cd-h">Breadth · setores S&amp;P <span>proxy aproximado</span></div>
          <div className="cd-grid">
            <div className="cd-cell">
              <div className={`v ${br.pctAbove50 >= 60 ? "bull" : br.pctAbove50 <= 40 ? "bear" : ""}`} style={{ fontSize: 17, fontWeight: 700 }}>{br.pctAbove50}%</div>
              <div className="k" style={{ marginTop: 4 }}>setores &gt; MM50</div>
            </div>
            <div className="cd-cell">
              <div className={`v ${br.pctAbove200 >= 60 ? "bull" : br.pctAbove200 <= 40 ? "bear" : ""}`} style={{ fontSize: 17, fontWeight: 700 }}>{br.pctAbove200}%</div>
              <div className="k" style={{ marginTop: 4 }}>setores &gt; MM200</div>
            </div>
            <div className="cd-cell">
              <div className="v" style={{ fontSize: 17, fontWeight: 700 }}>{br.sampleSize}/11</div>
              <div className="k" style={{ marginTop: 4 }}>setores lidos</div>
            </div>
          </div>
          <p className="note" style={{ margin: "6px 0 0" }}>
            <b>Proxy aproximado</b> (11 ETFs setoriais SPDR), não o advance-decline oficial. Muitos setores acima da MM = participação
            ampla (saudável); poucos = alta concentrada (frágil).
          </p>
        </div>
      )}

      {ern && (
        <div className="cls-pending" style={ern.daysAway <= 7 ? { borderStyle: "solid" } : undefined}>
          <div className="cp-h">Próximo earnings · FMP <span>{ern.daysAway <= 7 ? "atenção" : "agenda"}</span></div>
          <p className="note" style={{ margin: 0 }}>
            Divulgação em <b>{new Date(ern.date).toLocaleDateString("pt-BR")}</b> ({ern.daysAway <= 0 ? "em breve" : `~${ern.daysAway} dias`})
            {ern.epsEstimated != null ? ` · EPS estimado ${ern.epsEstimated}` : ""}.
            {ern.daysAway <= 7 ? <> <b>Cuidado:</b> earnings próximo costuma quebrar a leitura técnica — reduza tamanho ou evite operar contra o evento.</> : null}
          </p>
        </div>
      )}

      {mc && (mc.dxy || mc.vix || mc.us10y) && (
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
            {mc.us10y && (
              <div className="cd-cell">
                <div className="k">Juros 10Y</div>
                <div className={`v ${mc.us10y.changePct >= 0 ? "bear" : "bull"}`}>{mc.us10y.value.toFixed(2)}%</div>
                <div className="s">{mc.us10y.changePct >= 0 ? "+" : ""}{mc.us10y.changePct.toFixed(1)}% · {mc.us10y.changePct >= 0 ? "subindo" : "recuando"}</div>
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
