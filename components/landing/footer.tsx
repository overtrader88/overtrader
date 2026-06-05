import Link from "next/link";
import { TrendingUp } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/30">
      <div className="container-fluid py-10 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="h-5 w-5" />
              </span>
              <span>
                Trade<span className="text-primary">AI</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              IA de trading que prova antes de prometer. 15 camadas de análise por sinal.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Produto</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#diferenciais" className="hover:text-foreground min-h-0">Diferenciais</Link></li>
              <li><Link href="/planos" className="hover:text-foreground min-h-0">Planos</Link></li>
              <li><Link href="/cadastro" className="hover:text-foreground min-h-0">Comece grátis</Link></li>
              <li><Link href="/login" className="hover:text-foreground min-h-0">Entrar</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Empresa</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="mailto:contato@tradeai.com.br" className="hover:text-foreground min-h-0">Contato</a></li>
              <li><a href="mailto:dpo@tradeai.com.br" className="hover:text-foreground min-h-0">DPO (LGPD)</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/termos-de-uso" className="hover:text-foreground min-h-0">Termos de Uso</Link></li>
              <li><Link href="/politica-de-privacidade" className="hover:text-foreground min-h-0">Privacidade</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TradeAI. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            <strong>Aviso:</strong> conteúdo informativo. Não constitui recomendação
            personalizada. Trading envolve risco de perda total do capital.
          </p>
        </div>
      </div>
    </footer>
  );
}
