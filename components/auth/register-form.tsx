"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff, Mail, Lock, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 letras.").max(80),
  email: z.string().min(1, "Email é obrigatório.").email("Email inválido."),
  password: z
    .string()
    .min(8, "Senha deve ter pelo menos 8 caracteres.")
    .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
    .regex(/[0-9]/, "Inclua um número."),
  accept: z.literal(true, {
    errorMap: () => ({ message: "Você precisa aceitar os termos." }),
  }),
});

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { accept: false as unknown as true },
  });

  const password = watch("password") ?? "";
  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };

  async function onSubmit({ name, email, password }: FormData) {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/callback?next=/dashboard`,
      },
    });

    if (error) {
      const friendly =
        error.message.includes("already registered") ||
        error.message.includes("already exists")
          ? "Esse email já está cadastrado. Tente entrar."
          : error.message;
      toast.error("Não foi possível criar a conta.", { description: friendly });
      return;
    }

    setDone(true);
    toast.success("Conta criada! Confirme seu email para entrar.");
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="inline-grid h-16 w-16 place-items-center rounded-full bg-success/15 mb-4">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-xl font-bold mb-2">Confirme seu email</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Enviamos um link de confirmação para você. Clique no link e volte aqui
          para entrar.
        </p>
        <Button variant="outline" onClick={() => router.push("/login")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Seu nome"
            className="pl-10"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
        </div>
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@email.com"
            className="pl-10"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Pelo menos 8 caracteres"
            className="pl-10 pr-12"
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors min-h-0"
            aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {/* Indicador de forca em tempo real */}
        <ul className="text-xs space-y-1 mt-2">
          {[
            { ok: passwordChecks.length, label: "Pelo menos 8 caracteres" },
            { ok: passwordChecks.upper, label: "Uma letra maiúscula" },
            { ok: passwordChecks.number, label: "Um número" },
          ].map((c) => (
            <li
              key={c.label}
              className={c.ok ? "text-success" : "text-muted-foreground"}
            >
              {c.ok ? "✓" : "○"} {c.label}
            </li>
          ))}
        </ul>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-start gap-3 pt-2">
        <input
          id="accept"
          type="checkbox"
          {...register("accept")}
          className="mt-1 h-4 w-4 rounded border-border bg-card text-primary focus:ring-primary"
        />
        <label htmlFor="accept" className="text-xs text-muted-foreground leading-relaxed">
          Aceito os{" "}
          <a href="/termos" className="text-primary hover:underline">Termos de Uso</a>{" "}
          e a{" "}
          <a href="/privacidade" className="text-primary hover:underline">Política de Privacidade</a>.
          Entendo que o conteúdo é informativo e não constitui recomendação
          personalizada de investimento.
        </label>
      </div>
      {errors.accept && (
        <p className="text-sm text-destructive">{errors.accept.message}</p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Criando conta...
          </>
        ) : (
          "Criar conta grátis"
        )}
      </Button>
    </form>
  );
}
