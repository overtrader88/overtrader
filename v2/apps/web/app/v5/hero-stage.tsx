"use client";

/**
 * Palco do hero v5 — gráfico de candles REAL (lightweight-charts, já dependência
 * do produto) que se materializa atrás de um scanner de IA. A lib é importada
 * dinamicamente no mount (não bloqueia o first paint). Sincronia por CSS:
 * curtain (3s) revela o gráfico, o scanline varre junto e as zonas de
 * confluência acendem quando a varredura passa. Reduced-motion: tudo estático.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import { RadialGauge, SignalBadge, ConfidenceBadge, EquityCurve } from "@/components/ui";
import s from "./page.module.css";

const LAYERS = [
  "Tendência", "Momentum", "Volatilidade", "Smart Money (SMC)",
  "Multi-timeframe", "Harmônicos", "Monte Carlo", "Volume / liquidez",
];
const EQUITY = [0, 0.3, 0.1, 0.9, 0.7, 1.6, 1.3, 2.3, 2.0, 3.1, 2.8, 3.8, 4.6];

/** OHLC mock determinístico (LCG com seed fixa) — BTCUSDT 4H realista. */
function genCandles(n = 56) {
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let price = 64200;
  const t0 = 1717200000; // base fixa (determinismo > relógio)
  const out: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[] = [];
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i / 6.5) * 240 + i * 26; // leve viés de alta + ondas
    const noise = (rnd() - 0.47) * 620;
    const open = price;
    const close = Math.max(1000, price + wave * 0.18 + noise);
    const high = Math.max(open, close) + rnd() * 300;
    const low = Math.min(open, close) - rnd() * 300;
    out.push({ time: (t0 + i * 14400) as UTCTimestamp, open, high, low, close });
    price = close;
  }
  return out;
}

export function HeroStage({ engineVersion }: { engineVersion: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    let chart: IChartApi | null = null;
    let dead = false;
    (async () => {
      const lib = await import("lightweight-charts");
      if (dead || !chartRef.current) return;
      chart = lib.createChart(chartRef.current, {
        autoSize: true,
        layout: {
          background: { color: "transparent" },
          textColor: "#535f74",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "rgba(120, 160, 225, 0.05)" },
          horzLines: { color: "rgba(120, 160, 225, 0.05)" },
        },
        rightPriceScale: { borderColor: "rgba(120, 170, 235, 0.15)" },
        timeScale: { borderColor: "rgba(120, 170, 235, 0.15)", timeVisible: true, secondsVisible: false },
        crosshair: { vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } },
        handleScroll: false,
        handleScale: false,
      });
      const series = chart.addSeries(lib.CandlestickSeries, {
        upColor: "#2bd49e", downColor: "#ff6b8a",
        borderUpColor: "#2bd49e", borderDownColor: "#ff6b8a",
        wickUpColor: "rgba(43, 212, 158, 0.6)", wickDownColor: "rgba(255, 107, 138, 0.6)",
      });
      series.setData(genCandles());
      chart.timeScale().fitContent();
      setPlay(true); // dispara curtain + scanner + zonas (CSS)
    })();
    return () => { dead = true; chart?.remove(); };
  }, []);

  return (
    <section className={`${s.show} ${play ? s.play : ""}`} aria-label="Demonstração: a IA analisando um gráfico ao vivo">
      <div className={s.showBar}>
        <span className={s.live}><span className={s.liveDot} /> ANÁLISE AO VIVO</span>
        <b>BTCUSDT</b><span className={s.tf}>4H</span>
        <span className={s.engine}>ENGINE {engineVersion}</span>
      </div>

      <div className={s.grid2}>
        {/* gráfico + camada de IA */}
        <div className={s.chartBox}>
          <div ref={chartRef} className={s.chartEl} />
          <span className={s.scanTag}><span className={s.scanDot} /> IA ESCANEANDO · 15 CAMADAS</span>
          <div className={s.curtain} aria-hidden />
          <div className={s.scanline} aria-hidden />
          <div className={`${s.zone} ${s.z1}`} style={{ left: "15%", top: "34%", width: "13%", height: "22%" }} aria-hidden>
            <span className={s.zlabel}>Order block 4H</span>
          </div>
          <div className={`${s.zone} ${s.z2}`} style={{ left: "44%", top: "52%", width: "12%", height: "18%" }} aria-hidden>
            <span className={s.zlabel}>FVG</span>
          </div>
          <div className={`${s.zone} ${s.z3}`} style={{ left: "69%", top: "18%", width: "17%", height: "26%" }} aria-hidden>
            <span className={s.zlabel}>Confluência 7/10</span>
          </div>
          <span className={`${s.marker} ${s.m1}`} style={{ left: "20%", top: "60%" }} aria-hidden />
          <span className={`${s.marker} ${s.m2}`} style={{ left: "49%", top: "47%" }} aria-hidden />
          <span className={`${s.marker} ${s.m3}`} style={{ left: "76%", top: "28%" }} aria-hidden />
        </div>

        {/* camadas + veredito */}
        <div className={s.sideCol}>
          <div>
            <div className={s.colHead}>15 camadas analisadas</div>
            <ul className={s.layers}>
              {LAYERS.map((l, i) => (
                <li className={s.layer} key={l} style={{ "--i": i } as CSSProperties}>
                  <span className={s.check} aria-hidden>✓</span>
                  <span className={s.layerName}>{l}</span>
                  <span className={s.layerOk}>ok</span>
                </li>
              ))}
              <li className={s.more}>+7 camadas · pesos versionados</li>
            </ul>
          </div>
          <div className={s.verdict2}>
            <div className={s.verdict}>
              <SignalBadge direction="buy">Compra</SignalBadge>
              <span className={s.confl}>confluência 7/10 · votos 12 · 5 · 3</span>
            </div>
            <RadialGauge value={72} size={104} stroke={9} caption="força" />
          </div>
        </div>
      </div>

      {/* prova estatística */}
      <div className={s.stageFoot}>
        <ConfidenceBadge
          label="Profit factor · backtest"
          value={1.89}
          ci={[1.42, 2.51]}
          n={142}
          method="bootstrap"
          period="jan/24–mai/26"
          min={0}
          max={3.5}
        />
        <div className={s.eqWrap}>
          <div className={s.eqHead}><span>Curva de R acumulado</span><span className={s.eqVal}>+4,6 R</span></div>
          <EquityCurve data={EQUITY} height={56} gradientId="v5eq" />
        </div>
        <div className={s.seal}><span className={s.sealLed} /> VEREDITO: VALIDADO</div>
      </div>
    </section>
  );
}
