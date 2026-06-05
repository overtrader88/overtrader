"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search, User, RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  credits_pro: number;
  credits_simple: number;
  total_used: number;
  updated_at: string;
}

interface Props {
  adminEmail: string;
}

export function AdminCreditsClient({ adminEmail }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form de credito
  const [targetEmail, setTargetEmail] = useState("");
  const [creditsPro, setCreditsPro] = useState(0);
  const [creditsSimple, setCreditsSimple] = useState(0);
  const [reason, setReason] = useState("");
  const [activatePlan, setActivatePlan] = useState<"" | "pro" | "pro_plus">("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">(
    "monthly"
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/credit?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users ?? []);
      } else {
        toast.error("Erro ao buscar usuarios", {
          description: data.error,
        });
      }
    } catch (err) {
      toast.error("Falha de rede", {
        description: err instanceof Error ? err.message : "—",
      });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmail) {
      toast.error("Informe o email");
      return;
    }
    if (creditsPro === 0 && creditsSimple === 0 && !activatePlan) {
      toast.error("Informe pelo menos um credito ou plano a ativar");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail,
          creditsPro,
          creditsSimple,
          reason,
          activatePlan: activatePlan || null,
          billingPeriod: activatePlan ? billingPeriod : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Mostra detalhe completo (mensagem do banco/RPC) pra facilitar diagnostico
        const desc =
          data.detail
            ? `${data.error ?? "Falha"} — ${data.detail}`
            : data.error ?? "Erro desconhecido";
        toast.error("Falha ao creditar", { description: desc });
        console.error("[admin/credit] resposta:", data);
        return;
      }
      toast.success(
        activatePlan
          ? `Plano ${activatePlan.toUpperCase()} ativado para ${targetEmail}`
          : `Creditado: +${creditsPro} PRO / +${creditsSimple} Simples`
      );
      // Limpa form
      setTargetEmail("");
      setCreditsPro(0);
      setCreditsSimple(0);
      setReason("");
      setActivatePlan("");
      // Recarrega tabela
      fetchUsers();
    } catch (err) {
      toast.error("Erro inesperado", {
        description: err instanceof Error ? err.message : "—",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Form de credito */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Creditar / Ativar plano
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Email do usuario
            </label>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
              required
              className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Creditos PRO
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                value={creditsPro}
                onChange={(e) => setCreditsPro(Number(e.target.value))}
                className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Creditos Simples
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                value={creditsSimple}
                onChange={(e) => setCreditsSimple(Number(e.target.value))}
                className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Ativar plano (opcional)
            </label>
            <select
              value={activatePlan}
              onChange={(e) =>
                setActivatePlan(e.target.value as "" | "pro" | "pro_plus")
              }
              className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Apenas creditar (sem ativar plano)</option>
              <option value="pro">PRO — creditos vao por cima</option>
              <option value="pro_plus">PRO+ — creditos vao por cima</option>
            </select>
          </div>

          {/* Se vai ativar plano, escolhe periodo (define duracao 30 ou 365 dias) */}
          {activatePlan && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Periodo do plano
              </label>
              <select
                value={billingPeriod}
                onChange={(e) =>
                  setBillingPeriod(e.target.value as "monthly" | "annual")
                }
                className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="monthly">Mensal (30 dias)</option>
                <option value="annual">Anual (365 dias)</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Razao (opcional, vai pro log de auditoria)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex: teste, lancamento, bonus beta..."
              maxLength={200}
              className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between pt-2 border-t border-border/40">
            <p className="text-[11px] text-muted-foreground">
              Ação como <span className="font-medium">{adminEmail}</span>
            </p>
            <Button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Aplicando...
                </>
              ) : (
                <>{activatePlan ? "Ativar plano + creditar" : "Creditar"}</>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabela de usuarios */}
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" /> Usuarios e saldos
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="h-3 w-3 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por email/nome"
                className="pl-8 pr-3 py-2 min-h-[36px] rounded-md border border-border bg-background text-xs w-full sm:w-56 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              disabled={loading}
              className="min-h-[36px]"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b border-border/40">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Email
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  PRO
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Simples
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden sm:table-cell">
                  Total usado
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden md:table-cell">
                  Ultima atividade
                </th>
                <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Acao
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Carregando...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-xs">
                    Nenhum usuario encontrado
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.user_id}
                    className="border-b border-border/20 last:border-0 hover:bg-card/30"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-xs sm:text-sm truncate max-w-[180px] sm:max-w-none">
                        {u.email}
                      </div>
                      {u.full_name && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {u.full_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "tabular-nums text-[11px]",
                          u.credits_pro > 0
                            ? "text-primary border-primary/40"
                            : "text-muted-foreground"
                        )}
                      >
                        {u.credits_pro}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {u.credits_simple}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground hidden sm:table-cell">
                      {u.total_used}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[10px] text-muted-foreground hidden md:table-cell">
                      {new Date(u.updated_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setTargetEmail(u.email)}
                        className="text-[11px] text-primary hover:underline min-h-[44px] px-2"
                      >
                        Selecionar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
