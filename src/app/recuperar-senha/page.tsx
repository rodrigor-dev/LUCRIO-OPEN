"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { recuperarSenha } from "@/services/auth.service";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);

    const resultado = await recuperarSenha(email);

    if (resultado.erro) {
      toast.error(resultado.erro);
      setCarregando(false);
      return;
    }

    setEnviado(true);
    setCarregando(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-primary">LUCRIO</h1>
          </Link>
          <p className="mt-2 text-muted-foreground">
            Recupere sua senha
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          {enviado ? (
            <div className="space-y-4 text-center">
              <div className="text-4xl">📧</div>
              <h2 className="text-xl font-semibold">E-mail enviado!</h2>
              <p className="text-muted-foreground">
                Verifique sua caixa de entrada e clique no link para redefinir
                sua senha.
              </p>
              <Link
                href="/login"
                className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium"
                >
                  E-mail cadastrado
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <button
                type="submit"
                disabled={carregando}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {carregando ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Lembrou sua senha?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
