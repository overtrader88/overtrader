/**
 * Relatório Executivo em PDF — documento DESENHADO DE PROPÓSITO (não a tela
 * impressa). Gerado no servidor via @react-pdf/renderer a partir do DTO
 * `FullAnalysis` + candles (gráfico) + narrativa de IA (opcional).
 *
 * Layout A4: cabeçalho com LOGO vetorial, capa com recomendação, GRÁFICO de
 * candles com os níveis do plano, LEITURA da IA, e 12 seções numeradas. Rodapé
 * fixo com paginação e aviso de risco. Fiel ao "prova antes de prometer":
 * backtest com IC e n; selo na cor real (cinza/vermelho quando fraco).
 */
import path from "node:path";
import { Children } from "react";
import { Document, Page, View, Text, StyleSheet, Svg, Path, Rect, Circle, Line, G, Font } from "@react-pdf/renderer";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { signalSide } from "@tradeai/shared";
import { ENGINE_VERSION } from "@tradeai/engine";
import type { FullAnalysis } from "@/lib/analysis/full";
import { buildPriceLines } from "@/lib/analysis/chart-overlays";
import { buildTradeGuard } from "@/lib/analysis/trade-guard";

export interface ReportCandle { time: number; open: number; high: number; low: number; close: number }

/**
 * Fonte EMBUTIDA (LiberationSans, OFL — métrica-compatível com Helvetica/Arial).
 * Embutir é o que garante que o layout calculado pelo react-pdf bata com o que é
 * renderizado em QUALQUER visualizador (sem substituição de fonte que transborda
 * e sobrepõe texto). Caminho relativo ao cwd do runtime (apps/web); incluído no
 * bundle serverless via `outputFileTracingIncludes` no next.config.
 */
