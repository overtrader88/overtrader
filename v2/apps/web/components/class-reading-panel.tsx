import { Panel, PanelLabel, RadialGauge } from "@/components/ui";
import { computeClassReading, type ClassExtras } from "@/lib/analysis/engines";
import { getBinanceDerivatives } from "@/lib/market/derivatives-binance";
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
  const extras: ClassExtras = {};
  if (assetType === "crypto") {
    extras.derivatives = await getBinanceDerivatives(dto.analysis.meta.asset);
  }
  const r = computeClassReading(dto, assetType, extras);
  const m = r.methodology;
  const side = SIDE_PT[r.side];
  const d = extras.derivatives;

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

      {d && (
        <div className="cls-deriv">
          <div className="cd-h">Derivativos · Binance Futures <span>dados reais</span></div>
          <div className="cd-grid">
            <div className="cd-cell">
              <div className="k">Funding (8h)</div>
              <div className={`v ${d.fundingRate >= 0 ? "bull" : "bear"}`}>{(d.fundingRate * 100).toFixed(4)}%</div>
              <div className="s">{d.fundingAnnualizedPct >= 0 ? "+" : ""}{d.fundingAnnualizedPct.toFixed(0)}% a.a.</div>
            </div>
            {d.oiChangePct != null && (
              <div className="cd-cell">
                <div className="k">Open Interest (1h)</div>
                <div className={`v ${d.oiChangePct >= 0 ? "bull" : "bear"}`}>{d.oiChangePct >= 0 ? "+" : ""}{d.oiChangePct.toFixed(2)}%</div>
                <div className="s">{d.oiChangePct >= 0 ? "expansão" : "redução"} de contratos</div>
              </div>
            )}
            {d.longShortRatio != null && (
              <div className="cd-cell">
                <div className="k">Contas long/short</div>
                <div className="v">{d.longShortRatio.toFixed(2)}</div>
                <div className="s">{d.longPct != null ? `${d.longPct.toFixed(0)}% compradas` : ""}</div>
              </div>
            )}
          </div>
          <p className="note" style={{ margin: "6px 0 0" }}>
            Funding/contas <b>muito esticados</b> num lado sinalizam <b>exaustão</b> (leitura contrária); OI subindo confirma
            convicção. Sentimento, não gatilho isolado.
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
