import Link from "next/link";
import { ArrowLeft, ShieldCheck, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Política de Privacidade · Trading IA",
  description:
    "Como a TradeAI coleta, usa e protege seus dados pessoais. Conformidade com a LGPD.",
};

const LAST_UPDATE = "25 de maio de 2026";

export default function PoliticaDePrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-3">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-success/10 text-success">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Política de Privacidade
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Última atualização: {LAST_UPDATE} · Conformidade com Lei nº
            13.709/2018 (LGPD)
          </p>
        </div>

        {/* Resumo executivo */}
        <Card className="p-5 mb-8 bg-primary/5 border-primary/30">
          <h3 className="font-semibold text-sm mb-2">
            Em resumo (TL;DR)
          </h3>
          <ul className="text-sm text-foreground/85 space-y-1.5 leading-relaxed">
            <li>📧 Coletamos seu e-mail e nome opcionalmente.</li>
            <li>📊 Guardamos suas análises pra você consultar depois.</li>
            <li>💳 Não armazenamos dados de cartão — pagamentos via HUBLA.</li>
            <li>🤖 Enviamos dados técnicos da análise pra OpenAI gerar o texto.</li>
            <li>🚫 Não vendemos nem compartilhamos seus dados com terceiros.</li>
            <li>🗑️ Você pode pedir o apagamento total a qualquer momento.</li>
          </ul>
        </Card>

        <div className="space-y-6">
          <Section title="1. Quem somos">
            <p>
              A <strong>TradeAI</strong> (&ldquo;nós&rdquo;, &ldquo;nossa
              plataforma&rdquo;) é a controladora dos dados pessoais coletados
              através do site e aplicação disponíveis em{" "}
              <em>tradeai.com.br</em> (ou domínio equivalente).
            </p>
            <p>
              Esta política descreve como tratamos seus dados em conformidade
              com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018
              — LGPD)</strong>.
            </p>
          </Section>

          <Section title="2. Quais dados coletamos">
            <h3 className="font-semibold text-base mt-3 mb-1">
              2.1. Dados que você nos fornece
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>E-mail</strong> — obrigatório para criar conta e fazer login;</li>
              <li><strong>Nome completo</strong> — opcional, usado para personalização;</li>
              <li><strong>Senha</strong> — armazenada sob hash criptográfico (Supabase Auth);</li>
              <li><strong>chat_id do Telegram</strong> — opcional, apenas se você conectar o bot.</li>
            </ul>

            <h3 className="font-semibold text-base mt-4 mb-1">
              2.2. Dados gerados pelo uso da Plataforma
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Histórico de análises realizadas (ativo, timeframe, resultado);</li>
              <li>Saldo de créditos e histórico de transações;</li>
              <li>Status da assinatura (plano, data de início, próxima cobrança);</li>
              <li>Watchlist e configurações de alertas;</li>
              <li>Logs de acesso (timestamp, IP) — retidos por 6 meses para segurança.</li>
            </ul>

            <h3 className="font-semibold text-base mt-4 mb-1">
              2.3. Dados que NÃO coletamos
            </h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>❌ <strong>Dados de cartão de crédito</strong> — pagamentos são processados diretamente pelo HUBLA, que possui certificação PCI-DSS;</li>
              <li>❌ Dados de corretoras, contas bancárias ou patrimônio;</li>
              <li>❌ Histórico de navegação fora da nossa plataforma;</li>
              <li>❌ Dados biométricos, de saúde ou sensíveis nos termos do art. 5º, II da LGPD.</li>
            </ul>
          </Section>

          <Section title="3. Para que usamos seus dados">
            <p>Os dados coletados são usados exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Operacionalizar o serviço</strong> — login, cobranças, análises;</li>
              <li><strong>Manter histórico</strong> — você poder consultar análises anteriores;</li>
              <li><strong>Personalizar a experiência</strong> — mostrar seu nome, preferências;</li>
              <li><strong>Comunicação transacional</strong> — confirmação de assinatura, alertas configurados, recuperação de senha;</li>
              <li><strong>Cumprir obrigações legais</strong> — emissão de nota fiscal, conformidade fiscal;</li>
              <li><strong>Detectar abusos</strong> — múltiplas contas, scraping, fraude.</li>
            </ul>
            <p className="mt-3">
              <strong>Não enviamos e-mail marketing</strong> sem seu opt-in
              explícito.
            </p>
          </Section>

          <Section title="4. Base legal do tratamento">
            <p>Tratamos seus dados sob as seguintes bases (art. 7º LGPD):</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Execução de contrato</strong> (art. 7º, V) — para entregar o serviço contratado;</li>
              <li><strong>Cumprimento de obrigação legal</strong> (art. 7º, II) — fiscal, tributária;</li>
              <li><strong>Legítimo interesse</strong> (art. 7º, IX) — segurança, prevenção de fraude;</li>
              <li><strong>Consentimento</strong> (art. 7º, I) — para opcionais como notificações Telegram.</li>
            </ul>
          </Section>

          <Section title="5. Compartilhamento com terceiros">
            <p>
              Compartilhamos dados apenas com operadores essenciais ao
              funcionamento do serviço, sob contratos de tratamento de dados
              (DPA) quando aplicável:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase</strong> (PostgreSQL hospedado) — armazena sua conta e dados de uso;</li>
              <li><strong>Vercel</strong> (hospedagem do app) — processa requisições HTTP;</li>
              <li><strong>HUBLA</strong> (gateway de pagamento) — recebe seus dados de pagamento diretamente, sem trânsito por nossos servidores;</li>
              <li><strong>OpenAI</strong> (LLM) — recebe apenas dados técnicos da análise (preço, indicadores, gates) sem qualquer informação pessoal identificável, para gerar a narrativa;</li>
              <li><strong>Binance, Twelve Data, Yahoo Finance</strong> — recebem apenas o símbolo do ativo consultado, sem dados pessoais.</li>
            </ul>
            <p className="mt-3">
              <strong>Não vendemos seus dados.</strong> Não compartilhamos com
              corretoras, anunciantes, redes sociais ou data brokers.
            </p>
          </Section>

          <Section title="6. Transferência internacional">
            <p>
              Alguns operadores citados (Vercel, Supabase, OpenAI) hospedam
              servidores fora do Brasil (principalmente EUA e Europa). Essas
              transferências são realizadas sob:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Cláusulas contratuais padrão de proteção de dados;</li>
              <li>Garantias equivalentes aos requisitos da LGPD;</li>
              <li>Reciprocidade entre Brasil e países com legislação adequada.</li>
            </ul>
          </Section>

          <Section title="7. Seus direitos como titular (art. 18 LGPD)">
            <p>Você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Confirmação e acesso</strong> — saber se tratamos seus dados e quais;</li>
              <li><strong>Correção</strong> — atualizar dados incompletos, inexatos ou desatualizados;</li>
              <li><strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários ou tratados em desconformidade;</li>
              <li><strong>Portabilidade</strong> — exportar seus dados para outro fornecedor;</li>
              <li><strong>Eliminação</strong> — apagar seus dados tratados com base no consentimento;</li>
              <li><strong>Revogação do consentimento</strong> a qualquer momento;</li>
              <li><strong>Informação sobre compartilhamento</strong> com entidades públicas e privadas;</li>
              <li><strong>Oposição</strong> a tratamento realizado com base nas hipóteses do art. 7º quando houver descumprimento.</li>
            </ul>

            <Card className="p-4 mt-4 bg-primary/5 border-primary/30">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                🗑️ Como apagar sua conta e todos os dados
              </h3>
              <p className="text-sm">
                Acesse{" "}
                <Link
                  href="/dashboard/assinatura"
                  className="text-primary hover:underline"
                >
                  Minha conta → Apagar conta
                </Link>
                {" "}para remover permanentemente todos os seus dados. A operação
                é irreversível e leva até 24 horas para propagação completa nos
                backups.
              </p>
            </Card>
          </Section>

          <Section title="8. Segurança dos dados">
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus
              dados:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Senhas armazenadas com hash bcrypt;</li>
              <li>Conexões HTTPS obrigatórias (TLS 1.2+);</li>
              <li>Row Level Security (RLS) no banco de dados — cada usuário acessa apenas seus próprios registros;</li>
              <li>Tokens de autenticação rotacionados;</li>
              <li>Logs de acesso monitorados;</li>
              <li>Auditoria contínua de operações privilegiadas.</li>
            </ul>
            <p className="mt-3">
              Em caso de incidente de segurança que possa causar risco
              relevante, comunicaremos a ANPD e os titulares afetados conforme
              art. 48 da LGPD.
            </p>
          </Section>

          <Section title="9. Retenção dos dados">
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Conta ativa</strong> — dados retidos enquanto sua conta existir;</li>
              <li><strong>Logs de acesso</strong> — 6 meses;</li>
              <li><strong>Histórico fiscal (transações)</strong> — 5 anos, por obrigação legal;</li>
              <li><strong>Após apagamento de conta</strong> — dados pessoais removidos em até 30 dias dos sistemas operacionais e até 90 dias dos backups.</li>
            </ul>
          </Section>

          <Section title="10. Cookies e tecnologias similares">
            <p>
              Utilizamos cookies essenciais para:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Manter sua sessão autenticada (Supabase Auth);</li>
              <li>Lembrar preferências como tema escuro/claro;</li>
              <li>Detectar idioma do navegador.</li>
            </ul>
            <p className="mt-3">
              <strong>Não usamos cookies de rastreamento publicitário</strong>{" "}
              (Facebook Pixel, Google Ads, etc). Para analytics utilizamos{" "}
              <em>Plausible</em>, que é privacy-first e não usa cookies.
            </p>
          </Section>

          <Section title="11. Menores de idade">
            <p>
              A Plataforma é destinada exclusivamente a pessoas com 18 anos ou
              mais. Não coletamos intencionalmente dados de menores. Se
              identificarmos uma conta de menor, ela será desativada e os dados
              apagados.
            </p>
          </Section>

          <Section title="12. Encarregado pelo Tratamento de Dados (DPO)">
            <Card className="p-4 mt-2 bg-card/40">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong className="block">DPO TradeAI</strong>
                  E-mail:{" "}
                  <a
                    href="mailto:dpo@tradeai.com.br"
                    className="text-primary hover:underline"
                  >
                    dpo@tradeai.com.br
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">
                    Resposta em até 15 dias úteis conforme art. 19 LGPD.
                  </p>
                </div>
              </div>
            </Card>
          </Section>

          <Section title="13. Alterações nesta política">
            <p>
              Podemos atualizar esta política periodicamente. Mudanças
              materiais serão comunicadas via e-mail e banner na plataforma com
              15 dias de antecedência.
            </p>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 text-center space-y-3">
          <Button variant="outline" asChild>
            <Link href="/termos-de-uso">Ler os Termos de Uso →</Link>
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Esta política é elaborada com base nas melhores práticas LGPD e não
            substitui consulta a profissional jurídico para casos específicos.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg sm:text-xl font-bold mb-3 mt-6">{title}</h2>
      <div className="text-sm sm:text-base text-foreground/80 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
