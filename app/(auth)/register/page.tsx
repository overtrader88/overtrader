import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Criar conta",
  description: "Crie sua conta TradeAI gratuita.",
};

export default function RegisterPage() {
  return (
    <AuthCard
      title="Criar conta grátis"
      description="3 análises completas por mês, para sempre. Sem cartão."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
