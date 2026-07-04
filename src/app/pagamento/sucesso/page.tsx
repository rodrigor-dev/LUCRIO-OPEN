"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

function PagamentoSucessoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [processando, setProcessando] = useState(true);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    const pagamentoId = searchParams?.get("payment_id") ?? null;
    const status = searchParams?.get("status") ?? null;

    async function processarPagamento() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        if (status === "approved" || status === "authorized") {
          const { data: assinatura } = await supabase
            .from("assinaturas")
            .select("id")
            .eq("usuario_id", user.id)
            .eq("status", "trial")
            .single();

          if (assinatura) {
            await supabase
              .from("assinaturas")
              .update({
                status: "ativo",
                intent_pagamento_id: pagamentoId,
                ultimo_pagamento: new Date().toISOString(),
                proximo_pagamento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                fim_periodo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              })
              .eq("id", assinatura.id);
          } else {
            await supabase.from("assinaturas").insert({
              usuario_id: user.id,
              plano_id: "pro",
              status: "ativo",
              intent_pagamento_id: pagamentoId,
              trial_termina: new Date().toISOString(),
              ultimo_pagamento: new Date().toISOString(),
              proximo_pagamento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              fim_periodo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            });
          }

          setSucesso(true);
        } else {
          setSucesso(false);
        }
      } catch (error) {
        console.error("Erro ao processar pagamento:", error);
        setSucesso(false);
      } finally {
        setProcessando(false);
      }
    }

    processarPagamento();
  }, [searchParams, router]);

  if (processando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-muted-foreground">Processando seu pagamento...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            {sucesso ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </motion.div>
                <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
                <p className="text-muted-foreground text-center">
                  Seu plano PRO foi ativado. Aproveite todas as funcionalidades do LUCRIO!
                </p>
                <Link href="/dashboard">
                  <Button className="mt-4">
                    Ir para o Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h1 className="text-2xl font-bold">Pagamento não confirmado</h1>
                <p className="text-muted-foreground text-center">
                  Seu pagamento ainda está sendo processado ou não foi aprovado.
                  Verifique seu email para mais detalhes.
                </p>
                <Link href="/dashboard/configuracoes">
                  <Button variant="outline" className="mt-4">
                    Voltar às Configurações
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function PagamentoSucesso() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PagamentoSucessoInner />
    </Suspense>
  );
}
