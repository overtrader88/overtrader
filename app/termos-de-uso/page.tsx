import Link from "next/link";
import { ArrowLeft, ScrollText, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Termos de Uso · Trading IA",
  description:
    "Termos e condições de uso da plataforma TradeAI. Leia antes de usar o serviço.",
};

const LAST_UPDATE = "25 de maio de 2026";

export default function TermosDeUsoPage() {
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
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <ScrollText className="h-5 w-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Termos de Uso</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Última atualização: {LAST_UPDATE}
          </p>
        </div>

        {/* Disclaimer de risco — destaque */}
        <Card className="p-5 mb-8 border-warning/40 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm text-foreground/90 leading-relaxed">
              <strong className="block mb-2 text-warning">
                Aviso de risco financeiro
              </strong>
              Operações em mercados financeiros envolvem <strong>risco
              substancial de perda</strong>. As análises, sinais e backtests
              disponibilizados pela TradeAI são meramente informativos e{" "}
              <strong>não constituem recomendação personalizada de
              investimento</strong>. Resultados passados não garantem
              performance futura. Você é o único responsável pelas decisões de
              investimento que tomar.
            </div>
          </div>
        </Card>

        <div className="prose prose-invert prose-sm sm:prose-base max-w-none space-y-6">
          <Section title="1. Aceitação dos termos">
            <p>
              Ao criar uma conta, acessar ou utilizar a plataforma TradeAI
              (&ldquo;Plataforma&rdquo; ou &ldquo;Serviço&rdquo;), você
              (&ldquo;Usuário&rdquo;) concorda integralmente com estes Termos de
              Uso e com a nossa{" "}
              <Link href="/politica-de-privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              . Se você não concorda com qualquer parte destes termos, não
              utilize a Plataforma.
            </p>
          </Section>

          <Section title="2. Descrição do serviço">
            <p>
              A TradeAI é uma ferramenta de análise técnica automatizada que
              utiliza algoritmos quantitativos e inteligência artificial
              generativa para gerar:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Sinais de tendência (compra, venda ou neutro) em até 143 ativos financeiros distribuídos em 5 categorias (criptomoedas, forex, commodities, ações e índices);</li>
              <li>Níveis sugeridos de entrada, stop loss e take profit baseados em análise estatística;</li>
              <li>Backtests históricos para avaliação da consistência de padrões;</li>
              <li>Narrativas explicativas geradas por modelo de linguagem.</li>
            </ul>
            <p className="mt-3">
              <strong>A TradeAI NÃO é uma corretora, banco, fundo de
              investimento, agente autônomo ou consultor de valores
              mobiliários</strong> nos termos da Resolução CVM nº 178/2023 ou
              equivalente. Não somos credenciados, regulados ou supervisionados
              pela Comissão de Valores Mobiliários (CVM), Banco Central do
              Brasil (BCB) ou qualquer outro órgão regulador financeiro.
            </p>
          </Section>

          <Section title="3. Elegibilidade e cadastro">
            <p>
              Para utilizar o Serviço você deve:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Ter no mínimo 18 anos completos e plena capacidade civil;</li>
              <li>Fornecer informações verdadeiras, precisas e atualizadas no cadastro;</li>
              <li>Manter a confidencialidade da sua senha;</li>
              <li>Notificar imediatamente sobre qualquer uso não autorizado da sua conta;</li>
              <li>Ser o único titular da conta — não compartilhe acesso com terceiros.</li>
            </ul>
          </Section>

          <Section title="4. Planos, créditos e cobrança">
            <p>
              O serviço é oferecido em três planos:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Free</strong>: 3 créditos vitalícios concedidos no cadastro, sem renovação;</li>
              <li><strong>PRO</strong>: assinatura mensal (R$ 59) ou anual (R$ 600) com créditos mensais;</li>
              <li><strong>PRO+</strong>: assinatura mensal (R$ 99) ou anual (R$ 936) com créditos e recursos adicionais.</li>
            </ul>
            <p className="mt-3">
              Cada análise consome 1 crédito, independentemente do ativo ou
              timeframe. Créditos não utilizados não são acumulativos entre
              períodos. Os pagamentos são processados pelo provedor terceirizado{" "}
              <strong>HUBLA</strong> e estão sujeitos aos termos do mesmo.
            </p>
            <p className="mt-3">
              <strong>Cancelamento:</strong> você pode cancelar a qualquer
              momento pelo painel do HUBLA. O acesso permanece ativo até o fim
              do período já pago. Após esse prazo, sua conta retorna ao plano
              Free automaticamente.
            </p>
            <p className="mt-3">
              <strong>Reembolso:</strong> seguimos o Código de Defesa do
              Consumidor (Lei 8.078/90). Você tem direito a arrependimento de 7
              dias após a contratação para serviços contratados fora do
              estabelecimento comercial. Após esse prazo, reembolsos
              proporcionais podem ser solicitados em casos de falha técnica
              comprovada.
            </p>
          </Section>

          <Section title="5. Disclaimer de risco — leitura obrigatória">
            <p className="font-semibold">
              5.1. As análises e sinais fornecidos pela TradeAI são gerados por
              algoritmos automatizados e não levam em consideração sua situação
              financeira pessoal, objetivos de investimento, tolerância a risco
              ou perfil de investidor.
            </p>
            <p>
              5.2. Operações em mercados financeiros envolvem risco substancial
              e podem resultar em <strong>perda total ou parcial</strong> do
              capital investido. Você reconhece que pode perder mais do que
              investiu em operações alavancadas (futuros, margem, derivativos).
            </p>
            <p>
              5.3. Resultados de backtests são simulações sobre dados históricos
              e <strong>não garantem resultados futuros</strong>. O backtest
              não considera custos de spread, slippage, comissão da corretora,
              impostos ou condições reais de mercado.
            </p>
            <p>
              5.4. A IA generativa pode produzir descrições que parecem
              definitivas mas são apenas síntese automática dos dados técnicos.
              Modelos de linguagem podem alucinar ou conter erros — sempre
              verifique os números com sua própria análise.
            </p>
            <p>
              5.5. Você é o <strong>único responsável</strong> por qualquer
              decisão de investimento. A TradeAI, seus sócios, empregados,
              prestadores de serviço e fornecedores <strong>NÃO se
              responsabilizam por perdas financeiras</strong> decorrentes do uso
              das informações fornecidas pela Plataforma.
            </p>
          </Section>

          <Section title="6. Uso permitido">
            <p>
              Você concorda em usar a Plataforma apenas para fins lícitos e
              pessoais. É proibido:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Revender, redistribuir ou disponibilizar as análises a terceiros sem autorização;</li>
              <li>Tentar acessar áreas restritas, banco de dados ou código-fonte;</li>
              <li>Fazer engenharia reversa, descompilar ou modificar o software;</li>
              <li>Utilizar bots automatizados, scrapers ou ferramentas que sobrecarreguem nossa infraestrutura;</li>
              <li>Criar múltiplas contas para burlar limites de créditos;</li>
              <li>Apresentar a TradeAI como sua própria ferramenta ou marca branca sem contrato comercial.</li>
            </ul>
          </Section>

          <Section title="7. Propriedade intelectual">
            <p>
              Todo o conteúdo da Plataforma — incluindo logos, código-fonte,
              algoritmos de análise, interface, textos, banco de dados e
              identidade visual — é de propriedade exclusiva da TradeAI ou
              utilizado mediante licença. O acesso ao Serviço não transfere
              qualquer direito de propriedade intelectual ao Usuário.
            </p>
          </Section>

          <Section title="8. Limitação de responsabilidade">
            <p>
              Na máxima extensão permitida pela lei brasileira, a TradeAI não
              será responsável por:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Perdas financeiras, lucros cessantes ou danos indiretos decorrentes do uso da Plataforma;</li>
              <li>Indisponibilidade temporária do serviço por motivos técnicos, manutenção ou força maior;</li>
              <li>Inexatidão de dados de mercado fornecidos por provedores terceirizados (Binance, Twelve Data, Yahoo Finance);</li>
              <li>Decisões de investimento tomadas com base nas análises;</li>
              <li>Conteúdo gerado pela IA generativa que possa ser interpretado como recomendação.</li>
            </ul>
          </Section>

          <Section title="9. Modificações dos termos">
            <p>
              Podemos atualizar estes Termos a qualquer momento. Alterações
              materiais serão notificadas com no mínimo 15 dias de antecedência
              via e-mail ou aviso na Plataforma. O uso continuado após a entrada
              em vigor das mudanças constitui aceitação dos novos termos.
            </p>
          </Section>

          <Section title="10. Rescisão">
            <p>
              Podemos suspender ou encerrar seu acesso à Plataforma a qualquer
              momento por violação destes Termos. Você pode encerrar sua conta a
              qualquer momento pela página{" "}
              <Link href="/dashboard/assinatura" className="text-primary hover:underline">
                Minha conta
              </Link>
              {" "}ou solicitando o apagamento dos seus dados conforme nossa
              Política de Privacidade.
            </p>
          </Section>

          <Section title="11. Lei aplicável e foro">
            <p>
              Estes Termos são regidos pelas leis da República Federativa do
              Brasil. Fica eleito o foro da comarca da sede da TradeAI para
              dirimir quaisquer controvérsias, com renúncia expressa a qualquer
              outro, por mais privilegiado que seja.
            </p>
          </Section>

          <Section title="12. Contato">
            <p>
              Dúvidas sobre estes Termos podem ser enviadas para{" "}
              <a
                href="mailto:contato@tradeai.com.br"
                className="text-primary hover:underline"
              >
                contato@tradeai.com.br
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 text-center">
          <Button variant="outline" asChild>
            <Link href="/politica-de-privacidade">
              Ler a Política de Privacidade →
            </Link>
          </Button>
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
