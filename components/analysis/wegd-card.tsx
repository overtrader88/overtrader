"use client";

/**
 * Card de WEGD — Wyckoff, Elliott, Gann, Dow Theory.
 * 4 metodologias classicas mostradas em mini-cards com probabilidade.
 */

import {
  Layers,
  Waves,
  Compass,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface WegdLike {
  wyckoff: {
    phase: "accumulation" | "markup" | "distribution" | "markdown" | "transition";
    confidence: number;
    description: string;
  };
  elliott: {
    currentWave: string;
    probability: number;
    type: "impulsive" | "corrective" | "unknown";
    description: string;
  };
  gann: {
    angle1x1: number;
    positionVs1x1: "above" | "below" | "on";
    levels: { angle: string; price: number }[];
    description: string;
  };
  dow: {
    primaryTrend: "primary_uptrend" | "primary_downtrend" | "sideways";
    confirmed: boolean;
    description: string;
  };
  summary: string;
}

interface Props {
  wegd?: WegdLike | null;
}

const WYCKOFF_LABEL: Record<WegdLike["wyckoff"]["phase"], { label: string; tone: "success" | "destructive" | "warning" | "muted" }> = {
  accumulation: { label: "Acumulação", tone: "success" },
  markup: { label: "Markup (alta)", tone: "success" },
  distribution: { label: "Distribuição", tone: "destructive" },
  markdown: { label: "Markdown (baixa)", tone: "destructive" },
  transition: { label: "Transição", tone: "muted" },
};

const ELLIOTT_LABEL: Record<string, string> = {
  wave_1: "Onda 1",
  wave_2: "Onda 2",
  wave_3: "Onda 3 (mais forte)",
  wave_4: "Onda 4",
  wave_5: "Onda 5 (exaustão)",
  wave_a: "Onda A (corretiva)",
  wave_b: "Onda B (corretiva)",
  wave_c: "Onda C (corretiva)",
  indefinido: "Indefinido",
};

const DOW_LABEL: Record<WegdLike["dow"]["primaryTrend"], { label: string; tone: "success" | "destructive" | "muted" }> = {
  primary_uptrend: { label: "Alta primária", tone: "success" },
  primary_downtrend: { label: "Baixa primária", tone: "destructive" },
  sideways: { label: "Lateral", tone: "muted" },
};

function toneClass(tone: "success" | "destructive" | "warning" | "muted") {
  return tone === "success"
    ? "text-success border-success/40 bg-success/5"
    : tone === "destructive"
      ? "text-destructive border-destructive/40 bg-destructive/5"
      : tone === "warning"
        ? "text-warning border-warning/40 bg-warning/5"
        : "text-muted-foreground border-border/40 bg-card/40";
}

export function WegdCard({ wegd }: Props) {
  if (!wegd) return null;

  const wyckoffMeta = WYCKOFF_LABEL[wegd.wyckoff.phase];
  const dowMeta = DOW_LABEL[wegd.dow.primaryTrend];
  const gannPos =
    wegd.gann.positionVs1x1 === "above"
      ? { label: "Acima do 1x1", tone: "success" as const }
      : wegd.gann.positionVs1x1 === "below"
        ? { label: "Abaixo do 1x1", tone: "destructive" as const }
        : { label: "Sobre o 1x1", tone: "muted" as const };

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          WEGD — Análise Clássica
        </h4>
        <span className="text-[11px] text-muted-foreground">
          Wyckoff · Elliott · Gann · Dow
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Wyckoff */}
        <MethodCard
          icon={Layers}
          name="Wyckoff"
          tone={wyckoffMeta.tone === "warning" ? "muted" : wyckoffMeta.tone}
          headline={wyckoffMeta.label}
          subline={`${wegd.wyckoff.confidence}% confiança`}
          description={wegd.wyckoff.description}
        />

        {/* Elliott */}
        <MethodCard
          icon={Waves}
          name="Elliott"
          tone={wegd.elliott.type === "impulsive" ? "success" : wegd.elliott.type === "corrective" ? "destructive" : "muted"}
          headline={ELLIOTT_LABEL[wegd.elliott.currentWave] ?? "—"}
          subline={`${wegd.elliott.probability}% provável`}
          description={wegd.elliott.description}
        />

        {/* Gann */}
        <MethodCard
          icon={Compass}
          name="Gann"
          tone={gannPos.tone}
          headline={gannPos.label}
          subline={`1x1 = ${wegd.gann.angle1x1.toFixed(2)}`}
          description={wegd.gann.description}
        />

        {/* Dow Theory */}
        <MethodCard
          icon={TrendingUp}
          name="Dow"
          tone={dowMeta.tone}
          headline={dowMeta.label}
          subline={wegd.dow.confirmed ? "CONFIRMADA" : "Provável"}
          description={wegd.dow.description}
        />
      </div>

      <p className="text-[10px] text-muted-foreground italic mt-3 leading-relaxed">
        Análises clássicas com tratamento <strong>probabilístico</strong>. Diferente
        de plataformas que afirmam, mostramos a confiança real do padrão detectado.
      </p>
    </Card>
  );
}

function MethodCard({
  icon: Icon,
  name,
  tone,
  headline,
  subline,
  description,
}: {
  icon: typeof Compass;
  name: string;
  tone: "success" | "destructive" | "muted" | "warning";
  headline: string;
  subline: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        toneClass(tone)
      )}
      title={description}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 opacity-70" />
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
          {name}
        </span>
      </div>
      <div className="text-sm font-bold">{headline}</div>
      <div className="text-[10px] opacity-70 mt-0.5">{subline}</div>
    </div>
  );
}
