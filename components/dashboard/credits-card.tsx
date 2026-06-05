import Link from "next/link";
import { Sparkles, Crown, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  creditsSimple: number;
  creditsPro: number;
  totalUsed: number;
}

export function CreditsCard({ creditsSimple, creditsPro, totalUsed }: Props) {
  const lowSimple = creditsSimple <= 1;
  const lowPro = creditsPro === 0;

  return (
    <Card className="p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Seus créditos</h3>
          <p className="text-xs text-muted-foreground">
            Total usado: {totalUsed}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
              Simples
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {creditsSimple}
          </div>
          {lowSimple && creditsSimple > 0 && (
            <div className="text-[10px] text-warning mt-1">⚠ Pouco saldo</div>
          )}
          {creditsSimple === 0 && (
            <div className="text-[10px] text-destructive mt-1">Esgotado</div>
          )}
        </div>

        <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-accent" />
            <span className="text-[10px] uppercase tracking-wider text-accent font-bold">
              PRO
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">
            {creditsPro}
          </div>
          {lowPro && (
            <div className="text-[10px] text-muted-foreground mt-1">
              Plano gratuito não inclui PRO
            </div>
          )}
        </div>
      </div>

      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href="/dashboard/planos">
          Adquirir mais créditos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    </Card>
  );
}
