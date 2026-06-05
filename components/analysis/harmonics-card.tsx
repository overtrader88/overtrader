"use client";

/**
 * Card de Padroes Harmonicos — Bat, Butterfly, Gartley, Crab, Cypher, Shark.
 * Mostra cada padrao com completion %, PRZ (Potential Reversal Zone) e qualidade.
 */

import { Hexagon, TrendingUp, TrendingDown, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface PatternLike {
  name: "Bat" | "Butterfly" | "Gartley" | "Crab" | "Cypher" | "Shark";
  direction: "bullish" | "bearish";
  X: { index: number; price: number };
  A: { index: number; price: number };
  B: { index: number; price: number };
  C: { index: number; price: number };
  prz: { low: number; high: number };
  completion: number;
  quality: number;
  status: "active" | "completed";
}

interface HarmonicsLike {
  patterns: PatternLike[];
  summary: string;
}

interface Props {
  harmonics?: HarmonicsLike | null;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const decimals = n < 1 ? 5 : n < 100 ? 3 : 2;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function HarmonicsCard({ harmonics }: Props) {
  if (!harmonics || harmonics.patterns.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Hexagon className="h-4 w-4 text-primary" />
          Padrões Harmônicos
        </h4>
        <span className="text-[11px] text-muted-foreground">
          {harmonics.patterns.length} detectado{harmonics.patterns.length > 1 ? "s" : ""}
        </span>
      </div>

      <ul className="space-y-2">
        {harmonics.patterns.map((p, i) => (
          <PatternRow key={i} pattern={p} />
        ))}
      </ul>

      <p className="text-[10px] text-muted-foreground italic mt-3 leading-relaxed">
        Padrões XABCD baseados em proporções de Fibonacci. PRZ (Potential
        Reversal Zone) é a área onde D deveria completar — preço entrando na
        zona = sinal de possível reversão.
      </p>
    </Card>
  );
}

function PatternRow({ pattern }: { pattern: PatternLike }) {
  const isBullish = pattern.direction === "bullish";
  const Icon = isBullish ? TrendingUp : TrendingDown;
  const isCompleted = pattern.status === "completed";

  return (
    <li
      className={cn(
        "rounded-md border p-3",
        isCompleted
          ? isBullish
            ? "border-success/40 bg-success/10 ring-1 ring-success/20"
            : "border-destructive/40 bg-destructive/10 ring-1 ring-destructive/20"
          : isBullish
            ? "border-success/30 bg-success/5"
            : "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon
            className={cn(
              "h-4 w-4",
              isBullish ? "text-success" : "text-destructive"
            )}
          />
          <span
            className={cn(
              "text-sm font-bold",
              isBullish ? "text-success" : "text-destructive"
            )}
          >
            {pattern.name} {isBullish ? "Alta" : "Baixa"}
          </span>
          {isCompleted ? (
            <Badge
              variant={isBullish ? "success" : "destructive"}
              className="text-[9px]"
            >
              <CheckCircle2 className="h-2.5 w-2.5" /> Completo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px]">
              <Clock className="h-2.5 w-2.5" /> {pattern.completion}% formado
            </Badge>
          )}
          <Badge variant="outline" className="text-[9px] text-muted-foreground">
            Qualidade {pattern.quality}%
          </Badge>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-muted-foreground">Zona de Reversão (PRZ):</span>
          <div className="font-mono tabular-nums font-semibold mt-0.5">
            {formatPrice(pattern.prz.low)} — {formatPrice(pattern.prz.high)}
          </div>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground">Pontos XABCD:</span>
          <div className="font-mono tabular-nums text-[10px] mt-0.5 text-muted-foreground">
            X {formatPrice(pattern.X.price)} → A {formatPrice(pattern.A.price)}
          </div>
          <div className="font-mono tabular-nums text-[10px] text-muted-foreground">
            B {formatPrice(pattern.B.price)} → C {formatPrice(pattern.C.price)}
          </div>
        </div>
      </div>

      {/* Progress bar de completion */}
      <div className="mt-3 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all rounded-full",
            isBullish ? "bg-success" : "bg-destructive"
          )}
          style={{ width: `${pattern.completion}%` }}
        />
      </div>
    </li>
  );
}
