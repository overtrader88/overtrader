/**
 * Widget Fear & Greed Index (Server Component).
 * Mostra valor atual + classificação + variação vs ontem + gauge visual.
 */
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchFearGreed,
  classificationPt,
  classificationColor,
} from "@/lib/market/fear-greed";

export async function FearGreedWidget() {
  let snapshot;
  try {
    snapshot = await fetchFearGreed();
  } catch {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div>
            <h3 className="text-sm font-semibold">Fear & Greed Index</h3>
            <p className="text-xs text-muted-foreground">
              Indicador temporariamente indisponível.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const { current, yesterday, delta, trend } = snapshot;
  const color = classificationColor(current.value);
  const label = classificationPt(current.classification);

  // SVG gauge — arc semicircular
  const angle = (current.value / 100) * 180; // 0 → 180°
  const radius = 50;
  // ponto na ponta do ponteiro
  const radians = ((180 - angle) * Math.PI) / 180;
  const cx = 70 + radius * Math.cos(radians);
  const cy = 70 - radius * Math.sin(radians);

  return (
    <Card className="p-4 sm:p-5 h-full">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Fear & Greed Index</h3>
          <p className="text-xs text-muted-foreground">Sentimento do mercado cripto</p>
        </div>
        {yesterday && (
          <Badge
            variant="ghost"
            className="text-[10px] flex items-center gap-1"
          >
            {trend === "up" && <TrendingUp className="h-3 w-3 text-success" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-destructive" />}
            {trend === "flat" && <Minus className="h-3 w-3" />}
            {delta > 0 ? "+" : ""}
            {delta} vs ontem
          </Badge>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 mt-2">
        {/* Semicircular gauge */}
        <svg viewBox="0 0 140 80" className="w-full max-w-[200px]">
          {/* arc bg */}
          <path
            d="M 20 70 A 50 50 0 0 1 120 70"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* arc colorido proporcional ao valor */}
          <path
            d="M 20 70 A 50 50 0 0 1 120 70"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(current.value / 100) * 157} 157`}
          />
          {/* ponto no ponteiro */}
          <circle cx={cx} cy={cy} r={6} fill={color} />
          {/* texto centro */}
          <text
            x="70"
            y="60"
            textAnchor="middle"
            fontSize="24"
            fontWeight="bold"
            fill={color}
            fontFamily="Inter"
          >
            {current.value}
          </text>
        </svg>

        <div className="text-center">
          <div className="text-base sm:text-lg font-bold" style={{ color }}>
            {label}
          </div>
          {yesterday && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ontem: {yesterday.value} · {classificationPt(yesterday.classification)}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