const FONT_DIR = path.join(process.cwd(), "lib", "report", "fonts");
Font.register({
  family: "TradeSans",
  fonts: [
    { src: path.join(FONT_DIR, "TradeSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "TradeSans-Bold.ttf"), fontWeight: 700 },
  ],
});
// não hifenizar (evita quebras estranhas tipo "VEN-DA")
Font.registerHyphenationCallback((word) => [word]);

// ---------- paleta (clara, premium) ----------
const C = {
  paper: "#FFFFFF",
  ink: "#0E1420",
  inkSoft: "#46505F",
  inkFaint: "#8A94A3",
  line: "#BBC4D2",
  lineSoft: "#D2DAE5",
  panel: "#F4F7FB",
  teal: "#0E8C84",
  tealSoft: "#E6F4F2",
  blue: "#2F7DD1",
  bull: "#0B9C6B",
  bear: "#D43B5E",
  amber: "#B5821A",
  grey: "#9AA4B2",
};

// ---------- formatação (server-side, pt-BR via ICU do Node) ----------
const fmtPrice = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 });
const pct1 = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const pctAbs = (x: number) => `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const signed = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
const reportDate = (ms: number) => new Date(ms).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
const fnum = (n: number, d = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

const SIGNAL_PT: Record<string, string> = {
  STRONG_BUY: "COMPRA FORTE", BUY: "COMPRA", WEAK_BUY: "COMPRA FRACA", NEUTRAL: "NEUTRO",
  WEAK_SELL: "VENDA FRACA", SELL: "VENDA", STRONG_SELL: "VENDA FORTE",
};
const ASSET_PT: Record<AssetType, string> = {
  crypto: "Cripto", forex: "Forex", commodities: "Commodities", indices: "Índices", stocks: "Ações",
};
const SEAL: Record<string, { label: string; sub: string; color: string }> = {
  green: { label: "VALIDADO", sub: "SELO VERDE", color: C.bull },
  yellow: { label: "RESSALVA", sub: "SELO AMARELO", color: C.amber },
  red: { label: "REPROVADO", sub: "SELO VERMELHO", color: C.bear },
  grey: { label: "INSUFICIENTE", sub: "SEM SELO", color: C.grey },
};
const sealOf = (s?: string) => SEAL[s === "green" || s === "yellow" || s === "red" ? s : "grey"]!;
const dirColor = (side: "buy" | "sell" | "neutral") => (side === "buy" ? C.bull : side === "sell" ? C.bear : C.inkSoft);

const SMC_BIAS_PT: Record<string, { label: string; color: string }> = {
  bullish: { label: "ALTA", color: C.bull }, bearish: { label: "BAIXA", color: C.bear }, neutral: { label: "NEUTRO", color: C.inkSoft },
};
const SMC_STRUCT_PT: Record<string, string> = {
  bullish_bos: "BOS de alta", bearish_bos: "BOS de baixa",
  bullish_choch: "CHoCH de alta", bearish_choch: "CHoCH de baixa", consolidating: "Consolidando",
};
const ELLIOTT_PT: Record<string, string> = {
  wave_1: "Onda 1", wave_2: "Onda 2", wave_3: "Onda 3", wave_4: "Onda 4", wave_5: "Onda 5",
  wave_a: "Onda A", wave_b: "Onda B", wave_c: "Onda C", indefinido: "Indefinido",
};
const WK_PT: Record<string, string> = {
  accumulation: "Acumulação", markup: "Markup (alta)", distribution: "Distribuição", markdown: "Markdown (baixa)", transition: "Transição",
};
const DOW_PT: Record<string, string> = { primary_uptrend: "Alta primária", primary_downtrend: "Baixa primária", sideways: "Lateral" };
const GANN_PT: Record<string, string> = { above: "acima do 1×1", below: "abaixo do 1×1", on: "no 1×1" };
const MTF_SIDE_PT: Record<string, string> = { buy: "COMPRA", sell: "VENDA", neutral: "NEUTRO" };
const ALIGN_PT: Record<string, string> = {
  fully_aligned: "Alinhamento total", partially_aligned: "Alinhamento parcial", divergent: "Divergência", neutral: "Sem direção clara",
};
const MON_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const s = StyleSheet.create({
  page: { paddingTop: 52, paddingBottom: 44, paddingHorizontal: 44, fontFamily: "TradeSans", fontSize: 9, color: C.ink, lineHeight: 1.4 },
  header: { position: "absolute", top: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 7 },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brand: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.ink },
  brandAccent: { color: "#2F7DD1" },
  headerMeta: { fontSize: 8, color: C.inkFaint },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, fontSize: 7, color: C.inkFaint },
  // capa
  coverTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  kicker: { fontSize: 9, letterSpacing: 3, color: C.teal, fontWeight: 700 },
  h1: { fontSize: 30, lineHeight: 1.1, fontWeight: 700, color: C.ink, marginTop: 10, marginBottom: 3 },
  coverMeta: { fontSize: 10, color: C.inkSoft, marginTop: 4 },
  recoCard: { flexDirection: "row", marginTop: 16, borderWidth: 1, borderColor: C.line, borderRadius: 8 },
  recoStripe: { width: 6, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  recoBody: { flex: 1, paddingVertical: 16, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recoLeft: { flex: 1, paddingRight: 12 },
  recoLabelK: { fontSize: 8, letterSpacing: 1.5, color: C.inkFaint, textTransform: "uppercase" },
  recoLabel: { fontSize: 24, lineHeight: 1.1, fontWeight: 700, marginTop: 4 },
  strengthWrap: { alignItems: "flex-end", minWidth: 92 },
  strengthNum: { fontSize: 32, lineHeight: 1, fontWeight: 700 },
  strengthCap: { fontSize: 7.5, color: C.inkFaint, letterSpacing: 1, marginTop: 5 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 7 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 9, backgroundColor: C.panel },
  chipK: { fontSize: 7, color: C.inkFaint, letterSpacing: 1, textTransform: "uppercase" },
  chipV: { fontSize: 11, fontWeight: 700, color: C.ink },
  summary: { marginTop: 12, fontSize: 9.5, color: C.inkSoft, lineHeight: 1.5 },
  sealStrip: { flexDirection: "row", alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 11, backgroundColor: C.panel },
  sealDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  sealLabel: { fontSize: 12, fontWeight: 700 },
  sealSub: { fontSize: 8, color: C.inkFaint, letterSpacing: 1 },
  sealReason: { fontSize: 8.5, color: C.inkSoft, flex: 1, marginLeft: 12 },
  // seções
  section: { marginTop: 13 },
  secHead: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  secNum: { width: 19, height: 19, borderRadius: 4, backgroundColor: C.teal, color: C.paper, fontSize: 10, fontWeight: 700, textAlign: "center", paddingTop: 3, marginRight: 9 },
  secTitle: { fontSize: 13, fontWeight: 700, color: C.ink },
  secNote: { fontSize: 8, color: C.inkFaint, marginTop: 6, lineHeight: 1.45 },
  narrative: { fontSize: 9.5, color: C.ink, lineHeight: 1.55, textAlign: "justify", backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 13 },
  chartCard: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8, backgroundColor: C.paper },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 7, paddingHorizontal: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendSwatch: { width: 10, height: 3, borderRadius: 2 },
  legendText: { fontSize: 7.5, color: C.inkSoft },
  // tabela
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 5, alignItems: "center" },
  tHead: { flexDirection: "row", backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.line, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5 },
  th: { fontSize: 7.5, color: C.inkFaint, letterSpacing: 0.6, textTransform: "uppercase", paddingHorizontal: 6 },
  td: { fontSize: 9, color: C.ink, paddingHorizontal: 6 },
  // cartões de stat
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 9, width: "31.6%", backgroundColor: C.paper },
  statK: { fontSize: 7.5, color: C.inkFaint, letterSpacing: 0.8, textTransform: "uppercase" },
  statV: { fontSize: 15, fontWeight: 700, marginTop: 3 },
  statCi: { fontSize: 7.5, color: C.inkFaint, marginTop: 2 },
  barTrack: { height: 6, backgroundColor: C.lineSoft, borderRadius: 3, marginTop: 3 },
  barFill: { height: 6, borderRadius: 3 },
});

// ---------- logo vetorial (ícone Overtrader) ----------
function BrandLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Rect x={0} y={0} width={128} height={128} rx={24} fill="#185FA5" />
      <Path d="M18 96 L38 62 L54 76 L80 38" stroke="#fff" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M80 38 H96 M80 38 V54" stroke="#fff" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={54} cy={108} r={7} fill="#fff" opacity={0.35} />
    </Svg>
  );
}

// ---------- gráfico de candles + níveis (SVG) ----------
function CandleChart({ candles, lines }: { candles: ReportCandle[]; lines: { price: number; color: string; title: string; dashed: boolean }[] }) {
  const W = 491, H = 150, padR = 64, padTop = 6, padBot = 6;
  const plotW = W - padR, plotH = H - padTop - padBot;
  const data = candles.slice(-80);
  if (data.length < 2) return null;
  const prices = [...data.flatMap((c) => [c.high, c.low]), ...lines.map((l) => l.price)].filter(Number.isFinite);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = max - min || 1;
  const y = (p: number) => padTop + (1 - (p - min) / span) * plotH;
  const n = data.length;
  const cw = plotW / n;
  const bw = Math.max(1.2, cw * 0.62);
  const grid = [max, min + span * 0.66, min + span * 0.33, min];
  return (
    <Svg width={W} height={H}>
      {/* grade horizontal */}
      {grid.map((p, i) => (
        <G key={`g${i}`}>
          <Line x1={0} y1={y(p)} x2={plotW} y2={y(p)} stroke={C.lineSoft} strokeWidth={0.6} />
          <Text x={plotW + 3} y={y(p) + 2.5} fill={C.inkFaint} style={{ fontSize: 6.5, fontFamily: "TradeSans" }}>{fmtPrice(p)}</Text>
        </G>
      ))}
      {/* candles */}
      {data.map((c, i) => {
        const x = i * cw + cw / 2;
        const up = c.close >= c.open;
        const col = up ? C.bull : C.bear;
        const yo = y(c.open), yc = y(c.close);
        const top = Math.min(yo, yc);
        const h = Math.max(0.7, Math.abs(yo - yc));
        return (
          <G key={`c${i}`}>
            <Line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke={col} strokeWidth={0.6} />
            <Rect x={x - bw / 2} y={top} width={bw} height={h} fill={col} />
          </G>
        );
      })}
      {/* níveis do plano (entrada/stop/TP/OB/FVG/PRZ) */}
      {lines.map((l, i) => (
        <G key={`l${i}`}>
          <Line x1={0} y1={y(l.price)} x2={plotW} y2={y(l.price)} stroke={l.color} strokeWidth={0.9} strokeDasharray={l.dashed ? "3 2" : undefined} />
          <Text x={plotW + 3} y={y(l.price) - 1.5} fill={l.color} style={{ fontSize: 6.5, fontFamily: "TradeSans", fontWeight: 700 }}>{l.title}</Text>
        </G>
      ))}
    </Svg>
  );
}

// ---------- componentes ----------
function Chip({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipK}>{k}</Text>
      <Text style={s.chipV}>{v}</Text>
    </View>
  );
}

export interface Motor2Report {
  label: string;
  side: "buy" | "sell" | "neutral";
  sideLabel: string;
  score: number;
  plan: { entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number; takeProfit3: number; rr1: number } | null;
  agree: string[];
  against: string[];
  manda: string;
  cuidados: string;
}

/** Bloco do MOTOR 2 (leitura por classe) na capa do relatório. */
function Motor2Block({ m }: { m: Motor2Report }) {
  const col = dirColor(m.side);
  const r = m.plan;
  const dSL = r ? Math.abs(r.entry - r.stopLoss) : 0;
  const rOf = (px: number) => (dSL > 0 ? Math.abs(px - r!.entry) / dSL : 0);
  const rows: [string, number, string, string][] = r
    ? [
        ["TP3", r.takeProfit3, `R ${fnum(rOf(r.takeProfit3), 1)}`, C.bull],
        ["TP2", r.takeProfit2, `R ${fnum(rOf(r.takeProfit2), 1)}`, C.bull],
        ["TP1", r.takeProfit1, `R ${fnum(r.rr1 || rOf(r.takeProfit1), 1)}`, C.bull],
        ["Entrada", r.entry, "agora", C.ink],
        ["Stop", r.stopLoss, "R −1.0", C.bear],
      ]
    : [];
  return (
    <View style={{ marginTop: 14, borderWidth: 1, borderColor: col, borderRadius: 8, padding: 13, backgroundColor: C.panel }} wrap={false}>
      <Text style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: col, marginBottom: 6 }}>MOTOR 2 · LEITURA POR CLASSE ({m.label.toUpperCase()})</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: r ? 9 : 4 }}>
        <Text style={{ fontSize: 20, fontWeight: 700, color: col }}>{m.sideLabel}</Text>
        <Text style={{ fontSize: 12, color: C.inkFaint }}>convicção {Math.round(m.score)}/100</Text>
      </View>
      {r ? (
        <View style={{ marginBottom: 4 }}>
          {rows.map(([tag, px, rr, c], i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: C.line }}>
              <Text style={{ fontSize: 8.5, fontWeight: 700, color: c, width: 60 }}>{tag}</Text>
              <Text style={{ fontSize: 8.5, color: C.ink, flex: 1, textAlign: "right" }}>{fmtPrice(px)}</Text>
              <Text style={{ fontSize: 8, color: C.inkFaint, width: 52, textAlign: "right" }}>{rr}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 8.5, color: C.inkSoft }}>Sem plano operacional (leitura neutra).</Text>
      )}
      <Text style={{ fontSize: 8.5, color: C.inkSoft, marginTop: 5 }}><Text style={{ color: C.bull, fontWeight: 700 }}>A favor: </Text>{m.agree.join(", ") || "—"}</Text>
      <Text style={{ fontSize: 8.5, color: C.inkSoft }}><Text style={{ color: C.bear, fontWeight: 700 }}>Contra: </Text>{m.against.join(", ") || "—"}</Text>
      <Text style={{ fontSize: 7.5, color: C.inkFaint, marginTop: 5, lineHeight: 1.45 }}>Manda: {m.manda}. Cuidados: {m.cuidados}. Níveis por ATR orientados ao lado do Motor 2; sem backtest próprio — calibração medida no track record forward por motor.</Text>
    </View>
  );
}

function Section({ n, title, children, note }: { n: number; title: string; children?: React.ReactNode; note?: string }) {
  // Cola o título à PRIMEIRA fileira de conteúdo (wrap={false} juntos), e deixa o
  // resto fluir. Assim o título nunca fica órfão no rodapé, sem criar vãos nem
  // partir dados — o conteúdo seguinte continua preenchendo a página normalmente.
  const kids = Children.toArray(children);
  const [lead, ...rest] = kids;
  return (
    <View style={s.section}>
      <View wrap={false}>
        <View style={s.secHead}>
          <Text style={s.secNum}>{n}</Text>
          <Text style={s.secTitle}>{title}</Text>
        </View>
        {lead}
      </View>
      {rest}
      {note ? <Text style={s.secNote}>{note}</Text> : null}
    </View>
  );
}

function StatCard({ k, value, ci, color, w }: { k: string; value: string; ci?: string; color?: string; w?: string }) {
  return (
    <View style={[s.statCard, w ? { width: w } : {}]} wrap={false}>
      <Text style={s.statK}>{k}</Text>
      <Text style={[s.statV, color ? { color } : {}]}>{value}</Text>
      {ci ? <Text style={s.statCi}>{ci}</Text> : null}
    </View>
  );
}

/**
 * Quebra cartões em fileiras (≤`per`) como Views separadas. Emitido como ARRAY no
 * fragmento da seção → o `Children.toArray` do `Section` achata e cola só a 1ª
 * fileira ao título (mantém o bloco-líder pequeno, sem vãos).
 */
function gridRows(cards: React.ReactNode[], per = 3): React.ReactNode[] {
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < cards.length; i += per) {
    rows.push(<View key={`gr${i}`} style={s.statGrid}>{cards.slice(i, i + per)}</View>);
  }
  return rows;
}

function ProbBar({ label, value, ci, color }: { label: string; value: number; ci?: [number, number]; color: string }) {
  return (
    <View style={{ marginTop: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 8.5, color: C.inkSoft }}>{label}</Text>
        <Text style={{ fontSize: 8.5, fontWeight: 700 }}>
          {Math.round(value)}%{ci ? `  [${Math.round(ci[0])}–${Math.round(ci[1])}]` : ""}
        </Text>
      </View>
      <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

// ---------- seções ----------
function buildSections(dto: FullAnalysis, candles: ReportCandle[] | undefined, narrative: string | null): { title: string; node: React.ReactNode }[] {
  const out: { title: string; node: React.ReactNode }[] = [];
  const a = dto.analysis;

  // 1. Visão geral
  out.push({
    title: "Visão Geral da Análise",
    node: (
      <>
        <View style={s.statGrid}>
          <StatCard k="Indicadores avaliados" value={String(a.indicators.length)} />
          <StatCard k="Votos · Compra / Neutro / Venda" value={`${a.signal.votes.buy} · ${a.signal.votes.neutral} · ${a.signal.votes.sell}`} />
          <StatCard k="Confluência" value={`${a.signal.confluence} / 10`} />
        </View>
        <Text style={s.secNote}>
          Considera 20+ indicadores técnicos, Smart Money Concepts, padrões harmônicos, WEGD, Monte Carlo, cenários
          probabilísticos, sazonalidade e confluência multi-timeframe — cada número com amostra e incerteza quando aplicável.
        </Text>
      </>
    ),
  });

  // 2. Decisão · operar ou não (o diferencial honesto)
  const guard = buildTradeGuard(dto);
  const gc = guard.tone === "green" ? C.bull : guard.tone === "yellow" ? C.amber : guard.tone === "red" ? C.bear : C.grey;
  out.push({
    title: "Decisão · Operar ou Não",
    node: (
      <View wrap={false} style={{ borderWidth: 1, borderColor: C.line, borderLeftWidth: 3, borderLeftColor: gc, borderRadius: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, paddingHorizontal: 11 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{guard.headline}</Text>
          <Text style={{ fontSize: 8.5, fontWeight: 700, color: gc, borderWidth: 1, borderColor: gc, borderRadius: 99, paddingVertical: 3, paddingHorizontal: 9 }}>{guard.operate ? "OPERÁVEL" : "NÃO OPERAR"}</Text>
        </View>
        {guard.reasons.map((r, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, paddingVertical: 7, paddingHorizontal: 11, borderTopWidth: 1, borderTopColor: C.lineSoft }}>
            <Text style={{ fontSize: 6.5, fontWeight: 700, color: r.severity === "block" ? C.bear : C.amber, width: 50 }}>{r.severity === "block" ? "IMPEDITIVO" : "RESSALVA"}</Text>
            <Text style={{ flex: 1, fontSize: 8.5, color: C.inkSoft, lineHeight: 1.4 }}><Text style={{ fontWeight: 700, color: C.ink }}>{r.title}</Text> — {r.detail}</Text>
          </View>
        ))}
        {guard.pros.length ? (
          <View style={{ paddingVertical: 8, paddingHorizontal: 11, borderTopWidth: 1, borderTopColor: C.lineSoft }}>
            <Text style={{ fontSize: 7, fontWeight: 700, color: C.bull, letterSpacing: 1, marginBottom: 3 }}>A FAVOR</Text>
            {guard.pros.map((p, i) => <Text key={i} style={{ fontSize: 8.5, color: C.inkSoft, marginBottom: 1 }}>✓ {p}</Text>)}
          </View>
        ) : null}
      </View>
    ),
  });

  // 3. Gráfico + níveis
  const lines = buildPriceLines(dto);
  if (candles && candles.length >= 2) {
    out.push({
      title: "Gráfico de Preço & Níveis",
      node: (
        <>
          <View style={s.chartCard} wrap={false}><CandleChart candles={candles} lines={lines} /></View>
          {lines.length ? (
            <View style={s.legendRow}>
              {lines.map((l, i) => (
                <View key={i} style={s.legendItem}>
                  <View style={[s.legendSwatch, { backgroundColor: l.color }]} />
                  <Text style={s.legendText}>{l.title} · {fmtPrice(l.price)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={s.secNote}>Últimos {Math.min(80, candles.length)} candles ({timeframeMeta(dto)}). Linhas = plano operacional + zonas institucionais (OB/FVG) + PRZ harmônica.</Text>
        </>
      ),
    });
  }

  // 3. Leitura da IA
  if (narrative) {
    out.push({
      title: "Leitura do Analista · IA",
      node: (
        <>
          <Text style={s.narrative} wrap={false}>{narrative}</Text>
          <Text style={s.secNote}>Texto gerado por IA a partir dos números medidos — análise, não recomendação de investimento.</Text>
        </>
      ),
    });
  }

  // 4. Plano operacional
  const r = a.risk;
  const side = signalSide(a.signal.signal);
  if (side !== "neutral") {
    const rOf = (price: number) => (r.distSL > 0 ? Math.abs(price - r.entry) / r.distSL : 0);
    const rows: [string, number, string, string][] = [
      ["TP3", r.takeProfit3, `R ${fnum(rOf(r.takeProfit3), 1)}`, C.bull],
      ["TP2", r.takeProfit2, `R ${fnum(rOf(r.takeProfit2), 1)}`, C.bull],
      ["TP1", r.takeProfit1, `R ${fnum(r.rr1, 1)}`, C.bull],
      ["Entrada", r.entry, "agora", C.blue],
      ["Stop", r.stopLoss, "R −1.0", C.bear],
    ];
    out.push({
      title: "Plano Operacional · níveis por ATR",
      node: (
        <>
          <View style={s.tHead} wrap={false}>
            <Text style={[s.th, { width: "30%" }]}>Nível</Text>
            <Text style={[s.th, { width: "45%" }]}>Preço</Text>
            <Text style={[s.th, { width: "25%" }]}>Risco/Retorno</Text>
          </View>
          {rows.map(([k, price, rr, col]) => (
            <View wrap={false} style={s.tRow} key={k}>
              <Text style={[s.td, { width: "30%", fontWeight: 700, color: col }]}>{k}</Text>
              <Text style={[s.td, { width: "45%" }]}>{fmtPrice(price as number)}</Text>
              <Text style={[s.td, { width: "25%", color: C.inkSoft }]}>{rr}</Text>
            </View>
          ))}
        </>
      ),
    });
  } else {
    out.push({
      title: "Plano Operacional",
      node: <Text style={{ fontSize: 9, color: C.inkSoft }}>Sinal neutro — sem plano operacional. O motor não aponta entrada com convicção suficiente no momento.</Text>,
    });
  }

  // 5. Selo + backtest
  const bt = dto.backtest;
  if (bt) {
    const oos = bt.outOfSample ? (bt.outOfSample.profitFactor.value > 1 ? "robusto" : "fraco") : "n/d";
    out.push({
      title: "Selo de Qualidade & Backtest honesto",
      node: (
        <>
          {gridRows([
            <StatCard key="pf" k="Profit factor" value={fnum(bt.profitFactor.value)} ci={`IC95 ${fnum(bt.profitFactor.ci95[0])}–${fnum(bt.profitFactor.ci95[1])} · n=${bt.profitFactor.n}`} color={bt.profitFactor.ci95[0] >= 1.5 ? C.bull : C.ink} />,
            <StatCard key="wr" k="Win rate" value={pctAbs(bt.winRate.value * 100)} ci={`IC95 ${pctAbs(bt.winRate.ci95[0] * 100)}–${pctAbs(bt.winRate.ci95[1] * 100)}`} color={bt.winRate.ci95[0] >= 0.5 ? C.bull : C.ink} />,
            <StatCard key="ar" k="R médio / trade" value={signed(bt.avgR.value)} ci={`IC95 ${signed(bt.avgR.ci95[0])}–${signed(bt.avgR.ci95[1])}`} color={bt.avgR.value >= 0 ? C.bull : C.bear} />,
            <StatCard key="td" k="Trades decisivos" value={`${bt.decisiveTrades}`} ci={`mínimo ${bt.minDecisiveTrades}${bt.decisiveTrades >= bt.minDecisiveTrades ? " ✓" : " ⚠"}`} />,
            <StatCard key="oos" k="Out-of-sample" value={oos} ci="validação fora da amostra" color={oos === "robusto" ? C.bull : oos === "fraco" ? C.bear : C.inkSoft} />,
            <StatCard key="tp1" k="Toque no TP1" value={pctAbs(bt.tp1TouchRate * 100)} ci={`estratégia ${bt.strategy}`} />,
          ])}
          <Text style={s.secNote}>
            Walk-forward com janela dirigida por amostra{dto.period ? ` (${dto.period})` : ""}. O selo fica verde só quando o
            LIMITE INFERIOR do IC supera o limiar — nunca sobre amostra pequena. "Prova antes de prometer", medido.
          </Text>
        </>
      ),
    });
  }

  // 6. Monte Carlo
  const mc = dto.montecarlo;
  if (mc) {
    out.push({
      title: "Análise Probabilística · Monte Carlo",
      node: (
        <>
          {gridRows([
            <StatCard key="p90" k="Cenário otimista (P90)" value={fmtPrice(mc.optimistic)} color={C.bull} />,
            <StatCard key="p50" k="Mediana (P50)" value={fmtPrice(mc.median)} />,
            <StatCard key="p10" k="Cenário pessimista (P10)" value={fmtPrice(mc.pessimistic)} color={C.bear} />,
            <StatCard key="up" k="Probabilidade de alta" value={pctAbs(mc.winRateUp.value * 100)} ci={`IC95 ${pctAbs(mc.winRateUp.ci95[0] * 100)}–${pctAbs(mc.winRateUp.ci95[1] * 100)}`} color={C.bull} />,
            <StatCard key="vol" k="Volatilidade anualizada" value={pctAbs(mc.volatilityAnnualized)} />,
            <StatCard key="sim" k="Trajetórias simuladas" value={mc.simulations.toLocaleString("pt-BR")} ci={`${mc.horizonCandles} candles à frente`} />,
          ])}
          <Text style={s.secNote}>Preço atual {fmtPrice(mc.currentPrice)}. Probabilidades por simulação (não fórmula fechada).</Text>
        </>
      ),
    });
  }

  // 7. Cenários
  const sc = dto.scenarios;
  if (sc) {
    const Side = ({ label, side: ss, reco }: { label: string; side: typeof sc.buy; reco: boolean }) => {
      const color = ss.side === "buy" ? C.bull : C.bear;
      return (
        <View style={{ flex: 1, borderWidth: 1, borderColor: reco ? color : C.line, borderRadius: 6, padding: 10, backgroundColor: reco ? (ss.side === "buy" ? C.tealSoft : "#FCEBEF") : C.paper }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color }}>{label}{reco ? "  ★" : ""}</Text>
            <Text style={{ fontSize: 8.5, color: C.inkSoft }}>R esperado {signed(ss.expectedR)}</Text>
          </View>
          <ProbBar label="TP1" value={ss.tp1.probability.value * 100} ci={[ss.tp1.probability.ci95[0] * 100, ss.tp1.probability.ci95[1] * 100]} color={color} />
          <ProbBar label="TP2" value={ss.tp2.probability.value * 100} ci={[ss.tp2.probability.ci95[0] * 100, ss.tp2.probability.ci95[1] * 100]} color={color} />
          <ProbBar label="TP3" value={ss.tp3.probability.value * 100} ci={[ss.tp3.probability.ci95[0] * 100, ss.tp3.probability.ci95[1] * 100]} color={color} />
          <ProbBar label="Stop antes do TP1" value={ss.stopProbability.value * 100} color={C.bear} />
        </View>
      );
    };
    out.push({
      title: "Cenários Compra × Venda · first-passage",
      node: (
        <>
          <View style={{ flexDirection: "row", gap: 10 }} wrap={false}>
            <Side label="Compra" side={sc.buy} reco={sc.recommended === "buy"} />
            <Side label="Venda" side={sc.sell} reco={sc.recommended === "sell"} />
          </View>
          <Text style={s.secNote}>
            Probabilidades contando trajetórias que tocam cada nível ANTES do stop. {sc.recommended === "buy" ? "Compra" : "Venda"} recomendada
            pelo maior R esperado (vantagem de {signed(sc.edge)} R).
          </Text>
        </>
      ),
    });
  }

  // 8. Sazonalidade
  const seas = dto.seasonality;
  if (seas) {
    const rowsM = [seas.monthly.slice(0, 6), seas.monthly.slice(6)];
    out.push({
      title: `Sazonalidade · ${seas.yearsAnalyzed} anos`,
      node: (
        <>
          {rowsM.map((row, ri) => (
            <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }} key={ri} wrap={false}>
              {row.map((m) => {
                const cur = m.month === seas.currentMonth;
                const col = !m.sufficient ? C.grey : m.avgReturn.value > 0 ? C.bull : m.avgReturn.value < 0 ? C.bear : C.inkSoft;
                return (
                  <View key={m.month} style={{ flex: 1, borderWidth: cur ? 1.5 : 1, borderColor: cur ? C.teal : C.line, borderRadius: 5, padding: 6, alignItems: "center", backgroundColor: cur ? C.tealSoft : C.paper }}>
                    <Text style={{ fontSize: 7.5, color: C.inkFaint, letterSpacing: 0.5 }}>{MON_ABBR[m.month - 1]}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 700, color: col, marginTop: 2 }}>{m.sufficient ? pct1(m.avgReturn.value) : "—"}</Text>
                    <Text style={{ fontSize: 6.5, color: C.inkFaint, marginTop: 1 }}>n={m.sampleSize}</Text>
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={s.secNote}>{seas.summary} Células cinza = amostra insuficiente (n &lt; 5): sem veredito, em vez de cravar um número.</Text>
        </>
      ),
    });
  }

  // 9. SMC
  const smc = dto.smc;
  if (smc) {
    const bias = SMC_BIAS_PT[smc.bias] ?? { label: smc.bias, color: C.inkSoft };
    const Tbl = ({ head, rows }: { head: string[]; rows: string[][] }) =>
      rows.length ? (
        <View style={{ marginTop: 8 }}>
          <View style={s.tHead} wrap={false}>{head.map((h, i) => <Text key={i} style={[s.th, { width: `${100 / head.length}%` }]}>{h}</Text>)}</View>
          {rows.map((rw, ri) => (
            <View wrap={false} style={s.tRow} key={ri}>{rw.map((cell, ci) => <Text key={ci} style={[s.td, { width: `${100 / head.length}%`, fontSize: 8.5 }]}>{cell}</Text>)}</View>
          ))}
        </View>
      ) : null;
    out.push({
      title: "Smart Money Concepts · contexto institucional",
      node: (
        <>
          <View style={s.statGrid}>
            <StatCard k="Viés institucional" value={bias.label} color={bias.color} />
            <StatCard k="Estrutura de mercado" value={SMC_STRUCT_PT[smc.marketStructure] ?? smc.marketStructure} />
            <StatCard k="OB · FVG · Liquidez" value={`${smc.orderBlocks.length} · ${smc.fvgs.length} · ${smc.liquidityZones.length}`} />
          </View>
          <Tbl head={["Order Block", "Zona", "Impulso", "Status"]} rows={smc.orderBlocks.slice(0, 5).map((o) => [o.type === "bullish" ? "ALTA" : "BAIXA", `${fmtPrice(o.zoneBottom)}–${fmtPrice(o.zoneTop)}`, String(o.strength), o.mitigated ? "mitigado" : "ativo"])} />
          <Tbl head={["Fair Value Gap", "Zona", "—", "Status"]} rows={smc.fvgs.slice(0, 5).map((f) => [f.type === "bullish" ? "ALTA" : "BAIXA", `${fmtPrice(f.zoneBottom)}–${fmtPrice(f.zoneTop)}`, "gap", f.status === "active" ? "ativo" : "preenchido"])} />
        </>
      ),
    });
  }

  // 10. Harmônicos
  const harm = dto.harmonics;
  if (harm) {
    out.push({
      title: "Padrões Harmônicos · Fibonacci XABCD",
      node: harm.patterns.length ? (
        <>
          <View style={s.tHead} wrap={false}>
            <Text style={[s.th, { width: "28%" }]}>Padrão</Text>
            <Text style={[s.th, { width: "16%" }]}>Direção</Text>
            <Text style={[s.th, { width: "16%" }]}>Completude</Text>
            <Text style={[s.th, { width: "26%" }]}>PRZ</Text>
            <Text style={[s.th, { width: "14%" }]}>Match</Text>
          </View>
          {harm.patterns.slice(0, 6).map((p, i) => (
            <View wrap={false} style={s.tRow} key={i}>
              <Text style={[s.td, { width: "28%", fontWeight: 700 }]}>{p.name}</Text>
              <Text style={[s.td, { width: "16%", color: p.direction === "bullish" ? C.bull : C.bear }]}>{p.direction === "bullish" ? "ALTA" : "BAIXA"}</Text>
              <Text style={[s.td, { width: "16%" }]}>{p.completion}% {p.status === "completed" ? "✓" : ""}</Text>
              <Text style={[s.td, { width: "26%", fontSize: 8 }]}>{fmtPrice(p.prz.low)}–{fmtPrice(p.prz.high)}</Text>
              <Text style={[s.td, { width: "14%" }]}>{p.quality}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={{ fontSize: 9, color: C.inkSoft }}>{harm.summary}</Text>
      ),
    });
  }

  // 11. WEGD
  const w = dto.wegd;
  if (w) {
    const cells: [string, string, string][] = [
      ["Wyckoff", WK_PT[w.wyckoff.phase] ?? w.wyckoff.phase, `confiança ${w.wyckoff.confidence}%`],
      ["Elliott", ELLIOTT_PT[w.elliott.currentWave] ?? w.elliott.currentWave, `${w.elliott.type === "impulsive" ? "impulsiva" : w.elliott.type === "corrective" ? "corretiva" : "—"} · ${w.elliott.probability}%`],
      ["Gann", `1×1 ${GANN_PT[w.gann.positionVs1x1] ?? w.gann.positionVs1x1}`, w.gann.angle1x1 > 0 ? `1×1 @ ${fmtPrice(w.gann.angle1x1)}` : "sem projeção"],
      ["Dow", DOW_PT[w.dow.primaryTrend] ?? w.dow.primaryTrend, w.dow.confirmed ? "confirmada ✓" : "não confirmada"],
    ];
    out.push({
      title: "WEGD · Wyckoff · Elliott · Gann · Dow",
      node: (
        <>
          {gridRows(
            cells.map(([k, v, sub]) => (
              <View key={k} style={[s.statCard, { width: "48%" }]}>
                <Text style={s.statK}>{k}</Text>
                <Text style={[s.statV, { fontSize: 12 }]}>{v}</Text>
                <Text style={s.statCi}>{sub}</Text>
              </View>
            )),
            2,
          )}
        </>
      ),
    });
  }

  // 12. Multi-timeframe
  const mtf = dto.multiTimeframe;
  if (mtf) {
    const tfs = [mtf.current, mtf.higher, mtf.highest].filter(Boolean) as NonNullable<typeof mtf.current>[];
    out.push({
      title: "Confluência Multi-Timeframe",
      node: (
        <>
          {gridRows([
            <StatCard key="score" k="Score de confluência" value={`${mtf.confluenceScore} / 100`} color={C.teal} />,
            <StatCard key="align" k="Alinhamento" value={ALIGN_PT[mtf.alignment] ?? mtf.alignment} />,
            ...tfs.map((t) => (
              <StatCard key={t.timeframe} k={t.timeframe.toUpperCase()} value={MTF_SIDE_PT[t.side] ?? t.side} color={dirColor(t.side as "buy" | "sell" | "neutral")} />
            )),
          ])}
          <Text style={s.secNote}>{mtf.summary}</Text>
        </>
      ),
    });
  }

  return out;
}

function timeframeMeta(dto: FullAnalysis): string {
  return dto.period ? `período ${dto.period}` : "janela recente";
}

export function AnalysisReport({
  dto, symbol, assetType, timeframe, candles, narrative, motor2,
}: {
  dto: FullAnalysis;
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  candles?: ReportCandle[];
  narrative?: string | null;
  motor2?: Motor2Report | null;
}) {
  const a = dto.analysis;
  const side = signalSide(a.signal.signal);
  const reco = dirColor(side);
  const seal = sealOf(dto.quality?.status);
  const sections = buildSections(dto, candles, narrative ?? null);
  const headerMeta = `${symbol} · ${timeframe.toUpperCase()}`;

  return (
    <Document title={`Relatório Executivo — ${symbol} ${timeframe.toUpperCase()}`} author="Overtrader" subject="Análise técnica e quantitativa">
      <Page size="A4" style={s.page}>
        {/* cabeçalho fixo com logo */}
        <View style={s.header} fixed>
          <View style={s.headerBrand}>
            <BrandLogo size={16} />
            <Text style={s.brand}>Overtrader<Text style={s.brandAccent}> IA</Text></Text>
          </View>
          <Text style={s.headerMeta}>Relatório Executivo · {headerMeta}</Text>
        </View>
        {/* rodapé fixo com paginação + aviso de risco */}
        <View style={s.footer} fixed>
          <Text>Não é recomendação de investimento · resultados passados não garantem resultados futuros.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

        {/* ---- capa ---- */}
        <View style={s.coverTop}>
          <BrandLogo size={34} />
          <Text style={s.kicker}>RELATÓRIO EXECUTIVO COMPLETO</Text>
        </View>
        <Text style={s.h1}>{symbol}</Text>
        <Text style={s.coverMeta}>{ASSET_PT[assetType]} · {timeframe.toUpperCase()} · {reportDate(dto.generatedAt)}</Text>

        <View style={s.recoCard}>
          <View style={[s.recoStripe, { backgroundColor: reco }]} />
          <View style={s.recoBody}>
            <View style={s.recoLeft}>
              <Text style={s.recoLabelK}>Recomendação final</Text>
              <Text style={[s.recoLabel, { color: reco }]}>{SIGNAL_PT[a.signal.signal]}</Text>
            </View>
            <View style={s.strengthWrap}>
              <Text style={[s.strengthNum, { color: reco }]}>{a.signal.strength}<Text style={{ fontSize: 13, color: C.inkFaint }}> /100</Text></Text>
              <Text style={s.strengthCap}>FORÇA DO SINAL</Text>
            </View>
          </View>
        </View>

        <View style={s.chipsRow}>
          <Chip k="Confluência" v={`${a.signal.confluence}/10`} />
          <Chip k="Votos B·N·S" v={`${a.signal.votes.buy}·${a.signal.votes.neutral}·${a.signal.votes.sell}`} />
          <Chip k="R:R (TP1)" v={fnum(a.risk.rr1, 1)} />
          {a.meta?.regime ? <Chip k="Regime" v={String(a.meta.regime).toUpperCase()} /> : null}
          {typeof a.meta?.adxValue === "number" ? <Chip k="ADX" v={fnum(a.meta.adxValue, 1)} /> : null}
        </View>

        {a.explanation?.summary ? <Text style={s.summary}>{a.explanation.summary}</Text> : null}

        <View style={s.sealStrip}>
          <View style={[s.sealDot, { backgroundColor: seal.color }]} />
          <View>
            <Text style={[s.sealLabel, { color: seal.color }]}>{seal.label}</Text>
            <Text style={s.sealSub}>{seal.sub} · BACKTEST n={dto.backtest?.decisiveTrades ?? 0}</Text>
          </View>
          {dto.quality?.reason ? <Text style={s.sealReason}>{dto.quality.reason}</Text> : null}
        </View>

        {motor2 ? <Motor2Block m={motor2} /> : null}

        {/* ---- seções numeradas ---- */}
        {sections.map((sec, i) => (
          <Section key={i} n={i + 1} title={sec.title}>{sec.node}</Section>
        ))}

        {/* disclaimer de fechamento */}
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 9 }} minPresenceAhead={30}>
          <Text style={{ fontSize: 7.5, color: C.inkFaint, lineHeight: 1.5 }}>
            Documento gerado automaticamente pelo Overtrader (motor {ENGINE_VERSION}). Conteúdo educativo e analítico, sem
            aconselhamento individualizado — NÃO constitui recomendação de compra ou venda. Toda operação no mercado financeiro
            envolve risco de perda do capital. Métricas de backtest acompanham amostra (n) e intervalo de confiança de 95%; o
            selo de qualidade reflete o limite inferior do IC e fica cinza quando a amostra é fraca.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
