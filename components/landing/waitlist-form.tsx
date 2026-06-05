"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z
    .string()
    .min(2, "Digite seu nome (pelo menos 2 letras).")
    .max(80, "Nome muito longo.")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .min(1, "Email é obrigatório.")
    .email("Email inválido."),
});

type FormData = z.infer<typeof schema>;

export function WaitlistForm() {
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    try {
      // Captura parametros UTM da URL atual
      const urlParams = new URLSearchParams(window.location.search);
      const payload = {
        ...data,
        utm_source: urlParams.get("utm_source") ?? null,
        utm_medium: urlParams.get("utm_medium") ?? null,
        utm_campaign: urlParams.get("utm_campaign") ?? null,
        referrer: document.referrer || null,
      };

      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Erro ao cadastrar.");

      setSuccess(true);
      reset();
      toast.success("Tudo certo! Você está na lista.", {
        description: "Vamos te avisar assim que o beta abrir.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      toast.error("Não foi possível cadastrar.", { description: msg });
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-8 text-center animate-fade-in">
        <div className="inline-grid h-16 w-16 place-items-center rounded-full bg-success/15 mb-4">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Você está na lista!</h3>
        <p className="text-muted-foreground">
          Vamos te avisar por email assim que o beta privado abrir.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setSuccess(false)}
        >
          Cadastrar outro email
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      aria-label="Formulário de lista de espera"
    >
      <div className="space-y-2">
        <Label htmlFor="waitlist-name">Nome (opcional)</Label>
        <Input
          id="waitlist-name"
          type="text"
          placeholder="Seu nome"
          autoComplete="name"
          {...register("name")}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitlist-email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="waitlist-email"
            type="email"
            placeholder="voce@email.com"
            autoComplete="email"
            inputMode="email"
            className="pl-10"
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </div>
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Cadastrando...
          </>
        ) : (
          "Entrar na lista de espera"
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Sem spam. Você só recebe email quando tiver novidade real.
      </p>
    </form>
  );
}
