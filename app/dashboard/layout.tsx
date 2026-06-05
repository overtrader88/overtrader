import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, LogOut, Sparkles, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardNav } from "@/components/dashboard/nav";
import { BellBadge } from "@/components/alerts/bell-badge";
import { LegalFooter } from "@/components/legal/legal-footer";
import { isAdmin } from "@/lib/auth/admin";
import { signOut } from "./actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Busca perfil (best-effort - se nao existir ainda, segue sem)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, plan")
    .eq("id", user.id)
    .maybeSingle();

  // Plano ativo da nova tabela subscriptions (fonte de verdade no Sprint 5+).
  // Fallback pra profiles.plan se a RPC nao retornar (usuario sem subscription).
  let activePlan: "free" | "pro" | "pro_plus" = "free";
  try {
    const { data } = await supabase.rpc("get_active_plan", { p_user_id: user.id });
    if (data === "pro" || data === "pro_plus") {
      activePlan = data;
    } else if (profile?.plan === "pro" || profile?.plan === "pro_plus") {
      activePlan = profile.plan;
    }
  } catch {
    // RPC pode nao existir se migration nao foi rodada — segue como free
    if (profile?.plan === "pro" || profile?.plan === "pro_plus") {
      activePlan = profile.plan;
    }
  }

  const displayName = profile?.full_name ?? user.email?.split("@")[0] ?? "Usuário";
  const isUserAdmin = isAdmin(user.email);
  const planLabel = activePlan === "pro_plus" ? "PRO+" : activePlan.toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container-fluid h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-lg min-h-0 flex-shrink-0"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">
              Trade<span className="text-primary">AI</span>
            </span>
          </Link>

          {/* Navegação principal (desktop inline, mobile drawer) */}
          <div className="flex-1 flex justify-center">
            <DashboardNav />
          </div>

          {/* Conta + logout */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <BellBadge />
            {activePlan === "free" ? (
              <Link
                href="/planos"
                className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-primary hover:bg-primary/15 transition-colors min-h-[28px]"
                title="Faca upgrade pra PRO ou PRO+"
              >
                <Sparkles className="h-3 w-3" /> Free · upgrade
              </Link>
            ) : (
              <Badge
                variant="default"
                className="hidden sm:inline-flex uppercase text-[10px] tracking-wider"
                title="Seu plano ativo"
              >
                <Crown className="h-3 w-3 mr-1" /> {planLabel}
              </Badge>
            )}
            {isUserAdmin && (
              <Link
                href="/dashboard/admin/credits"
                className="hidden md:inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-warning hover:bg-warning/15 transition-colors min-h-[28px]"
                title="Painel admin"
              >
                Admin
              </Link>
            )}
            <span className="hidden lg:inline text-sm text-muted-foreground max-w-[140px] truncate">
              {displayName}
            </span>
            <form action={signOut}>
              <Button
                variant="ghost"
                size="icon"
                type="submit"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 container-fluid py-6 sm:py-8 lg:py-10">
        {children}
      </main>

      <LegalFooter />
    </div>
  );
}
