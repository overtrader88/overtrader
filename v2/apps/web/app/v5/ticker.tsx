/**
 * Ticker tape — fita de cotações do topo. Mock realista ESTÁTICO (zero request,
 * zero JS): a lista é duplicada e o loop é um translateX(-50%) infinito em CSS.
 * Pausa no hover; estática em prefers-reduced-motion.
 */
import s from "./page.module.css";

const TICKS: { sym: string; px: string; chg: string; up: boolean }[] = [
  { sym: "BTCUSDT", px: "67.412", chg: "+2,41%", up: true },
  { sym: "ETHUSDT", px: "3.512", chg: "+1,12%", up: true },
  { sym: "SOLUSDT", px: "142,80", chg: "−0,86%", up: false },
  { sym: "EURUSD", px: "1,0843", chg: "+0,12%", up: true },
  { sym: "GBPUSD", px: "1,2691", chg: "−0,05%", up: false },
  { sym: "USDJPY", px: "157,21", chg: "+0,33%", up: true },
  { sym: "XAUUSD", px: "2.412", chg: "+0,58%", up: true },
  { sym: "SPX", px: "5.310", chg: "+0,21%", up: true },
  { sym: "NDX", px: "18.660", chg: "−0,14%", up: false },
  { sym: "DJI", px: "39.880", chg: "+0,09%", up: true },
  { sym: "ADAUSDT", px: "0,4512", chg: "+3,02%", up: true },
  { sym: "DOGEUSDT", px: "0,1582", chg: "−1,24%", up: false },
];

export function Ticker() {
  return (
    <div className={s.tape} aria-hidden>
      <div className={s.tapeRow}>
        {[...TICKS, ...TICKS].map((t, i) => (
          <span className={s.tk} key={i}>
            <b>{t.sym}</b>
            <span className={s.tkPx}>{t.px}</span>
            <span className={t.up ? s.tkUp : s.tkDn}>{t.chg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
