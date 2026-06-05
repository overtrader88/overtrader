import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata = {
  title: "Esqueci minha senha",
  description: "Recupere o acesso à sua conta TradeAI.",
};

export default function ForgotPage() {
  return (
    <AuthCard
      title="Esqueci minha senha"
      description="Vamos te enviar um link para redefinir sua senha."
      footer={
        <>
          Lembrou da senha?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
