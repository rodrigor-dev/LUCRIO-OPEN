"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { redefinirSenha } from "@/services/auth.service";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [tokenProcessado, setTokenProcessado] = useState(false);
  const [tokenErro, setTokenErro] = useState(false);

  useEffect(() => {
    async function processarToken() {
      const supabase = createClient();

      // Verificar se já tem sessão ativa
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setTokenProcessado(true);
        return;
      }

      // Extrair token do hash (#access_token=...&type=recovery)
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const type = params.get("type");

        if (accessToken && type === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: params.get("refresh_token") || "",
          });

          if (!error) {
            setTokenProcessado(true);
          } else {
            console.error("[RedefinirSenha] Erro ao processar token:", error.message);
            setTokenErro(true);
          }
          return;
        }
      }

      // Verificar query params (fluxo alternativo)
      const token = searchParams?.get("token");
      const tokenType = searchParams?.get("type");
      if (token && tokenType === "recovery") {
        setTokenProcessado(true);
        return;
      }

      // Nenhum token encontrado
      setTokenErro(true);
    }

    processarToken();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (senha.length < 8) {
        toast.error("A senha deve ter no mínimo 8 caracteres.");
        return;
      }

      if (senha !== confirmarSenha) {
        toast.error("As senhas não coincidem.");
        return;
      }

      const resultado = await redefinirSenha(senha);

      if (resultado.erro) {
        toast.error(resultado.erro);
        return;
      }

      toast.success("Senha redefinida com sucesso!");
      router.push("/login");
    } catch {
      toast.error("Erro ao redefinir senha. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  // Carregando token
  if (!tokenProcessado && !tokenErro) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-emerald-50/20 p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando link...</p>
        </div>
      </main>
    );
  }

  // Token inválido ou expirado
  if (tokenErro) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-emerald-50/20 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-4xl font-bold text-primary">LUCRIO</h1>
            </Link>
          </div>
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-8 text-center">
              <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-bold">Link inválido ou expirado</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                O link de redefinição de senha não é válido ou já expirou.
                Solicite um novo link de redefinição.
              </p>
              <Link href="/recuperar-senha">
                <Button className="w-full" size="lg">
                  Solicitar novo link
                </Button>
              </Link>
              <Link href="/login" className="mt-3 block text-sm text-primary hover:underline">
                Voltar ao login
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-emerald-50/20 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md space-y-8"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-center"
        >
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-primary">LUCRIO</h1>
          </Link>
          <p className="mt-2 text-muted-foreground">Defina sua nova senha</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="senha"
                      type={mostrarSenha ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                      minLength={8}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {mostrarSenha ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmarSenha">Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmarSenha"
                      type={mostrarConfirmar ? "text" : "password"}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Repita a senha"
                      required
                      minLength={8}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {mostrarConfirmar ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full"
                  size="lg"
                >
                  {carregando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redefinindo...
                    </>
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-center text-sm text-muted-foreground"
        >
          Lembrou sua senha?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </motion.p>
      </motion.div>
    </main>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RedefinirSenhaForm />
    </Suspense>
  );
}
