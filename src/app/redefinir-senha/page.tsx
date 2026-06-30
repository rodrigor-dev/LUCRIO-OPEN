"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { redefinirSenha } from "@/services/auth.service";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);

    if (senha !== confirmarSenha) {
      toast.error("As senhas não coincidem.");
      setCarregando(false);
      return;
    }

    if (senha.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      setCarregando(false);
      return;
    }

    const resultado = await redefinirSenha(senha);

    if (resultado.erro) {
      toast.error(resultado.erro);
      setCarregando(false);
      return;
    }

    toast.success("Senha redefinida com sucesso!");
    router.push("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-primary">LUCRIO</h1>
          </Link>
          <p className="mt-2 text-muted-foreground">
            Defina sua nova senha
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="senha"
                className="mb-1 block text-sm font-medium"
              >
                Nova senha
              </label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label
                htmlFor="confirmarSenha"
                className="mb-1 block text-sm font-medium"
              >
                Confirmar nova senha
              </label>
              <input
                id="confirmarSenha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
                required
                minLength={8}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {carregando ? "Redefinindo..." : "Redefinir senha"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
