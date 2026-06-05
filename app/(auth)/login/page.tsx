import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Entrar",
  description: "Acesse sua conta TradeAI.",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Entrar"
      description="Acesse sua conta para ver análises e sinais."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Criar conta grátis
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
