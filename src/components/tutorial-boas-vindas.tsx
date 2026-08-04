"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Users,
  Wallet,
  FileText,
  Gift,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { LogoMark } from "@/components/ui/logo";

const CHAVE_TUTORIAL_VISTO = "faturion_tutorial_visto";

/** Chame essa funcao de qualquer lugar do sistema para reabrir o tutorial. */
export function abrirTutorialBoasVindas() {
  window.dispatchEvent(new Event("faturion:abrir-tutorial"));
}

interface Passo {
  icone: React.ElementType;
  corIcone: string;
  bgIcone: string;
  titulo: string;
  texto: string;
}

const passos: Passo[] = [
  {
    icone: LogoMark as unknown as React.ElementType,
    corIcone: "text-white",
    bgIcone: "bg-emerald-600",
    titulo: "Bem-vindo ao FATURION!",
    texto:
      "Vamos te mostrar rapidinho como o sistema funciona. Leva menos de 1 minuto, prometo.",
  },
  {
    icone: TrendingUp,
    corIcone: "text-emerald-600",
    bgIcone: "bg-emerald-100",
    titulo: "Seu lucro, bem simples",
    texto:
      "Logo na primeira tela (Dashboard), um card grande verde ou vermelho já te mostra se você está ganhando ou perdendo dinheiro no mês. Sem precisar entender de contabilidade.",
  },
  {
    icone: Users,
    corIcone: "text-blue-600",
    bgIcone: "bg-blue-100",
    titulo: "Cadastre seus clientes",
    texto:
      "Cliente Fixo é quem paga mensalidade — entra em Receitas sozinho, todo mês, sem você precisar lançar de novo. Cliente Esporádico é um serviço avulso — entra só daquela vez.",
  },
  {
    icone: Wallet,
    corIcone: "text-amber-600",
    bgIcone: "bg-amber-100",
    titulo: "Receitas e Despesas",
    texto:
      "Registre o dinheiro que entra em Receitas e o que sai em Despesas. O sistema calcula sozinho quanto sobrou no fim do mês.",
  },
  {
    icone: FileText,
    corIcone: "text-purple-600",
    bgIcone: "bg-purple-100",
    titulo: "Orçamentos em PDF",
    texto:
      "Monte uma proposta com poucos cliques e mande pro seu cliente pelo WhatsApp, já em PDF, com a sua logo.",
  },
  {
    icone: Gift,
    corIcone: "text-emerald-600",
    bgIcone: "bg-emerald-100",
    titulo: "Pronto pra começar!",
    texto:
      "Convide outros prestadores de serviço em Indique e Ganhe e ganhe dias extras de teste grátis. E se tiver qualquer dúvida, toque em Configurações > Suporte a qualquer momento.",
  },
];

export function TutorialBoasVindas() {
  const [aberto, setAberto] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);

  useEffect(() => {
    const jaViu = localStorage.getItem(CHAVE_TUTORIAL_VISTO) === "true";
    if (!jaViu) {
      const timer = setTimeout(() => setAberto(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    function handleAbrirTutorial() {
      setPassoAtual(0);
      setAberto(true);
    }
    window.addEventListener("faturion:abrir-tutorial", handleAbrirTutorial);
    return () => window.removeEventListener("faturion:abrir-tutorial", handleAbrirTutorial);
  }, []);

  function fechar() {
    localStorage.setItem(CHAVE_TUTORIAL_VISTO, "true");
    setAberto(false);
    setPassoAtual(0);
  }

  function proximo() {
    if (passoAtual < passos.length - 1) {
      setPassoAtual(passoAtual + 1);
    } else {
      fechar();
    }
  }

  function voltar() {
    if (passoAtual > 0) setPassoAtual(passoAtual - 1);
  }

  const passo = passos[passoAtual];
  const Icone = passo.icone;
  const ultimoPasso = passoAtual === passos.length - 1;

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden sm:max-w-md">
        <div className="p-6 pb-4 text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${passo.bgIcone}`}
          >
            <Icone className={`h-8 w-8 ${passo.corIcone}`} />
          </div>
          <h2 className="text-lg font-bold">{passo.titulo}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{passo.texto}</p>
        </div>

        {/* Bolinhas de progresso */}
        <div className="flex items-center justify-center gap-1.5 pb-4">
          {passos.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === passoAtual ? "w-5 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          {passoAtual > 0 ? (
            <Button variant="ghost" size="sm" onClick={voltar}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={fechar}>
              Pular
            </Button>
          )}
          <Button size="sm" onClick={proximo}>
            {ultimoPasso ? (
              <>
                Começar agora
                <PartyPopper className="ml-1.5 h-4 w-4" />
              </>
            ) : (
              <>
                Próximo
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
