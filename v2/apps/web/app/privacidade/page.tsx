import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Política de Privacidade — Overtrader" };

export default async function PrivacidadePage() {
  const user = await getCurrentUser();
  return (
    <div className="hist-page docpage">
      <AppBar credits={user?.credits} plan={user ? planLabel(user.plan) : undefined} initials={user ? initialsOf(user) : undefined} email={user?.email} />
      <div className="wrap">
        <div className="legal-doc">
          <h1>Política de Privacidade</h1>
          <p className="ld-meta">Última atualização: 05/06/2026 · Conforme a LGPD (Lei nº 13.709/2018)</p>

          <h2>1. Dados que coletamos</h2>
          <p>Cadastro (e-mail, nome opcional), dados de uso (análises visualizadas, watchlist, alertas), dados de pagamento (processados pelo provedor de pagamento — não armazenamos cartão), e, se você conectar, o seu <b>chat_id do Telegram</b> para envio de alertas.</p>

          <h2>2. Finalidade e base legal</h2>
          <p>Tratamos seus dados para: prestar o serviço (execução de contrato), enviar alertas que você configurou (consentimento), segurança e prevenção a fraude (legítimo interesse) e obrigações legais/fiscais. Você pode retirar o consentimento de notificações a qualquer momento (ex.: <code>/stop</code> no bot, ou desativando o e-mail).</p>

          <h2>3. Compartilhamento</h2>
          <p>Compartilhamos o mínimo necessário com operadores: provedor de banco/infra, provedor de e-mail, Telegram, provedores de dados de mercado e processador de pagamento. Não vendemos seus dados.</p>

          <h2>4. Seus direitos (LGPD)</h2>
          <p>Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informações sobre compartilhamento. Pedidos pelo contato do DPO abaixo.</p>

          <h2>5. Retenção e segurança</h2>
          <p>Mantemos os dados pelo tempo necessário ao serviço e a obrigações legais. Adotamos controles de acesso, isolamento por usuário (RLS) e trilha de auditoria nas operações sensíveis.</p>

          <h2>6. Cookies</h2>
          <p>Usamos cookies essenciais para autenticação de sessão. Não usamos cookies de publicidade de terceiros.</p>

          <h2>7. Encarregado (DPO) e contato</h2>
          <p>Encarregado de dados / contato: <b>[e-mail a definir]</b>. Responsável: Overtrader (CNPJ <b>[a definir]</b>).</p>

          <p className="ld-meta" style={{ marginTop: 20 }}>Veja também os <a href="/termos">Termos de Uso</a>.</p>
        </div>
        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
