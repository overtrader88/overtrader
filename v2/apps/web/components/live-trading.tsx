"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { FullAnalysis } from "@/lib/analysis/full";
import { buildPriceLines } from "@/lib/analysis/chart-overlays";
import { toNarrativeFacts } from "@/lib/analysis/narrative-facts";
import { buildLiveNarration, type LiveNarration } from "@/lib/analysis/live-narration";
import { CATALOG, ASSET_CLASS_PT, findAsset } from "@/lib/market/catalog";
import { LiveChart } from "@/components/live-chart";
import { TradingViewChart } from "@/components/tradingview-chart";
import { TechnicalSummary } from "@/components/technical-summary";
import { EnginePipeline } from "@/components/engine-pipeline";

type VoiceMode = "off" | "browser" | "premium";
const TFS: Timeframe[] = ["15m", "1h", "4h", "1d"];
const ANALYZE_MS = 30000;

const SIGNAL_PT: Record<string, string> = {
  STRONG_BUY: "COMPRA FORTE", BUY: "COMPRA", WEAK_BUY: "COMPRA FRACA",
  NEUTRAL: "NEUTRO", WEAK_SELL: "VENDA FRACA", SELL: "VENDA", STRONG_SELL: "VENDA FORTE",
};
const SEAL: Record<string, { label: string; color: string }> = {
  green: { label: "Selo verde", color: "var(--bull)" },
  yellow: { label: "Selo amarelo", color: "var(--amber)" },
  red: { label: "Selo vermelho", color: "var(--bear)" },
  grey: { label: "Amostra fraca", color: "var(--ink-faint)" },
};

function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}

