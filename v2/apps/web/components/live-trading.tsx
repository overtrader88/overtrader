"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { FullAnalysis } from "@/lib/analysis/full";
import { buildPriceLines } from "@/lib/analysis/chart-overlays";
import { toNarrativeFacts } from "@/lib/analysis/narrative-facts";
import { buildLiveNarration, type LiveNarration } from "@/lib/analysis/live-narration";
import { CATALOG, ASSET_CLASS_PT, findAsset } from "@/lib/market/catalog";
import { LiveChart } from "@/components/live-chart";

type VoiceMode = "off" | "browser" | "premium";
const TFS: Timeframe[] = ["15m", "1h", "4h", "1d"];
const ANALYZE_MS = 30000;

const SEAL_COLOR: Record<string, string> = { green: "#2bd49e", yellow: "#ffb020", red: "#ff6b8a", grey: "#93a0b6" };

export function LiveTrading() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [assetType, setAssetType] = useState<AssetType>("crypto");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [dto, setDto] = useState<FullAnalysis | null>(null);
  const [narration, setNarration] = useState<LiveNarration | null>(null);
  const [live, setLive] = useState(true);
  const [voice, setVoice] = useState<VoiceMode>("off");
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const busyRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, mode: VoiceMode) => {
    if (mode === "off") return;
    try {
      if (mode === "premium") {
        const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (r.ok) {
          const blob = await r.blob();
          if (audioRef.current) { audioRef.current.pause(); }
          const audio = new Audio(URL.createObjectURL(blob));
          audioRef.current = audio;
          setSpeaking(true);
          audio.onended = () => setSpeaking(false);
          await audio.play();
          return;
        }
        // 503/falha → cai pra voz do navegador
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "pt-BR";
        u.rate = 1.05;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      }
    } catch { setSpeaking(false); }
  }, []);

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
      setDto(data);
      setErr(false);
      setUpdatedAt(Date.now());
      const n = buildLiveNarration(toNarrativeFacts(data));
      setNarration(n);
      if (n.key !== lastKeyRef.current) {
        lastKeyRef.current = n.key;
        void speak(n.speech, voice);
      }
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [symbol, assetType, timeframe, voice, speak]);

  // Reset ao trocar ativo/TF + primeira análise.
  useEffect(() => {
    setLoading(true); setDto(null); setNarration(null); lastKeyRef.current = null;
    void runAnalysis();
  }, [symbol, assetType, timeframe]);

  // Loop ao vivo.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void runAnalysis(), ANALYZE_MS);
    return () => clearInterval(t);
  }, [live, runAnalysis]);

  // Para a voz ao desmontar.
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); audioRef.current?.pause(); }, []);

  const lines = dto ? buildPriceLines(dto) : [];
  const seal = dto?.quality?.status ?? "grey";
  const sealColor = SEAL_COLOR[seal] ?? "#93a0b6";

  function onPickSymbol(sym: string) {
    const a = findAsset(sym);
    setSymbol(sym);
    if (a) setAssetType(a.assetType);
  }

  // Catálogo agrupado por classe p/ o <select>.
  const grouped = (["crypto", "forex", "commodities", "indices", "stocks"] as AssetType[]).map((cls) => ({
    cls, label: ASSET_CLASS_PT[cls], items: CATALOG.filter((c) => c.assetType === cls),
  }));

  return (
    <div className="live-wrap">
      {/* Controles */}
      <div className="live-controls" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <select value={symbol} onChange={(e) => onPickSymbol(e.target.value)} style={selStyle}>
          {grouped.map((g) => (
            <optgroup key={g.cls} label={g.label}>
              {g.items.map((it) => <option key={it.symbol} value={it.symbol}>{it.name} ({it.symbol})</option>)}
            </optgroup>
          ))}
        </select>
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)} style={selStyle}>
          {TFS.map((tf) => <option key={tf} value={tf}>{tf.toUpperCase()}</option>)}
        </select>
        <button type="button" onClick={() => setLive((v) => !v)} style={btnStyle(live)}>
          {live ? "⏸ Pausar" : "▶ Ao vivo"}
        </button>
        <select value={voice} onChange={(e) => setVoice(e.target.value as VoiceMode)} style={selStyle} title="Voz da narração">
          <option value="off">🔇 Voz off</option>
          <option value="browser">🔊 Voz (navegador, grátis)</option>
          <option value="premium">✨ Voz natural (premium)</option>
        </select>
        <span className="note" style={{ fontSize: "0.78rem", marginLeft: "auto" }}>
          {live ? <span style={{ color: "#2bd49e" }}>● AO VIVO</span> : "pausado"}
          {updatedAt ? ` · atualizado ${new Date(updatedAt).toLocaleTimeString("pt-BR")}` : ""}
        </span>
      </div>

      <div className="live-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(280px,1fr)", gap: 16 }}>
        {/* Gráfico ao vivo */}
        <div className="tbl" style={{ padding: 12 }}>
          <LiveChart symbol={symbol} assetType={assetType} timeframe={timeframe} lines={lines} />
          <p className="note" style={{ marginTop: 8, fontSize: "0.75rem" }}>
            Entrada / Stop / Alvos e zonas (OB/FVG/PRZ) projetados como níveis. Janela recente · contexto, não recomendação.
          </p>
        </div>

        {/* Painel da IA */}
        <div className="tbl" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: sealColor, boxShadow: speaking ? `0 0 0 4px ${sealColor}33` : "none" }} />
            <strong style={{ fontSize: "0.95rem" }}>{narration?.headline ?? "Analisando…"}</strong>
          </div>

          {speaking ? <span className="note" style={{ fontSize: "0.75rem", color: "#54a8ff" }}>🗣️ narrando…</span> : null}

          {loading && !narration ? <p className="note">Lendo o gráfico…</p> : null}
          {err && !narration ? <p className="note">Falha ao analisar agora — tentando de novo no próximo ciclo.</p> : null}

          {narration ? (
            <>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {narration.bullets.map((b, i) => (
                  <li key={i} style={{ fontSize: "0.85rem", lineHeight: 1.4, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: sealColor }}>›</span>{b}
                  </li>
                ))}
              </ul>
              <div style={{ borderTop: "1px solid var(--border-faint,#e4e8ef)", paddingTop: 10 }}>
                <div className="note" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Leitura da IA</div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: 0, color: "var(--ink-soft,#3a4458)" }}>{narration.speech}</p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border,#cbd5e1)", background: "var(--bg-elev,#fff)", fontSize: "0.85rem" };
function btnStyle(active: boolean): React.CSSProperties {
  return { padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border,#cbd5e1)", background: active ? "#ff6b8a22" : "#2bd49e22", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" };
}
