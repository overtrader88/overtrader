/**
 * Rede neural — indicadores → 15 camadas → score. SVG estático (server) com
 * pulsos de luz percorrendo as conexões via stroke-dasharray animado em CSS
 * (token --ai). Decorativo: aria-hidden; o conteúdo textual está na seção.
 */
import s from "./page.module.css";

const INPUTS: { label: string; y: number }[] = [
  { label: "Tendência", y: 36 },
  { label: "Momentum", y: 96 },
  { label: "SMC", y: 156 },
  { label: "Volume", y: 216 },
  { label: "Multi-TF", y: 276 },
];
const MID = [66, 136, 206, 276];
const OUT_Y = 156;

const inPath = (y1: number, y2: number) => `M 77 ${y1} C 180 ${y1}, 195 ${y2}, 283 ${y2}`;
const outPath = (y: number) => `M 309 ${y} C 420 ${y}, 440 ${OUT_Y}, 512 ${OUT_Y}`;

// Conexões com pulso de luz (subconjunto, em cascata).
const FLOWS: { d: string; delay: number }[] = [
  { d: inPath(36, 66), delay: 0 },
  { d: inPath(96, 136), delay: 0.4 },
  { d: inPath(156, 206), delay: 0.8 },
  { d: inPath(216, 136), delay: 1.2 },
  { d: inPath(276, 276), delay: 1.6 },
  { d: inPath(156, 66), delay: 2.0 },
  ...MID.map((y, i) => ({ d: outPath(y), delay: 0.5 + i * 0.45 })),
];

export function Neural() {
  return (
    <div className={s.neuralWrap} data-rv>
      <svg className={s.neural} viewBox="0 0 620 320" aria-hidden>
        {/* conexões base */}
        {INPUTS.flatMap((a) => MID.map((m) => (
          <path className={s.npath} d={inPath(a.y, m)} key={`p${a.y}-${m}`} />
        )))}
        {MID.map((y) => <path className={s.npath} d={outPath(y)} key={`o${y}`} />)}
        {/* pulsos */}
        {FLOWS.map((f, i) => (
          <path className={s.nflow} d={f.d} style={{ animationDelay: `${f.delay}s` }} key={i} />
        ))}
        {/* nós de entrada (indicadores) */}
        {INPUTS.map((a) => (
          <g key={a.label}>
            <circle className={s.nnode} cx={64} cy={a.y} r={13} />
            <text className={`${s.nlabel} ${s.nlabelB}`} x={64} y={a.y + 28} textAnchor="middle">{a.label}</text>
          </g>
        ))}
        {/* nós das camadas (IA) */}
        <text className={s.nsub} x={296} y={22} textAnchor="middle">15 CAMADAS · PESOS VERSIONADOS</text>
        {MID.map((y) => <circle className={`${s.nnode} ${s.nnodeAi}`} cx={296} cy={y} r={13} key={y} />)}
        {/* saída (score) */}
        <circle className={`${s.nnode} ${s.nnodeOut}`} cx={540} cy={OUT_Y} r={28} />
        <text className={s.nscore} x={540} y={OUT_Y + 1} textAnchor="middle" dominantBaseline="central">72</text>
        <text className={s.nsub} x={540} y={OUT_Y + 48} textAnchor="middle">SCORE DE CONFLUÊNCIA</text>
      </svg>
    </div>
  );
}
