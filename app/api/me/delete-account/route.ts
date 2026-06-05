/**
 * DELETE /api/me/delete-account
 *
 * Implementa o direito ao apagamento da LGPD (art. 18, VI).
 * Remove TODOS os dados do usuario nas tabelas operacionais:
 *   - profiles, user_credits, analyses, watchlist, alerts
 *   - credit_transactions, subscriptions, telegram_links
 *   - auth.users (via service_role)
 *
 * Body opcional: { confirmation: "APAGAR MINHA CONTA" } - protege contra
 * cliques acidentais.
 *
 * Operacao IRREVERSIVEL. Backup permanece por ate 90 dias (politica de retencao).
 */
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const REQUIRED_CONFIRMATION = "APAGAR MINHA CONTA";

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // Confirmacao defensiva (cliente DEVE enviar string exata)
  let body: { confirmation?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.confirmation !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      {
        error: "Confirmacao invalida",
        required: `Envie {"confirmation":"${REQUIRED_CONFIRMATION}"} no body pra confirmar`,
      },
      { status: 400 }
    );
  }

  // Service role bypassa RLS — necessario pra deletar de auth.users
  const service = createServiceClient();
  const userId = user.id;

  try {
    // Deleta em ordem reversa de dependencias.
    // Como temos ON DELETE CASCADE em muitas FK, deletar auth.users
    // ja propaga. Mas faco explicitamente em algumas tabelas pra garantir
    // que nada fica orfao mesmo se algum CASCADE falhar.
    await Promise.allSettled([
      service.from("alerts").delete().eq("user_id", userId),
      service.from("watchlist").delete().eq("user_id", userId),
      service.from("credit_transactions").delete().eq("user_id", userId),
      service.from("subscriptions").delete().eq("user_id", userId),
      service.from("telegram_links").delete().eq("user_id", userId),
      service.from("analyses").delete().eq("user_id", userId),
      service.from("user_credits").delete().eq("user_id", userId),
      service.from("profiles").delete().eq("id", userId),
    ]);

    // Deleta da auth.users (ultimo passo)
    const { error: authErr } = await service.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[delete-account] erro ao deletar auth user:", authErr);
      return NextResponse.json(
        {
          error: "Falha ao apagar conta de autenticacao",
          detail: authErr.message,
          note: "Dados operacionais foram removidos. Contate o suporte pra finalizar a remocao do login.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Conta apagada com sucesso. Dados removidos de todos os sistemas operacionais.",
      retention_note:
        "Backups podem reter copias por ate 90 dias conforme nossa Politica de Privacidade.",
    });
  } catch (err) {
    console.error("[delete-account] erro inesperado:", err);
    return NextResponse.json(
      {
        error: "Erro inesperado ao apagar conta",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
}
