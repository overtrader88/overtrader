import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Termos de Uso — Overtrader" };

export default async function TermosPage() {
  const user = await getCurrentUser();
  return (
    <div className="hist-page docpage">
      <AppBar credits={user?.credits} plan={user ? planLabel(user.plan) : undefined} initials={user ? initialsOf(user) : undefined} email={user?.email} />
      <div className="wrap">
        <div className="legal-doc">
          <h1>Termos de Uso</h1>
          <p className="ld-meta">Última atualização: 05/06/2026 · Overtrader (razão social e CNPJ: <b>[a definir]</b>)</p>

          <div className="ld-risk">
            <b>Aviso de risco.</b> O Overtrader é uma ferramenta de <b>análise técnica e quantitativa</b>, de caráter
            <b> informativo e educativo</b>. <b>Não constitui recomendação de investimento</b>, consultoria ou oferta de compra/venda
            de ativos. Operar nos mercados financeiros envolve <b>risco de perda do capital</b>, inclusive total. Resultados
            passados (incluindo backtests e track record) <b>não garantem resultados futuros</b>. As decisões de investimento são
            sempre e exclusivamente suas.
          </div>

          <h2>1. Objeto</h2>
          <p>Estes Termos regem o uso da plataforma Overtrader, que oferece análises de mercado geradas por algoritmos, com métricas estatísticas (amostra, intervalo de confiança e período), backtests e materiais educativos.</p>

          <h2>2. Natureza do serviço — não é recomendação</h2>
          <p>O conteúdo é genérico e não considera seu perfil, objetivos ou situação financeira. Nenhuma análise, sinal, selo de qualidade ou track record deve ser interpretado como ordem ou recomendação personalizada. Não executamos ordens nem oferecemos gestão de carteira ou robôs de auto-execução.</p>

          <h2>3. Riscos</h2>
          <p>Mercados são incertos por natureza. Métricas vêm com intervalo de confiança e tamanho de amostra justamente para comunicar essa incerteza — e o selo fica cinza/vermelho quando os dados não sustentam o sinal. Use as informações com responsabilidade e considere buscar um profissional habilitado (CVM) antes de investir.</p>

          <h2>4. Conta e uso aceitável</h2>
          <p>Você é responsável pelas credenciais da sua conta e por todo uso feito a partir dela. É vedado: usar a plataforma para fins ilícitos; tentar burlar limites técnicos, rate limits ou autenticação; revender ou redistribuir o conteúdo sem autorização.</p>

          <h2>5. Planos, pagamento e reembolso</h2>
          <p>Planos pagos são cobrados conforme descrito na página de Planos. <b>Direito de arrependimento:</b> nos termos do art. 49 do CDC, você pode solicitar o cancelamento com <b>reembolso integral em até 7 (sete) dias corridos</b> a partir da contratação, sem necessidade de justificativa. Solicitações pelo contato abaixo são processadas dentro do prazo legal.</p>

          <h2>6. Propriedade intelectual</h2>
          <p>O motor de análise, a marca Overtrader, o design e os conteúdos são protegidos. Algoritmos centrais (SMC, harmônicos, WEGD, etc.) são auditáveis por transparência, mas o uso comercial não autorizado é vedado.</p>

          <h2>7. Limitação de responsabilidade</h2>
          <p>Na máxima extensão permitida, o Overtrader não se responsabiliza por perdas decorrentes de decisões de investimento, indisponibilidades de provedores de dados de mercado, ou imprecisões de dados de terceiros. O serviço é fornecido "como está".</p>

          <h2>8. Privacidade</h2>
          <p>O tratamento de dados pessoais segue a LGPD e está detalhado na <a href="/privacidade">Política de Privacidade</a>.</p>

          <h2>9. Alterações, foro e contato</h2>
          <p>Estes Termos podem ser atualizados; a data de atualização indica a versão vigente. Foro: comarca do domicílio do consumidor. Contato/DPO: <b>[e-mail a definir]</b>.</p>
        </div>
        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
