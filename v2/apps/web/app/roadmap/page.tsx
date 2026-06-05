import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roadmap público — Overtrader" };

type Status = "done" | "wip" | "next";
interface Item { status: Status; title: string; detail: string }

const ST: Record<Status, { label: string; cls: string }> = {
  done: { label: "Entregue", cls: "done" },
  wip: { label: "Em progresso", cls: "wip" },
  next: { label: "Planejado", cls: "next" },
};

const ITEMS: Item[] = [
  { status: "done", title: "Análise completa + Relatório PDF", detail: "15 camadas (técnica, SMC, harmônicos, WEGD, Monte Carlo, cenários, sazonalidade, multi-timeframe) com gráfico e export em PDF." },
  { status: "done", title: "Credibilidade visível", detail: "Selo de qualidade honesto, “por que NÃO operar”, e backtest sob demanda parametrizável (estratégia/período/R:R)." },
  { status: "done", title: "Track record forward (auditável)", detail: "Cada sinal carimbado na emissão; resultado medido contra os candles futuros; win rate + PF + R médio com IC e amostra, públicos." },
  { status: "done", title: "Sinais no Telegram + alertas", detail: "Canal de sinais oficiais no Telegram e alertas da watchlist por DM (conecte sua conta na tela de Alertas)." },
  { status: "done", title: "Monitor ao vivo + horários ideais", detail: "Preço, regime e sinal atualizando ao vivo; heatmap de melhores horários (hora × dia), só com amostra suficiente." },
  { status: "wip", title: "Conformidade & transparência", detail: "Aviso de risco em todas as telas, Termos, Privacidade (LGPD) e reembolso de 7 dias. Faltam dados legais finais (CNPJ/DPO)." },
  { status: "next", title: "Reembolso automatizado no checkout", detail: "Cancelamento e reembolso de 7 dias direto no fluxo de pagamento, sem atrito." },
  { status: "next", title: "App / PWA instalável", detail: "Instalar o Overtrader como app no celular, com notificações push." },
  { status: "next", title: "Journal de performance do usuário", detail: "Seu próprio diário de operações com MAE/MFE e disciplina de processo." },
  { status: "next", title: "Versão em inglês", detail: "Internacionalização para alcançar uma audiência maior." },
];

export default async function RoadmapPage() {
  const user = await getCurrentUser();
  return (
    <div className="hist-page">
      <AppBar credits={user?.credits} plan={user ? planLabel(user.plan) : undefined} initials={user ? initialsOf(user) : undefined} email={user?.email} />
      <div className="wrap">
        <div className="head2">
          <div>
            <h1>Roadmap público</h1>
            <div className="meta">Construímos em público. O que já entregamos, o que está em progresso e o que vem — sem promessa vazia.</div>
          </div>
        </div>
        <div className="rdmap">
          {ITEMS.map((it, i) => (
            <div className={`rd-item ${it.status}`} key={i}>
              <span className={`rd-badge ${ST[it.status].cls}`}>{ST[it.status].label}</span>
              <div className="rd-body">
                <div className="rd-title">{it.title}</div>
                <div className="rd-detail">{it.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="note" style={{ margin: "18px 0 60px", maxWidth: "70ch" }}>
          Datas não são prometidas de propósito — preferimos entregar e mostrar do que cravar prazo. Sugestões? Fale com a gente.
          Conteúdo educativo; não é recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
