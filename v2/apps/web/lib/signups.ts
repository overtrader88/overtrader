/**
 * Cadastros abertos? Durante a validação (pré-lançamento) ficam FECHADOS por
 * padrão — só abre quando NEXT_PUBLIC_SIGNUPS_OPEN === "true". Evita que a
 * concorrência crie conta enquanto o site está no ar mas não lançado.
 *
 * Atenção: isto trava a UI. O bloqueio AUTORITATIVO (contra chamada direta à API
 * de auth com a anon key) é o toggle "Allow new users to sign up" no painel do
 * Supabase — manter ambos durante a validação.
 */
export function signupsOpen(): boolean {
  return process.env.NEXT_PUBLIC_SIGNUPS_OPEN === "true";
}
