"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, PartyPopper, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { obterChecklistOnboarding, type ItemChecklist } from "@/services/onboarding.service";

interface ChecklistOnboardingProps {
  negocioId: string;
  usuarioId: string;
}

const CHAVE_DISPENSADO = "faturion_onboarding_dispensado";

export function ChecklistOnboarding({ negocioId, usuarioId }: ChecklistOnboardingProps) {
  const [itens, setItens] = useState<ItemChecklist[] | null>(null);
  const [dispensado, setDispensado] = useState(true);

  useEffect(() => {
    setDispensado(localStorage.getItem(CHAVE_DISPENSADO) === "true");

    obterChecklistOnboarding(negocioId, usuarioId)
      .then(setItens)
      .catch((erro) => console.error("[onboarding] erro ao carregar checklist:", erro));
  }, [negocioId, usuarioId]);

  if (dispensado || !itens) return null;

  const pendentes = itens.filter((item) => !item.completo);
  const totalConcluidos = itens.length - pendentes.length;
  const tudoCompleto = pendentes.length === 0;

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, "true");
    setDispensado(true);
  }

  if (tudoCompleto) {
    return (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <PartyPopper className="h-5 w-5 shrink-0 text-emerald-600" />
              <p className="truncate text-sm font-medium text-emerald-800">
                Você já conhece todas as principais funções do FATURION.
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dispensar}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden border-primary/20">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">Primeiros passos no FATURION</p>
              <p className="text-xs text-muted-foreground">
                {totalConcluidos} de {itens.length} concluídos
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dispensar}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(totalConcluidos / itens.length) * 100}%` }}
            />
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {pendentes.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent/50"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.descricao}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
