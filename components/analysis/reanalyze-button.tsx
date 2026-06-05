"use client";

/**
 * Botão "Refazer análise" — re-roda a engine no mesmo ativo/timeframe,
 * consumindo novo crédito e redirecionando pro ID novo.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  symbol: string;
  timeframe: string;
  analysisType: "simple" | "complete";
}

export function ReanalyzeButton({ symbol, timeframe, analysisType }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  const cost = analysisType === "simple" ? "1 Simples" : "1 PRO";

  async function reanalyze() {
    setRunning(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe, type: analysisType }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        if (res.status === 402) {
          toast.error("Créditos insuficientes.", { description: data?.error });
        } else {
          toast.error("Falha ao refazer.", { description: data?.error });
        }
        return;
      }
      toast.success("Análise atualizada!");
      router.push(`/dashboard/analise/${data.id}`);
      router.refresh();
    } catch (err) {
      toast.error("Erro inesperado.", {
        description: err instanceof Error ? err.message : "Verifique sua conexão.",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={reanalyze}
      disabled={running}
      title={`Refazer análise (consome ${cost})`}
    >
      {running ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Refazendo...
        </>
      ) : (
        <>
          <RefreshCw className="h-3 w-3" />
          Refazer ({cost})
        </>
      )}
    </Button>
  );
}
