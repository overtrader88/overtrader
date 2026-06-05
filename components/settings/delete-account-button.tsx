"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Botão "Apagar minha conta" com double-confirmation pra evitar cliques acidentais.
 * Usuario precisa digitar a frase exata "APAGAR MINHA CONTA" pra confirmar.
 * Apos sucesso, faz signout e redireciona pra home.
 */
export function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const REQUIRED = "APAGAR MINHA CONTA";
  const matches = typed === REQUIRED;

  async function handleDelete() {
    if (!matches) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/me/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: REQUIRED }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Falha ao apagar conta", {
          description: data.detail ?? data.error,
        });
        return;
      }
      toast.success("Conta apagada com sucesso. Voce sera deslogado.");
      // Aguarda 1.5s pra usuario ver o toast, dai redireciona
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } catch (err) {
      toast.error("Erro de rede", {
        description: err instanceof Error ? err.message : "—",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (!open) {
    return (
      <Card className="p-5 border-destructive/30 bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">Apagar minha conta</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Remove permanentemente sua conta, historico de analises, watchlist,
              alertas e assinatura. Operacao irreversivel — direito ao apagamento
              previsto na LGPD art. 18, VI.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(true)}
              className="mt-3 text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px]"
            >
              <Trash2 className="h-4 w-4" />
              Apagar minha conta
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-destructive border-2 bg-destructive/5">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-base text-destructive mb-2">
              Confirmacao final
            </h3>
            <p className="text-sm text-foreground/85 leading-relaxed">
              Vamos apagar <strong>permanentemente</strong>:
            </p>
            <ul className="list-disc pl-5 mt-2 text-xs text-muted-foreground space-y-0.5">
              <li>Seu perfil e dados de cadastro</li>
              <li>Todo o historico de analises</li>
              <li>Sua watchlist e alertas</li>
              <li>Seu saldo de creditos (ainda que pago)</li>
              <li>Sua assinatura ativa (sem reembolso automatico)</li>
              <li>Vinculo do Telegram</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3 italic">
              Backups podem reter dados por ate 90 dias. Para reembolso de plano
              ativo, abra ticket em <strong>contato@tradeai.com.br</strong>{" "}
              antes de apagar.
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">
            Digite <code className="text-destructive font-mono">APAGAR MINHA CONTA</code> pra confirmar:
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="APAGAR MINHA CONTA"
            disabled={deleting}
            className="w-full px-3 py-2 min-h-[44px] rounded-md border border-destructive/40 bg-background font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setTyped("");
            }}
            disabled={deleting}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!matches || deleting}
            className="min-h-[44px]"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Apagando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Apagar permanentemente
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
