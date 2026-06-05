import Link from "next/link";

/**
 * Rodape com links legais. Compacto, aparece em todas as paginas.
 * Mostra disclaimer minimo + links para Termos / Privacidade / Contato.
 */
export function LegalFooter() {
  return (
    <footer className="mt-12 border-t border-border/40 bg-background/50">
      <div className="container-fluid py-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <p className="leading-relaxed max-w-md">
            <strong className="text-foreground">TradeAI</strong> — Análises
            informativas geradas por IA. Não constitui recomendação de
            investimento. Resultados passados não garantem performance futura.
          </p>
          <nav
            aria-label="Rodapé legal"
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            <Link
              href="/termos-de-uso"
              className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
            >
              Termos de Uso
            </Link>
            <Link
              href="/politica-de-privacidade"
              className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
            >
              Privacidade
            </Link>
            <a
              href="mailto:contato@tradeai.com.br"
              className="hover:text-foreground transition-colors min-h-[44px] flex items-center"
            >
              Contato
            </a>
          </nav>
        </div>
        <div className="mt-4 pt-4 border-t border-border/30 text-[10px] text-muted-foreground/60 text-center">
          © {new Date().getFullYear()} TradeAI · Todos os direitos reservados ·
          LGPD compliant
        </div>
      </div>
    </footer>
  );
}