export function LiveTrading() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [assetType, setAssetType] = useState<AssetType>("crypto");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [dto, setDto] = useState<FullAnalysis | null>(null);
  const [narration, setNarration] = useState<LiveNarration | null>(null);
  const [live, setLive] = useState(true);
  const [showInd, setShowInd] = useState(true);
  const [chartSrc, setChartSrc] = useState<"tv" | "ovt">("tv");
  const [voice, setVoice] = useState<VoiceMode>("browser");
  const [speaking, setSpeaking] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [ticker, setTicker] = useState<{ price: number; changePct: number } | null>(null);
  const [typed, setTyped] = useState("");

  const busyRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voiceMode = useRef<VoiceMode>(voice);
  voiceMode.current = voice;
  const pendingSpeech = useRef<string | null>(null);

  // Carrega vozes (pt-BR) — getVoices pode vir vazio até o evento.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      voiceRef.current = vs.find((v) => /pt[-_]?br/i.test(v.lang)) ?? vs.find((v) => /^pt/i.test(v.lang)) ?? null;
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);

  const doSpeak = useCallback(async (text: string) => {
    const mode = voiceMode.current;
    if (mode === "off" || !text) return;
    if (mode === "premium") {
      try {
        const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (r.ok) {
          const blob = await r.blob();
          audioRef.current?.pause();
          const audio = new Audio(URL.createObjectURL(blob));
          audioRef.current = audio;
          setSpeaking(true);
          audio.onended = () => setSpeaking(false);
          await audio.play();
          return;
        }
      } catch { /* cai pro navegador */ }
    }
    // Voz do navegador
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "pt-BR";
        u.rate = 1.05;
        if (voiceRef.current) u.voice = voiceRef.current;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } catch { setSpeaking(false); }
    }
  }, []);

  // Desbloqueio de áudio: 1º gesto do usuário libera a fala (política de autoplay).
  useEffect(() => {
    if (audioReady) return;
    const unlock = () => {
      setAudioReady(true);
      try {
        if (window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance(" ");
          u.volume = 0; window.speechSynthesis.speak(u);
        }
      } catch { /* ignore */ }
      if (pendingSpeech.current) { void doSpeak(pendingSpeech.current); pendingSpeech.current = null; }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [audioReady, doSpeak]);

  const speak = useCallback((text: string) => {
    if (voiceMode.current === "off") return;
    if (!audioReady) { pendingSpeech.current = text; return; } // espera o 1º gesto
    void doSpeak(text);
  }, [audioReady, doSpeak]);

  const runAnalysis = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, assetType, timeframe, type: "complete" }),
      });
      if (!r.ok) throw new Error();
      const data = (await r.json()) as FullAnalysis;
      setDto(data); setErr(false); setUpdatedAt(Date.now());
      const n = buildLiveNarration(toNarrativeFacts(data));
      setNarration(n);
      if (n.key !== lastKeyRef.current) { lastKeyRef.current = n.key; speak(n.speech); }
    } catch { setErr(true); } finally { setLoading(false); busyRef.current = false; }
  }, [symbol, assetType, timeframe, speak]);

  useEffect(() => {
    setLoading(true); setDto(null); setNarration(null); setTicker(null); lastKeyRef.current = null;
    void runAnalysis();
  }, [symbol, assetType, timeframe]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void runAnalysis(), ANALYZE_MS);
    return () => clearInterval(t);
  }, [live, runAnalysis]);

  // Efeito de digitação na leitura da IA.
  useEffect(() => {
    if (!narration) return;
    setTyped("");
    const full = narration.speech;
    let i = 0;
    const id = setInterval(() => { i += 3; setTyped(full.slice(0, i)); if (i >= full.length) clearInterval(id); }, 18);
    return () => clearInterval(id);
  }, [narration?.key]);

  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); audioRef.current?.pause(); }, []);

  const facts = dto ? toNarrativeFacts(dto) : null;
  const lines = dto ? buildPriceLines(dto) : [];
  const sealKey = dto?.quality?.status ?? "grey";
  const sealInfo = SEAL[sealKey] ?? SEAL.grey!;
  const sig = facts?.signal ?? "NEUTRAL";
  const side: "buy" | "sell" | "neutral" = sig.includes("BUY") ? "buy" : sig.includes("SELL") ? "sell" : "neutral";
  const sideColor = side === "buy" ? "var(--bull)" : side === "sell" ? "var(--bear)" : "var(--ink-soft)";
  const risk = dto?.analysis.risk;

  function onPickSymbol(sym: string) { const a = findAsset(sym); setSymbol(sym); if (a) setAssetType(a.assetType); }
  const grouped = (["crypto", "forex", "commodities", "indices", "stocks"] as AssetType[]).map((cls) => ({
    cls, label: ASSET_CLASS_PT[cls], items: CATALOG.filter((c) => c.assetType === cls),
  }));

  return (
    <div className="lt">
      {/* BARRA DE CONTROLE */}
      <div className="lt-bar">
        <div className="lt-asset">
          <select value={symbol} onChange={(e) => onPickSymbol(e.target.value)} className="lt-select">
            {grouped.map((g) => (
              <optgroup key={g.cls} label={g.label}>
                {g.items.map((it) => <option key={it.symbol} value={it.symbol}>{it.name} ({it.symbol})</option>)}
              </optgroup>
            ))}
          </select>
          <div className="lt-tfs">
            {TFS.map((tf) => (
              <button key={tf} type="button" className={`lt-tf${tf === timeframe ? " on" : ""}`} onClick={() => setTimeframe(tf)}>{tf.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {chartSrc === "ovt" ? (
          <div className="lt-ticker">
            <span className="lt-px" style={{ color: sideColor }}>{ticker ? fmtPrice(ticker.price) : "—"}</span>
            {ticker ? <span className={`lt-chg ${ticker.changePct >= 0 ? "up" : "down"}`}>{ticker.changePct >= 0 ? "▲" : "▼"} {Math.abs(ticker.changePct).toFixed(2)}%</span> : null}
          </div>
        ) : <div style={{ marginLeft: "auto" }} />}

        <div className="lt-actions">
          <div className="lt-tfs">
            <button type="button" className={`lt-tf${chartSrc === "tv" ? " on" : ""}`} onClick={() => setChartSrc("tv")} title="Gráfico TradingView com indicadores nativos">TradingView</button>
            <button type="button" className={`lt-tf${chartSrc === "ovt" ? " on" : ""}`} onClick={() => setChartSrc("ovt")} title="Nosso gráfico com liquidez, order blocks e plano desenhados">Overtrader · SMC</button>
          </div>
          {chartSrc === "ovt" ? <>
            <span className={`lt-live ${live ? "on" : ""}`}><span className="dot" />{live ? "AO VIVO" : "PAUSADO"}</span>
            <button type="button" className="lt-btn" onClick={() => setLive((v) => !v)}>{live ? "⏸" : "▶"}</button>
            <button type="button" className={`lt-btn wide${showInd ? " on" : ""}`} onClick={() => setShowInd((v) => !v)} title="Médias e Bollinger no gráfico">📈 Indicadores</button>
          </> : null}
          <select value={voice} onChange={(e) => setVoice(e.target.value as VoiceMode)} className="lt-select sm" title="Voz">
            <option value="off">🔇 Sem voz</option>
            <option value="browser">🔊 Voz grátis</option>
            <option value="premium">✨ Voz natural</option>
          </select>
        </div>
      </div>

      {voice !== "off" && !audioReady ? (
        <button type="button" className="lt-unlock" onClick={() => setAudioReady(true)}>🔊 Clique para ativar a narração por voz</button>
      ) : null}

      {/* GRID PRINCIPAL */}
      <div className="lt-grid">
        {/* CHART */}
        <div className="lt-chart">
          <div className="lt-chart-head">
            <span className="sym">{symbol}</span>
            <span className="tf">{timeframe.toUpperCase()}</span>
            <span className="src">{updatedAt ? `atualizado ${new Date(updatedAt).toLocaleTimeString("pt-BR")}` : "carregando…"}</span>
          </div>
          {chartSrc === "tv" ? (
            <TradingViewChart symbol={symbol} assetType={assetType} timeframe={timeframe} />
          ) : (
            <>
              {showInd ? (
                <div className="lt-legend">
                  <span><i style={{ background: "#54a8ff" }} />EMA 20</span>
                  <span><i style={{ background: "#ffb020" }} />EMA 50</span>
                  <span><i style={{ background: "#9aa7bd" }} />EMA 200</span>
                  <span><i style={{ background: "rgba(84,168,255,.5)" }} />Bollinger 20/2σ</span>
                </div>
              ) : null}
              <LiveChart symbol={symbol} assetType={assetType} timeframe={timeframe} lines={lines} onPrice={setTicker} showIndicators={showInd} />
            </>
          )}
          {/* PLANO OPERACIONAL */}
          {side !== "neutral" && risk ? (
            <div className="lt-plan">
              <div className="lt-plan-card entry"><span>Entrada</span><b>{fmtPrice(risk.entry)}</b></div>
              <div className="lt-plan-card stop"><span>Stop</span><b>{fmtPrice(risk.stopLoss)}</b></div>
              <div className="lt-plan-card tp"><span>Alvo 1</span><b>{fmtPrice(risk.takeProfit1)}</b></div>
              <div className="lt-plan-card tp"><span>Alvo 2</span><b>{fmtPrice(risk.takeProfit2)}</b></div>
              <div className="lt-plan-card tp"><span>Alvo 3</span><b>{fmtPrice(risk.takeProfit3)}</b></div>
              <div className="lt-plan-card rr"><span>R:R</span><b>{facts?.rr1 ?? "—"}</b></div>
            </div>
          ) : (
            <div className="lt-plan"><div className="lt-plan-card" style={{ flex: 1 }}><span>Plano</span><b>Sem operação — viés neutro, aguardar</b></div></div>
          )}
        </div>

        {/* PAINEL IA */}
        <aside className="lt-ai">
          <div className="lt-ai-head">
            <span className={`lt-orb ${speaking ? "speaking" : ""}`} style={{ background: sideColor }} />
            <div>
              <div className="lt-ai-name">Analista Overtrader <b>IA</b></div>
              <div className="lt-ai-sub">{speaking ? "🗣️ narrando…" : live ? "lendo o gráfico" : "pausado"}</div>
            </div>
            {speaking ? <div className="lt-wave"><span /><span /><span /><span /><span /></div> : null}
          </div>

          {loading && !facts ? <div className="lt-skel">Lendo o gráfico ao vivo…</div> : null}
          {err && !facts ? <div className="lt-skel err">Falha ao analisar — nova tentativa no próximo ciclo.</div> : null}

          {facts ? (
            <>
              <div className="lt-verdict" style={{ color: sideColor }}>{SIGNAL_PT[sig] ?? sig}</div>
              <div className="lt-seal" style={{ borderColor: sealInfo.color, color: sealInfo.color }}>
                <span className="d" style={{ background: sealInfo.color }} />{sealInfo.label}
              </div>

              <div className="lt-meter">
                <div className="lt-meter-l"><span>Força do sinal</span><b>{facts.strengthPct}%</b></div>
                <div className="lt-meter-bar"><i style={{ width: `${facts.strengthPct}%`, background: sideColor }} /></div>
              </div>

              <div className="lt-chips">
                {facts.backtest ? <>
                  <div className="lt-chip"><span>n (trades)</span><b className={facts.backtest.sufficient ? "" : "warn"}>{facts.backtest.decisiveTrades}{facts.backtest.sufficient ? "" : " ⚠"}</b></div>
                  <div className="lt-chip"><span>Profit factor</span><b>{facts.backtest.pf}</b></div>
                  <div className="lt-chip"><span>IC 95%</span><b>{facts.backtest.pfCi[0]}–{facts.backtest.pfCi[1]}</b></div>
                  <div className="lt-chip"><span>Acerto</span><b>{facts.backtest.winRatePct}%</b></div>
                </> : null}
                {facts.regime ? <div className="lt-chip"><span>Regime</span><b>{facts.regime}{facts.adx != null ? ` ${facts.adx}` : ""}</b></div> : null}
                <div className="lt-chip"><span>Confluência</span><b>{facts.confluence}</b></div>
              </div>

              <div className="lt-speech">
                <div className="lt-speech-k">Leitura da IA</div>
                <p>{typed}<span className="cursor">▍</span></p>
              </div>
            </>
          ) : null}
        </aside>
      </div>

      {/* ANÁLISE AO VIVO — pipeline + confirmações cruzadas + gates */}
      {dto ? <EnginePipeline dto={dto} /> : null}

      {/* RESUMO TÉCNICO — os 20 indicadores do motor, grounded */}
      {dto ? (
        <section className="lt-tech">
          <div className="lt-tech-h">Resumo Técnico · {dto.analysis.indicators.length} indicadores · {timeframe.toUpperCase()}</div>
          <TechnicalSummary indicators={dto.analysis.indicators} votes={dto.analysis.signal.votes} />
        </section>
      ) : null}
    </div>
  );
}
