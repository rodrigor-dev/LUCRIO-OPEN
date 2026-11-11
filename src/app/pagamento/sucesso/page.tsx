"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

/**
 * Página para onde a Cakto redireciona depois do pagamento.
 *
 * Ela NÃO libera nada sozinha: quem libera é o webhook da Cakto, no
 * servidor. Aqui só acompanhamos a assinatura até ela ficar ativa —
 * com Pix/cartão costuma levar poucos segundos; boleto pode levar dias.
 */
const INTERVALO_MS = 3000;
const TEMPO_MAXIMO_MS = 90_000;

type Estado = "verificando" | "ativo" | "aguardando";

export default function PagamentoSucesso() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const inicio = useRef(Date.now());

  const verificar = useCallback(async (): Promise<boolean> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?redirect=/pagamento/sucesso");
      return true;
    }

    const { data } = await supabase
      .from("assinaturas")
      .select("status, fim_periodo, ultimo_pagamento")
      .eq("usuario_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ativo =
      data?.status === "ativo" &&
      !!data.fim_periodo &&
      new Date(data.fim_periodo).getTime() > Date.now();

    if (ativo) {
      setEstado("ativo");
      return true;
    }
    return false;
  }, [router]);

  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;

    async function loop() {
      if (cancelado) return;
      let terminou = false;
      try {
        terminou = await verificar();
      } catch (erro) {
        console.error("[pagamento/sucesso] erro ao verificar assinatura:", erro);
      }
      if (cancelado || terminou) return;

      if (Date.now() - inicio.current > TEMPO_MAXIMO_MS) {
        setEstado("aguardando");
        return;
      }
      timer = setTimeout(loop, INTERVALO_MS);
    }

    loop();
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [verificar]);

  if (estado === "verificando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="font-medium">Confirmando seu pagamento...</p>
            <p className="text-sm text-muted-foreground">
              Isso costuma levar poucos segundos. Pode deixar esta página aberta.
            </p>
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
            {estado === "ativo" ? (
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
                  Seu plano PRO foi ativado. Aproveite todas as funcionalidades do FATURION!
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
                <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-center">Aguardando confirmação</h1>
                <p className="text-muted-foreground text-center">
                  Ainda não recebemos a confirmação do pagamento. Se você pagou por Pix ou
                  cartão, deve liberar em instantes; boleto pode levar até 3 dias úteis.
                  Assim que for confirmado, seu acesso é liberado automaticamente.
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      inicio.current = Date.now();
                      setEstado("verificando");
                      verificar().then((ok) => {
                        if (!ok) setEstado("aguardando");
                      });
                    }}
                  >
                    Verificar de novo
                  </Button>
                  <Link href="/dashboard">
                    <Button>Ir para o Dashboard</Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
