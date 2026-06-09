/**
 * Banner da ferramenta exibido no rodapé da coluna do formulário nas telas de
 * recuperação/redefinição de senha — preenche o espaço sobrando e reforça o
 * valor do produto. Puramente apresentacional.
 */
export function AuthPromo() {
  return (
    <a className="authpromo" href="/">
      <span className="authpromo-k"><span className="d" />Overtrader · IA auditável</span>
      <div className="authpromo-stats">
        <span><b>143</b> ativos</span>
        <span><b>15</b> camadas</span>
        <span><b>100%</b> aberto</span>
      </div>
      <span className="authpromo-cta">Conhecer a ferramenta →</span>
    </a>
  );
}
