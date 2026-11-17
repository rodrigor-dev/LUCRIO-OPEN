"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Smartphone, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { sair } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo";
import { apenasDigitosCelular, erroCelular, mascaraCelular } from "@/lib/celular";

/**
 * Tela obrigatória para contas novas sem celular (ex.: entrou pelo Google).
 * O middleware manda para cá até o número ser cadastrado.
 */
function CompletarCadastroForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const destino = (() => {
    const r = searchParams?.get("redirect") || "/dashboard";
    return r.startsWith("/dashboard") ? r : "/dashboard";
  })();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("usuarios").select("nome").eq("id", user.id).maybeSingle();
      const primeiroNome = String(data?.nome || user.user_metadata?.full_name || "").trim().split(" ")[0];
      setNome(primeiroNome);
    })();
  }, [supabase]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const problema = erroCelular(celular);
    if (problema) {
      setErro(problema);
      return;
    }

    setSalvando(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data, error } = await supabase
        .from("usuarios")
        .update({ telefone: apenasDigitosCelular(celular) })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        console.error("[CompletarCadastro] erro ao salvar celular:", error);
        setErro("Não foi possível salvar agora. Tente novamente.");
        return;
      }

      toast.success("Tudo pronto! Bem-vindo ao FATURION.");
      // Recarrega para o sistema já reconhecer o celular cadastrado
      window.location.replace(destino);
    } catch (err) {
      console.error("[CompletarCadastro] erro inesperado:", err);
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-background via-background to-emerald-50/20 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600">
              <LogoMark className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-primary">FATURION</h1>
          </div>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Smartphone className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-center text-xl font-bold">
              {nome ? `Falta só um passo, ${nome}!` : "Falta só um passo!"}
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Cadastre seu celular para concluir sua conta e começar a usar o FATURION.
            </p>

            <form onSubmit={salvar} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="celular">Celular (WhatsApp)</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="celular"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    autoFocus
                    value={celular}
                    onChange={(e) => {
                      setCelular(mascaraCelular(e.target.value));
                      setErro("");
                    }}
                    placeholder="(11) 98765-4321"
                    className="h-12 pl-10 text-base"
                    aria-invalid={!!erro}
                  />
                </div>
                {erro && <p className="text-sm text-destructive">{erro}</p>}
              </div>

              <Button type="submit" className="h-12 w-full text-base" disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Concluir cadastro
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>Usamos seu número só para avisos da sua conta e suporte. Não compartilhamos com ninguém.</span>
            </div>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={async () => {
            await sair();
            window.location.href = "/login";
          }}
          className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair e entrar com outra conta
        </button>
      </motion.div>
    </main>
  );
}

export default function CompletarCadastroPage() {
  return (
    <Suspense fallback={null}>
      <CompletarCadastroForm />
    </Suspense>
  );
}
