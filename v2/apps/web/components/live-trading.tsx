"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { FullAnalysis } from "@/lib/analysis/full";
import { buildPriceLines, buildWyckoffOverlays } from "@/lib/analysis/chart-overlays";
import { buildChartZones } from "@/lib/analysis/chart-zones";
import { toNarrativeFacts } from "@/lib/analysis/narrative-facts";
import { buildLiveNarration, type LiveNarration } from "@/lib/analysis/live-narration";
import { computeSetupScore } from "@/lib/analysis/setup-score";
import { computeLiveTrade } from "@/lib/analysis/live-trade";
import { stepPaperTrading, paperStats, livePnl, EMPTY_PAPER_STATE, type PaperState } from "@/lib/analysis/paper-trading";
import { enablePush, disablePush, pushSupported, notifyReinforced } from "@/lib/push/client";
import { CATALOG, ASSET_CLASS_PT, findAsset } from "@/lib/market/catalog";
import { LiveChart } from "@/components/live-chart";
import { TradingViewChart } from "@/components/tradingview-chart";
import { ChartLegend } from "@/components/chart-legend";
import { TechnicalSummary } from "@/components/technical-summary";
import { EnginePipeline } from "@/components/engine-pipeline";
import { WyckoffTimeline } from "@/components/wyckoff-timeline";

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

  // Paper-trading com histórico — persistido por navegador (localStorage).
  const PAPER_KEY = "ovt.paper.v1";
  const [paper, setPaper] = useState<PaperState>(EMPTY_PAPER_STATE);
  const paperLoaded = useRef(false);
  useEffect(() => {
    if (paperLoaded.current || typeof window === "undefined") return;
    paperLoaded.current = true;
    try {
      const raw = window.localStorage.getItem(PAPER_KEY);
      if (raw) setPaper(JSON.parse(raw) as PaperState);
    } catch { /* ignora histórico corrompido */ }
  }, []);

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

  // Alertas (web push) de confluência reforçada
  const [pushReady, setPushReady] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);
  const lastReinforcedRef = useRef<string | null>(null);
  useEffect(() => { setPushReady(pushSupported()); }, []);
  const toggleAlerts = useCallback(async () => {
    if (alertsOn) { await disablePush(); setAlertsOn(false); return; }
    const st = await enablePush();
    if (st === "ok") setAlertsOn(true);
    else if (typeof window !== "undefined") {
      const msg = st === "denied" ? "Permissão de notificação negada pelo navegador."
        : st === "no_vapid" ? "Push ainda não configurado no servidor (chave VAPID ausente)."
        : st === "unsupported" ? "Este navegador não suporta notificações push."
        : "Não foi possível ativar os alertas agora.";
      window.alert(msg);
    }
  }, [alertsOn]);

  // Dispara alerta quando uma confluência REFORÇADA nova aparece (dedupe por chave).
  const reinforced = facts?.crossConfluence?.reinforced ?? false;
  const confSide = facts?.signal?.includes("BUY") ? "buy" : facts?.signal?.includes("SELL") ? "sell" : "neutral";
  useEffect(() => {
    if (!alertsOn || !reinforced || !facts?.crossConfluence) return;
    const key = `${symbol}|${timeframe}|${confSide}`;
    if (lastReinforcedRef.current === key) return;
    lastReinforcedRef.current = key;
    void notifyReinforced({ symbol, timeframe, side: confSide, verdict: facts.crossConfluence.verdict });
  }, [alertsOn, reinforced, symbol, timeframe, confSide, facts?.crossConfluence?.verdict]);

  const wyOverlays = dto ? buildWyckoffOverlays(dto) : { lines: [], zones: [] };
  const lines = dto ? [...buildPriceLines(dto), ...wyOverlays.lines] : [];
  const zones = dto ? [...buildChartZones(dto), ...wyOverlays.zones] : [];
  const setup = dto ? computeSetupScore(dto) : null;
  const trade = dto ? computeLiveTrade(dto, ticker?.price ?? null) : null;

  // Avança o paper-trading a cada tick/setup e persiste no localStorage.
  const livePrice = ticker?.price ?? dto?.montecarlo?.currentPrice ?? null;
  useEffect(() => {
    if (!paperLoaded.current || !dto || livePrice == null || !Number.isFinite(livePrice)) return;
    setPaper((prev) => {
      const next = stepPaperTrading(prev, {
        setup: trade ? { side: trade.side, entry: trade.entry, stop: trade.stop, tp1: trade.tp1 } : null,
        price: livePrice, now: Date.now(), symbol, timeframe,
      });
      if (next !== prev && typeof window !== "undefined") {
        try { window.localStorage.setItem(PAPER_KEY, JSON.stringify(next)); } catch { /* quota */ }
      }
      return next;
    });
    // depende do preço ao vivo e da assinatura do setup
  }, [livePrice, trade?.side, trade?.entry, trade?.stop, trade?.tp1, symbol, timeframe, dto]);

  // Filtro do histórico por ativo / timeframe (opções derivadas do próprio histórico)
  const [fltSym, setFltSym] = useState("all");
  const [fltTf, setFltTf] = useState("all");
  const histSyms = [...new Set(paper.history.map((t) => t.symbol))].sort();
  const histTfs = [...new Set(paper.history.map((t) => t.timeframe))];
  const filteredHistory = paper.history.filter((t) =>
    (fltSym === "all" || t.symbol === fltSym) && (fltTf === "all" || t.timeframe === fltTf),
  );
  const pStats = paperStats(filteredHistory);
  const recentPaper = [...filteredHistory].reverse().slice(0, 8);
  const clearPaper = () => {
    setPaper(EMPTY_PAPER_STATE);
    setFltSym("all"); setFltTf("all");
    if (typeof window !== "undefined") { try { window.localStorage.removeItem(PAPER_KEY); } catch { /* */ } }
  };


  const setupColor = setup ? (setup.tone === "bull" ? "var(--bull)" : setup.tone === "bear" ? "var(--bear)" : "var(--ink-soft)") : "var(--ink-soft)";
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
      {/* HEADER LIVE-STREAM */}
      <div className="lt-livehead">
        <span className="lt-livedot" /> AO VIVO
        <span className="lt-livesep" /> <b>{symbol}</b> · {timeframe.toUpperCase()}
        <span className="lt-livesep" /> tempo real {assetType === "crypto" ? "(WebSocket)" : ""}
        {trade ? <><span className="lt-livesep" /> <span className={`lt-livepnl ${trade.pnlPct >= 0 ? "up" : "down"}`}>{trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(2)}% · {trade.r >= 0 ? "+" : ""}{trade.r.toFixed(2)}R</span></> : null}
      </div>

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
          {pushReady ? (
            <button type="button" className={`lt-btn wide${alertsOn ? " on" : ""}`} onClick={toggleAlerts} title="Notificação no navegador quando uma confluência reforçada aparecer">
              {alertsOn ? "🔔 Alertas ON" : "🔕 Alertas"}
            </button>
          ) : null}
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
              <LiveChart symbol={symbol} assetType={assetType} timeframe={timeframe} lines={lines} onPrice={setTicker} showIndicators={showInd} markers={dto?.wyckoffEvents ?? []} zones={zones} volumeProfile={dto?.volumeProfile ?? null} />
              <ChartLegend />
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

              {facts.crossConfluence ? (
                <div className={`lt-cross ${facts.crossConfluence.reinforced ? "on" : facts.crossConfluence.againstCount > facts.crossConfluence.agreeCount ? "warn" : ""}`}>
                  <span className="lt-cross-k">{facts.crossConfluence.reinforced ? "⚡ Confirmações cruzadas" : "Confirmações cruzadas"}</span>
                  <span className="lt-cross-v">{facts.crossConfluence.verdict}</span>
                  <span className="lt-cross-n">{facts.crossConfluence.agreeCount} a favor · {facts.crossConfluence.againstCount} contra</span>
                </div>
              ) : null}

              {setup ? (
                <div className="lt-setup">
                  <div className="lt-setup-top"><span>Confiança do setup</span><b style={{ color: setupColor }}>{setup.score}%</b></div>
                  <div className="lt-meter-bar"><i style={{ width: `${setup.score}%`, background: setupColor }} /></div>
                  <div className="lt-setup-lbl" style={{ color: setupColor }}>{setup.label}</div>
                  <div className="lt-setup-cols">
                    <div>
                      <span className="lt-setup-k ok">A favor ({setup.agree.length})</span>
                      {setup.agree.map((x, i) => <span key={i} className="lt-setup-it ok">✓ {x}</span>)}
                      {setup.agree.length === 0 ? <span className="lt-setup-it dim">—</span> : null}
                    </div>
                    <div>
                      <span className="lt-setup-k no">Contra ({setup.against.length})</span>
                      {setup.against.map((x, i) => <span key={i} className="lt-setup-it no">✕ {x}</span>)}
                      {setup.against.length === 0 ? <span className="lt-setup-it dim">—</span> : null}
                    </div>
                  </div>
                </div>
              ) : null}

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

      {/* SÉRIE HISTÓRICA DE EVENTOS WYCKOFF */}
      {dto ? <WyckoffTimeline dto={dto} /> : null}

      {/* RESUMO TÉCNICO — os 20 indicadores do motor, grounded */}
      {dto ? (
        <section className="lt-tech">
          <div className="lt-tech-h">Resumo Técnico · {dto.analysis.indicators.length} indicadores · {timeframe.toUpperCase()}</div>
          <TechnicalSummary indicators={dto.analysis.indicators} votes={dto.analysis.signal.votes} />
        </section>
      ) : null}

      {/* OPERAÇÃO AO VIVO (simulada) — estilo Open Trades */}
      {dto ? (
        <section className="lt-trades">
          <div className="lt-trades-h">Operação ao vivo <span>· simulada</span></div>
          {trade ? (
            <div className="lt-trades-tbl">
              <table>
                <thead><tr><th>Ativo</th><th>Lado</th><th>Entrada</th><th>Atual</th><th>Stop</th><th>Alvo 1</th><th>P&L</th><th>R</th><th>Status</th></tr></thead>
                <tbody>
                  <tr>
                    <td><b>{symbol}</b> {timeframe.toUpperCase()}</td>
                    <td><span className={`lt-side ${trade.side}`}>{trade.side === "buy" ? "COMPRA" : "VENDA"}</span></td>
                    <td>{fmtPrice(trade.entry)}</td>
                    <td>{fmtPrice(trade.price)}</td>
                    <td className="bear">{fmtPrice(trade.stop)}</td>
                    <td className="bull">{fmtPrice(trade.tp1)}</td>
                    <td className={trade.pnlPct >= 0 ? "bull" : "bear"}>{trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(2)}%</td>
                    <td className={trade.r >= 0 ? "bull" : "bear"}>{trade.r >= 0 ? "+" : ""}{trade.r.toFixed(2)}R</td>
                    <td><span className={`lt-status ${trade.status === "Stopada" ? "no" : trade.status === "Alvo 1" ? "ok" : "open"}`}>{trade.status}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note" style={{ padding: "8px 2px" }}>Sem operação — viés neutro. A IA aguarda definição.</p>
          )}
          <p className="note" style={{ fontSize: "0.72rem", marginTop: 6 }}>Simulação do setup vigente (atualiza com o preço ao vivo). Não é ordem real nem recomendação de investimento.</p>
        </section>
      ) : null}

      {/* HISTÓRICO — PAPER TRADING (persistido neste navegador) */}
      {dto ? (
        <section className="lt-trades lt-paper">
          <div className="lt-trades-h">
            Histórico <span>· paper trading</span>
            {paper.history.length > 0 ? (
              <div className="lt-paper-flt">
                <select value={fltSym} onChange={(e) => setFltSym(e.target.value)} aria-label="Filtrar por ativo">
                  <option value="all">Todos os ativos</option>
                  {histSyms.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={fltTf} onChange={(e) => setFltTf(e.target.value)} aria-label="Filtrar por timeframe">
                  <option value="all">Todos os TFs</option>
                  {histTfs.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
                <button type="button" className="lt-paper-clear" onClick={clearPaper}>limpar</button>
              </div>
            ) : null}
          </div>
          <div className="lt-paper-stats">
            <div className="lt-pstat"><span>Fechados</span><b>{pStats.closed}</b></div>
            <div className="lt-pstat"><span>Acertos</span><b className={pStats.winRate >= 50 ? "bull" : ""}>{pStats.closed ? `${pStats.winRate.toFixed(0)}%` : "—"}</b></div>
            <div className="lt-pstat"><span>G / P</span><b>{pStats.wins} / {pStats.losses}</b></div>
            <div className="lt-pstat"><span>R total</span><b className={pStats.totalR >= 0 ? "bull" : "bear"}>{pStats.totalR >= 0 ? "+" : ""}{pStats.totalR.toFixed(2)}R</b></div>
            <div className="lt-pstat"><span>R médio</span><b className={pStats.avgR >= 0 ? "bull" : "bear"}>{pStats.avgR >= 0 ? "+" : ""}{pStats.avgR.toFixed(2)}R</b></div>
          </div>
          {paper.open ? (() => { const lp = livePnl(paper.open!, livePrice ?? paper.open!.entry); return (
            <div className="lt-paper-open">
              <span className={`lt-side ${paper.open.side}`}>{paper.open.side === "buy" ? "COMPRA" : "VENDA"}</span>
              <span className="lt-po-sym"><b>{paper.open.symbol}</b> {paper.open.timeframe.toUpperCase()}</span>
              <span>entrada {fmtPrice(paper.open.entry)}</span>
              <span className={lp.pnlPct >= 0 ? "bull" : "bear"}>{lp.pnlPct >= 0 ? "+" : ""}{lp.pnlPct.toFixed(2)}% · {lp.r >= 0 ? "+" : ""}{lp.r.toFixed(2)}R</span>
              <span className="lt-status open">aberta</span>
            </div>
          ); })() : null}
          {recentPaper.length > 0 ? (
            <div className="lt-trades-tbl">
              <table>
                <thead><tr><th>Ativo</th><th>Lado</th><th>Entrada</th><th>Saída</th><th>P&L</th><th>R</th><th>Resultado</th></tr></thead>
                <tbody>
                  {recentPaper.map((t) => (
                    <tr key={t.id}>
                      <td><b>{t.symbol}</b> {t.timeframe.toUpperCase()}</td>
                      <td><span className={`lt-side ${t.side}`}>{t.side === "buy" ? "COMPRA" : "VENDA"}</span></td>
                      <td>{fmtPrice(t.entry)}</td>
                      <td>{fmtPrice(t.exit ?? NaN)}</td>
                      <td className={(t.pnlPct ?? 0) >= 0 ? "bull" : "bear"}>{(t.pnlPct ?? 0) >= 0 ? "+" : ""}{(t.pnlPct ?? 0).toFixed(2)}%</td>
                      <td className={(t.r ?? 0) >= 0 ? "bull" : "bear"}>{(t.r ?? 0) >= 0 ? "+" : ""}{(t.r ?? 0).toFixed(2)}R</td>
                      <td><span className={`lt-status ${t.status === "stop" ? "no" : t.status === "tp1" ? "ok" : "open"}`}>{t.status === "tp1" ? "Alvo 1" : t.status === "stop" ? "Stop" : "Cancelada"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note" style={{ padding: "8px 2px" }}>
              {paper.history.length > 0
                ? "Nenhum trade fechado para este filtro."
                : "Nenhum trade fechado ainda. Deixe o modo ao vivo rodando — a IA abre e fecha operações de papel conforme os setups e os alvos/stops vão batendo."}
            </p>
          )}
          <p className="note" style={{ fontSize: "0.72rem", marginTop: 6 }}>Histórico salvo só neste navegador. Paper trading (simulado) — não é ordem real nem recomendação de investimento.</p>
        </section>
      ) : null}
    </div>
  );
}
