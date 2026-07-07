"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, User, Gift, CheckCircle2, ArrowLeft } from "lucide-react";
import { criarConta, entrarComGoogle, recuperarSenha } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams?.get("ref") || null;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [etapaConfirmacao, setEtapaConfirmacao] = useState(false);
  const [emailConfirmacao, setEmailConfirmacao] = useState("");
  const [reenviando, setReenviando] = useState(false);

  // Salvar codigo de indicacao no sessionStorage
  useEffect(() => {
    if (refCode) {
      sessionStorage.setItem("referral_code", refCode);
    }
  }, [refCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    try {
      if (senha !== confirmarSenha) {
        setErro("As senhas não coincidem.");
        return;
      }

      if (senha.length < 8) {
        setErro("A senha deve ter no mínimo 8 caracteres.");
        return;
      }

      const codigoRef = refCode || sessionStorage.getItem("referral_code") || null;
      const resultado = await criarConta(email, senha, nome, codigoRef);

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      if (resultado.requiresEmailConfirmation) {
        setEmailConfirmacao(email);
        setEtapaConfirmacao(true);
        return;
      }

      // Limpar codigo de sessionStorage apos sucesso
      sessionStorage.removeItem("referral_code");
      toast.success("Conta criada com sucesso!");
      router.push("/dashboard");
    } catch (err) {
      console.error("[Cadastro] Erro ao criar conta:", err);
      setErro("Erro ao criar conta. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleReenviarEmail() {
    setReenviando(true);
    try {
      const resultado = await recuperarSenha(emailConfirmacao);
      if (resultado.erro) {
        toast.error(resultado.erro);
      } else {
        toast.success("Email reenviado! Verifique sua caixa de entrada.");
      }
    } catch (err) {
      console.error("[Cadastro] Erro ao reenviar email:", err);
      toast.error("Erro ao reenviar email. Tente novamente.");
    } finally {
      setReenviando(false);
    }
  }

  async function handleGoogle() {
    setCarregando(true);
    setErro("");
    try {
      // Salvar referral code antes do redirect Google
      if (refCode) {
        sessionStorage.setItem("referral_code", refCode);
      }
      const resultado = await entrarComGoogle();

      if (resultado.erro) {
        setErro(resultado.erro);
      }
    } catch (err) {
      console.error("[Cadastro] Erro ao autenticar com Google:", err);
      setErro("Erro ao autenticar com Google. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-emerald-50/20 p-4">
      {/* Tela de confirmação de email */}
      {etapaConfirmacao ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-4xl font-bold text-primary">LUCRIO</h1>
            </Link>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </motion.div>

              <h2 className="mb-2 text-xl font-bold">Confirme seu e-mail</h2>
              <p className="mb-1 text-sm text-muted-foreground">
                Enviamos um link de confirmação para:
              </p>
              <p className="mb-6 text-sm font-semibold text-foreground">
                {emailConfirmacao}
              </p>

              <div className="space-y-3 rounded-xl bg-muted/50 p-4 text-left text-sm text-muted-foreground">
                <p>1. Abra sua caixa de entrada</p>
                <p>2. Clique no link de confirmação</p>
                <p>3. Volte aqui e faça login</p>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Não encontrou? Verifique a pasta <strong>spam</strong> ou <strong>lixo eletrônico</strong>.
              </p>

              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleReenviarEmail}
                  disabled={reenviando}
                  variant="outline"
                  className="w-full"
                >
                  {reenviando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reenviando...
                    </>
                  ) : (
                    "Reenviar email de confirmação"
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setEtapaConfirmacao(false);
                    setErro("");
                  }}
                  variant="ghost"
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao cadastro
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Já confirmou?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </motion.div>
      ) : (
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
          <p className="mt-2 text-muted-foreground">
            Crie sua conta gratuitamente
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-8">
              {refCode ? (
                <div className="mb-6 rounded-md bg-green-500/10 p-3 text-center text-sm text-green-700 dark:text-green-400">
                  <Gift className="mx-auto mb-1 h-4 w-4" />
                  Você foi convidado! Ganhe <strong>7 dias extras</strong> de trial
                </div>
              ) : (
                <div className="mb-6 rounded-md bg-primary/10 p-3 text-center text-sm text-primary">
                  <strong>7 dias grátis</strong> - Sem cartão de crédito
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="nome"
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
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
                  <Label htmlFor="confirmarSenha">Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmarSenha"
                      type={mostrarConfirmarSenha ? "text" : "password"}
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      placeholder="Repita a senha"
                      required
                      minLength={8}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMostrarConfirmarSenha(!mostrarConfirmarSenha)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {mostrarConfirmarSenha ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {erro && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {erro}
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full"
                  size="lg"
                >
                  {carregando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar conta grátis"
                  )}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                onClick={handleGoogle}
                disabled={carregando}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A850"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Cadastrar com Google
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-center text-sm text-muted-foreground"
        >
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </motion.p>
      </motion.div>
      )}
    </main>
  );
}

export default function CadastroPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CadastroForm />
    </Suspense>
  );
}
