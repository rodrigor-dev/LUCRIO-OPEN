"use client";

import { CalendarCheck, CalendarClock, Crown, RefreshCw, AlertTriangle, Infinity as InfinityIcon } from "lucide-react";
import type { Assinatura } from "@/types/database";
import { assinaturaLiberaAcesso } from "@/lib/assinatura-acesso";
import { formatarMoeda } from "@/utils";

const DIA = 24 * 60 * 60 * 1000;
export const PRECO_MENSAL = 14.99;
export const PRECO_ANUAL = 139.99;

const formatarData = (d: Date) => d.toLocaleDateString("pt-BR");

/** Informações calculadas da assinatura, usadas na tela de Configurações. */
export function analisarAssinatura(a: Assinatura | null | undefined, agora = new Date()) {
  if (!a) {
    return { temAcesso: false, renovaAutomatico: false, diasRestantes: 0, vitalicio: false } as const;
  }
  const temAcesso = assinaturaLiberaAcesso(a, agora);
  const fim = a.fim_periodo ? new Date(a.fim_periodo) : null;
  const diasRestantes = fim ? Math.ceil((fim.getTime() - agora.getTime()) / DIA) : 0;
  const vitalicio = !!fim && fim.getTime() - agora.getTime() > 2 * 365 * DIA;
  const renovaAutomatico =
    a.metodo_pagamento_id === "cakto" &&
    (a.status === "ativo" || a.status === "atrasado") &&
    !a.cancelar_ao_fim_periodo;
  return { temAcesso, renovaAutomatico, diasRestantes, vitalicio } as const;
}

function tipoDoPlano(a: Assinatura): "mensal" | "anual" | null {
  if (!a.ultimo_pagamento || !(a.proximo_pagamento || a.fim_periodo)) return null;
  const inicio = new Date(a.ultimo_pagamento).getTime();
  const fim = new Date(a.proximo_pagamento || a.fim_periodo).getTime();
  return fim - inicio > 200 * DIA ? "anual" : "mensal";
}

function Linha({ icone: Icone, rotulo, valor, detalhe }: { icone: typeof Crown; rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        <p className="text-sm font-medium">{valor}</p>
        {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
      </div>
    </div>
  );
}

export default function ResumoAssinatura({ assinatura }: { assinatura: Assinatura | null }) {
  if (!assinatura || assinatura.status === "incompleto") {
    return (
      <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        Você ainda não tem uma assinatura. Escolha um plano abaixo para liberar o acesso.
      </div>
    );
  }

  const a = assinatura;
  const { temAcesso, renovaAutomatico, diasRestantes, vitalicio } = analisarAssinatura(a);
  const fim = new Date(a.fim_periodo);
  const emTeste = a.status === "trial";
  const cancelada = a.status === "cancelado" || !!a.cancelar_ao_fim_periodo;
  const tipo = tipoDoPlano(a);

  // Selo de situação
  let selo = { texto: "Ativa", classe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" };
  if (!temAcesso) selo = { texto: "Vencida", classe: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" };
  else if (emTeste) selo = { texto: "Teste grátis", classe: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" };
  else if (cancelada) selo = { texto: "Cancelada", classe: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" };
  else if (a.status === "atrasado") selo = { texto: "Pagamento pendente", classe: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" };

  // Barra de tempo restante
  // Com pagamento registrado mede desde ele; sem isso, considera um mês de 30 dias
  const total = a.ultimo_pagamento
    ? Math.max(DIA, fim.getTime() - new Date(a.ultimo_pagamento).getTime())
    : emTeste
    ? 7 * DIA
    : 30 * DIA;
  const restante = Math.max(0, fim.getTime() - Date.now());
  const porcentagem = Math.min(100, Math.max(4, (restante / total) * 100));
  const acabando = temAcesso && !vitalicio && diasRestantes <= 5;

  const textoDias =
    diasRestantes <= 0 ? "termina hoje" : diasRestantes === 1 ? "falta 1 dia" : `faltam ${diasRestantes} dias`;

  const nomePlano = emTeste
    ? "Teste grátis do Plano Pro"
    : tipo === "anual"
    ? `Pro Anual · ${formatarMoeda(PRECO_ANUAL)} por ano`
    : tipo === "mensal"
    ? `Pro Mensal · ${formatarMoeda(PRECO_MENSAL)} por mês`
    : vitalicio
    ? "Plano Pro · acesso cortesia"
    : "Plano Pro";

  return (
    <div className="space-y-4">
      {/* Destaque: até quando vale */}
      <div
        className={`rounded-xl border p-4 ${
          !temAcesso
            ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
            : acabando || cancelada || emTeste
            ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {vitalicio ? (
              <>
                <p className="text-xs font-medium text-muted-foreground">Seu acesso</p>
                <p className="flex items-center gap-2 text-xl font-bold">
                  <InfinityIcon className="h-5 w-5" /> Sem data para acabar
                </p>
              </>
            ) : temAcesso ? (
              <>
                <p className="text-xs font-medium text-muted-foreground">
                  {emTeste ? "Teste grátis até" : "Acesso liberado até"}
                </p>
                <p className="text-2xl font-bold tracking-tight">{formatarData(fim)}</p>
                <p className="text-sm font-medium">{textoDias}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Seu acesso venceu em</p>
                <p className="text-2xl font-bold tracking-tight text-red-700 dark:text-red-400">{formatarData(fim)}</p>
                <p className="text-sm text-red-700/80 dark:text-red-400/80">Escolha um plano abaixo para voltar a usar.</p>
              </>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${selo.classe}`}>{selo.texto}</span>
        </div>
        {temAcesso && !vitalicio && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className={`h-full rounded-full ${acabando || cancelada || emTeste ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${porcentagem}%` }}
            />
          </div>
        )}
      </div>

      {/* Detalhes */}
      <div className="divide-y rounded-xl border px-4">
        <Linha icone={Crown} rotulo="Plano" valor={nomePlano} />

        {a.ultimo_pagamento && (
          <Linha icone={CalendarCheck} rotulo="Último pagamento" valor={formatarData(new Date(a.ultimo_pagamento))} />
        )}

        {temAcesso && !vitalicio && renovaAutomatico && (
          <Linha
            icone={RefreshCw}
            rotulo="Próxima cobrança"
            valor={formatarData(new Date(a.proximo_pagamento || a.fim_periodo))}
            detalhe="Renovação automática. Ao ser paga, o acesso é estendido sozinho."
          />
        )}

        {temAcesso && !vitalicio && !renovaAutomatico && !cancelada && !emTeste && (
          <Linha
            icone={CalendarClock}
            rotulo="Renovação"
            valor="Sem cobrança automática"
            detalhe={`Para continuar depois de ${formatarData(fim)}, renove o plano aqui antes dessa data.`}
          />
        )}

        {temAcesso && emTeste && (
          <Linha
            icone={CalendarClock}
            rotulo="Depois do teste"
            valor="Nenhuma cobrança automática"
            detalhe="Para continuar usando, escolha um plano abaixo antes do fim do teste."
          />
        )}

        {temAcesso && cancelada && !emTeste && (
          <Linha
            icone={AlertTriangle}
            rotulo="Renovação"
            valor="Cancelada: não haverá nova cobrança"
            detalhe={`Você continua usando até ${formatarData(fim)}. Depois disso o acesso é bloqueado.`}
          />
        )}
      </div>
    </div>
  );
}
