"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Send,
  Copy,
  CheckCircle2,
  Loader2,
  XCircle,
  ExternalLink,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  configured: boolean;
  botUsername: string | null;
  initialLinked: boolean;
  initialUsername: string | null;
}

export function TelegramPairClient({
  configured,
  botUsername,
  initialLinked,
  initialUsername,
}: Props) {
  const [linked, setLinked] = useState(initialLinked);
  const [username] = useState(initialUsername);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const botLink = botUsername ? `https://t.me/${botUsername}` : null;
  const startCommand = token ? `/start ${token}` : null;
  const fullStartUrl =
    botLink && token ? `${botLink}?start=${token}` : null;

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/telegram/pair", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Falha", { description: data.error });
        return;
      }
      setToken(data.token);
      setExpiresAt(data.expiresAt);
      toast.success("Token gerado!", {
        description: "Valido por 15 minutos.",
      });
    } catch {
      toast.error("Erro de rede");
    } finally {
      setGenerating(false);
    }
  }

  async function unlink() {
    if (!confirm("Desvincular o Telegram dessa conta?")) return;
    setUnlinking(true);
    try {
      const res = await fetch("/api/telegram/pair", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Falha ao desvincular");
        return;
      }
      setLinked(false);
      setToken(null);
      toast.success("Telegram desvinculado.");
    } finally {
      setUnlinking(false);
    }
  }

  function copyCommand() {
    if (startCommand) {
      navigator.clipboard.writeText(startCommand);
      toast.success("Comando copiado");
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Send className="h-6 w-6 text-primary" />
          Telegram
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte seu Telegram pra consultar analises e receber alertas (em
          breve) sem abrir o site.
        </p>
      </div>

      {!configured && (
        <Card className="p-5 border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Bot indisponivel.</strong> O administrador ainda nao
              configurou <code className="text-xs">TELEGRAM_BOT_TOKEN</code> no
              servidor. Volte mais tarde ou avise o suporte.
            </div>
          </div>
        </Card>
      )}

      {configured && linked && (
        <Card className="p-5 border-success/30 bg-success/5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Vinculado!</div>
                {username && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Conta: <strong>@{username}</strong>
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Mande <code>/help</code> no chat para ver os comandos
                  disponiveis.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={unlink}
              disabled={unlinking}
              className="min-h-[44px]"
            >
              {unlinking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Desvincular"
              )}
            </Button>
          </div>
        </Card>
      )}

      {configured && !linked && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
            Como conectar
          </h2>
          <ol className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6">
                1
              </Badge>
              <div className="flex-1">
                {botLink ? (
                  <span>
                    Abra o bot no Telegram:{" "}
                    <a
                      href={botLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      @{botUsername} <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    O administrador precisa configurar{" "}
                    <code className="text-xs">TELEGRAM_BOT_USERNAME</code>.
                  </span>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6">
                2
              </Badge>
              <div className="flex-1 space-y-2">
                <p>Gere um token de pareamento (valido 15 min):</p>
                {!token ? (
                  <Button
                    onClick={generateToken}
                    disabled={generating}
                    size="sm"
                    className="min-h-[44px]"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      "Gerar token"
                    )}
                  </Button>
                ) : (
                  <div className="rounded-md border border-border bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Seu comando:
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono break-all">
                        {startCommand}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={copyCommand}
                        className="min-h-[44px] min-w-[44px]"
                        aria-label="Copiar comando"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {expiresAt && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Expira em{" "}
                        {new Date(expiresAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6">
                3
              </Badge>
              <div className="flex-1">
                Cole o comando no chat do bot e mande. Voce vera uma confirmacao
                de vinculo.
                {fullStartUrl && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-2 min-h-[44px]"
                  >
                    <a
                      href={fullStartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir bot ja com o token <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </li>
            <li className="flex gap-3">
              <Badge variant="outline" className="shrink-0 h-6">
                4
              </Badge>
              <div className="flex-1">
                Pronto! Mande <code>/btc 1h</code>, <code>/eth 4h</code>,{" "}
                <code>/xauusd 1d</code>, etc — vai receber a analise direto no
                chat.
              </div>
            </li>
          </ol>
        </Card>
      )}

      {/* Comandos disponíveis */}
      {linked && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
            Comandos disponíveis
          </h2>
          <ul className="space-y-2 text-sm">
            <Cmd cmd="/btc 1h" desc="Analise do BTC em 1 hora (substitua por qualquer ativo + timeframe)" />
            <Cmd cmd="/eth 4h" desc="Ethereum em 4 horas" />
            <Cmd cmd="/xauusd 1d" desc="Ouro em diario" />
            <Cmd cmd="/watchlist" desc="Lista sua watchlist atual" />
            <Cmd cmd="/help" desc="Lista completa de comandos" />
            <Cmd cmd="/desvincular" desc="Remove o vinculo" />
          </ul>
        </Card>
      )}
    </div>
  );
}

function Cmd({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
      <code className="text-primary font-mono text-xs sm:text-sm bg-primary/5 px-2 py-0.5 rounded inline-block w-fit">
        {cmd}
      </code>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </li>
  );
}
