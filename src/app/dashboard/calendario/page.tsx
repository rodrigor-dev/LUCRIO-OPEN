"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { STATUS_LABELS } from "@/lib/constants";
import type { Receita, Despesa } from "@/types/database";
import { formatarMoeda } from "@/utils";
import { marcarComoPago, desmarcarPago } from "@/services/status.service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type CalendarioEvento = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  data: string;
  data_vencimento?: string;
  status: string;
  forma_pagamento?: string;
};

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pago: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pendente: "bg-yellow-100 text-yellow-700 border-yellow-200",
  atrasado: "bg-red-100 text-red-700 border-red-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200",
};

function obterDiasDoMes(ano: number, mes: number): Date[] {
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const dias: Date[] = [];

  let diaSemana = primeiroDia.getDay();
  if (diaSemana === 0) diaSemana = 7;
  const diasAnteriores = diaSemana - 1;

  for (let i = diasAnteriores; i > 0; i--) {
    dias.push(new Date(ano, mes, 1 - i));
  }

  for (let d = 1; d <= ultimoDia.getDate(); d++) {
    dias.push(new Date(ano, mes, d));
  }

  const diasRestantes = dias.length % 7;
  if (diasRestantes !== 0) {
    for (let i = 1; i <= 7 - diasRestantes; i++) {
      dias.push(new Date(ano, mes + 1, i));
    }
  }

  return dias;
}

function formatoDataKey(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatarMoedaShort(valor: number): string {
  if (Math.abs(valor) >= 1000) {
    return `${(valor / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function CalendarioPage() {
  const supabase = useSupabase();
  const [carregando, setCarregando] = useState(true);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());

  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);

  const carregarDados = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCarregando(false);
        return;
      }

      const { data: negocio, error: negocioError } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (negocioError || !negocio) {
        setCarregando(false);
        return;
      }

      const inicioMes = new Date(anoAtual, mesAtual, 1)
        .toISOString()
        .split("T")[0];
      const fimMes = new Date(anoAtual, mesAtual + 1, 0)
        .toISOString()
        .split("T")[0];

      const [receitasRes, despesasRes] = await Promise.all([
        supabase
          .from("receitas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .or(
            `and(data.gte.${inicioMes},data.lte.${fimMes}),and(data_vencimento.gte.${inicioMes},data_vencimento.lte.${fimMes})`
          )
          .order("data_vencimento", { ascending: true }),
        supabase
          .from("despesas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .or(
            `and(data.gte.${inicioMes},data.lte.${fimMes}),and(data_vencimento.gte.${inicioMes},data_vencimento.lte.${fimMes})`
          )
          .order("data_vencimento", { ascending: true }),
      ]);

      if (receitasRes.error) {
        console.error("Erro ao carregar receitas:", receitasRes.error);
        toast.error("Erro ao carregar receitas do calendário");
      } else {
        setReceitas(receitasRes.data || []);
      }

      if (despesasRes.error) {
        console.error("Erro ao carregar despesas:", despesasRes.error);
        toast.error("Erro ao carregar despesas do calendário");
      } else {
        setDespesas(despesasRes.data || []);
      }
    } catch (err) {
      console.error("Erro inesperado ao carregar calendário:", err);
      toast.error("Erro inesperado ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }, [supabase, mesAtual, anoAtual]);

  useEffect(() => {
    setCarregando(true);
    carregarDados();
  }, [carregarDados]);

  const eventosPorDia = useMemo(() => {
    const mapa: Record<string, CalendarioEvento[]> = {};

    if (Array.isArray(receitas)) {
      receitas.forEach((r) => {
        try {
          const chave = formatoDataKey(
            new Date(r.data_vencimento || r.data)
          );
          if (!mapa[chave]) mapa[chave] = [];
          mapa[chave].push({
            id: r.id,
            tipo: "receita",
            descricao: r.descricao,
            valor: r.valor,
            data: r.data,
            data_vencimento: r.data_vencimento,
            status: r.status,
            forma_pagamento: r.forma_pagamento,
          });
        } catch {
          // skip invalid dates
        }
      });
    }

    if (Array.isArray(despesas)) {
      despesas.forEach((d) => {
        try {
          const chave = formatoDataKey(
            new Date(d.data_vencimento || d.data)
          );
          if (!mapa[chave]) mapa[chave] = [];
          mapa[chave].push({
            id: d.id,
            tipo: "despesa",
            descricao: d.descricao,
            valor: d.valor,
            data: d.data,
            data_vencimento: d.data_vencimento,
            status: d.status,
            forma_pagamento: d.forma_pagamento,
          });
        } catch {
          // skip invalid dates
        }
      });
    }

    return mapa;
  }, [receitas, despesas]);

  const diasDoMes = useMemo(
    () => obterDiasDoMes(anoAtual, mesAtual),
    [anoAtual, mesAtual]
  );

  const mesAnterior = () => {
    if (mesAtual === 0) {
      setMesAtual(11);
      setAnoAtual(anoAtual - 1);
    } else {
      setMesAtual(mesAtual - 1);
    }
  };

  const proximoMes = () => {
    if (mesAtual === 11) {
      setMesAtual(0);
      setAnoAtual(anoAtual + 1);
    } else {
      setMesAtual(mesAtual + 1);
    }
  };

  const irParaHoje = () => {
    setMesAtual(hoje.getMonth());
    setAnoAtual(hoje.getFullYear());
  };

  const nomeMes = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(anoAtual, mesAtual, 1));

  function abrirDia(dia: Date) {
    setDiaSelecionado(dia);
    setSheetAberto(true);
  }

  async function handleMarcarPago(evento: CalendarioEvento) {
    try {
      const tabela = evento.tipo === "receita" ? "receitas" : "despesas";
      await marcarComoPago(tabela, evento.id);
      toast.success(
        `${evento.tipo === "receita" ? "Receita" : "Despesa"} marcada como paga!`
      );
      carregarDados();
    } catch {
      toast.error("Erro ao marcar como pago");
    }
  }

  async function handleDesmarcarPago(evento: CalendarioEvento) {
    try {
      const tabela = evento.tipo === "receita" ? "receitas" : "despesas";
      await desmarcarPago(tabela, evento.id);
      toast.success("Pagamento desmarcado");
      carregarDados();
    } catch {
      toast.error("Erro ao desmarcar pagamento");
    }
  }

  const eventosDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return [];
    const chave = formatoDataKey(diaSelecionado);
    return eventosPorDia[chave] || [];
  }, [diaSelecionado, eventosPorDia]);

  const temAtrasadoNoDia = (dia: Date) => {
    const chave = formatoDataKey(dia);
    const eventos = eventosPorDia[chave] || [];
    return eventos.some((e) => e.status === "atrasado");
  };

  const temVencimentoNoDia = (dia: Date) => {
    const chave = formatoDataKey(dia);
    const eventos = eventosPorDia[chave] || [];
    return eventos.some((e) => e.status === "pendente");
  };

  const resumoDia = (dia: Date) => {
    const chave = formatoDataKey(dia);
    const eventos = eventosPorDia[chave] || [];
    if (eventos.length === 0) return null;

    const totalReceita = eventos
      .filter((e) => e.tipo === "receita")
      .reduce((acc, e) => acc + e.valor, 0);
    const totalDespesa = eventos
      .filter((e) => e.tipo === "despesa")
      .reduce((acc, e) => acc + e.valor, 0);

    return { totalReceita, totalDespesa, total: eventos.length };
  };

  const temEventosNoMes = Object.keys(eventosPorDia).length > 0;

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-3 py-3 sm:px-4 sm:py-4">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl">
              <CalendarDays className="h-5 w-5 text-violet-600" />
              Calendario
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Visao financeira do mes
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={irParaHoje}
            className="text-xs"
          >
            Hoje
          </Button>
        </div>
      </div>

      <div className="px-2 pt-3 sm:px-4 sm:pt-4">
        {carregando ? (
          <div className="space-y-3 sm:space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Month Navigation */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between mb-3 sm:mb-4"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10"
                onClick={mesAnterior}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <h2 className="text-base font-bold capitalize sm:text-lg">
                  {nomeMes}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10"
                onClick={proximoMes}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </motion.div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1 sm:gap-1">
              {DIAS_SEMANA.map((dia) => (
                <div
                  key={dia}
                  className="text-center text-[10px] font-semibold text-muted-foreground py-1.5 sm:py-2 sm:text-xs"
                >
                  {dia}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-7 gap-0.5 sm:gap-1"
            >
              {diasDoMes.map((dia, idx) => {
                const isMesAtual = dia.getMonth() === mesAtual;
                const isHoje =
                  dia.getDate() === hoje.getDate() &&
                  dia.getMonth() === hoje.getMonth() &&
                  dia.getFullYear() === hoje.getFullYear();
                const temAtrasado = temAtrasadoNoDia(dia);
                const temVencimento = temVencimentoNoDia(dia);
                const resumo = resumoDia(dia);
                const eventos = eventosPorDia[formatoDataKey(dia)] || [];
                const temEventos = eventos.length > 0;

                const receitaDots = eventos.filter(
                  (e) => e.tipo === "receita"
                ).length;
                const despesaDots = eventos.filter(
                  (e) => e.tipo === "despesa"
                ).length;
                const vencimentoDots = eventos.filter(
                  (e) => e.status === "pendente"
                ).length;

                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.008 }}
                    onClick={() => temEventos && abrirDia(dia)}
                    className={`
                      relative flex flex-col items-center rounded-md p-0.5 min-h-[48px] sm:min-h-[72px] transition-all
                      ${
                        !isMesAtual
                          ? "text-muted-foreground/40"
                          : "text-foreground"
                      }
                      ${
                        temAtrasado
                          ? "bg-red-50 border border-red-200"
                          : isMesAtual
                            ? "border border-transparent hover:border-border"
                            : "border border-transparent"
                      }
                      ${isHoje ? "ring-2 ring-violet-500 ring-offset-1" : ""}
                      ${temEventos ? "cursor-pointer" : "cursor-default"}
                    `}
                  >
                    <span
                      className={`
                        text-[10px] sm:text-sm font-medium
                        ${isHoje ? "flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-violet-600 text-white" : ""}
                      `}
                    >
                      {dia.getDate()}
                    </span>

                    {/* Event dots */}
                    {temEventos && isMesAtual && (
                      <div className="flex flex-col items-center gap-0 mt-0.5">
                        <div className="flex gap-0.5 flex-wrap justify-center">
                          {Array.from({ length: Math.min(receitaDots, 3) }).map(
                            (_, i) => (
                              <span
                                key={`r${i}`}
                                className="h-1 w-1 rounded-full bg-emerald-500 sm:h-1.5 sm:w-1.5"
                              />
                            )
                          )}
                          {Array.from({ length: Math.min(despesaDots, 3) }).map(
                            (_, i) => (
                              <span
                                key={`d${i}`}
                                className="h-1 w-1 rounded-full bg-red-500 sm:h-1.5 sm:w-1.5"
                              />
                            )
                          )}
                          {Array.from({
                            length: Math.min(vencimentoDots, 3),
                          }).map((_, i) => (
                            <span
                              key={`v${i}`}
                              className="h-1 w-1 rounded-full bg-yellow-400 sm:h-1.5 sm:w-1.5"
                            />
                          ))}
                        </div>
                        {resumo && (
                          <span className="text-[8px] sm:text-[10px] font-medium leading-none text-muted-foreground truncate max-w-full hidden sm:block">
                            {resumo.totalReceita > 0 && resumo.totalDespesa > 0
                              ? `${formatarMoedaShort(resumo.totalReceita - resumo.totalDespesa)}`
                              : resumo.totalReceita > 0
                                ? `+${formatarMoedaShort(resumo.totalReceita)}`
                                : `-${formatarMoedaShort(resumo.totalDespesa)}`}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Empty state */}
            {!temEventosNoMes && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <CalendarDays className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum evento este mes
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Receitas e despesas aparecerao aqui
                </p>
              </motion.div>
            )}

            {/* Legend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-3 mt-4 text-[10px] text-muted-foreground sm:gap-4 sm:text-xs"
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Receita
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Despesa
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                Vencimento
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-200 border border-red-300" />
                Atrasado
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Day Detail Sheet */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[80vh] overflow-y-auto"
        >
          {diaSelecionado && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="text-left text-lg">
                  {new Intl.DateTimeFormat("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(diaSelecionado)}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {eventosDiaSelecionado.length === 0
                    ? "Nenhum evento neste dia"
                    : `${eventosDiaSelecionado.length} evento(s) encontrado(s)`}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-2 py-4">
                <AnimatePresence mode="popLayout">
                  {eventosDiaSelecionado.map((evento, index) => (
                    <motion.div
                      key={evento.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4"
                    >
                      {/* Type Icon */}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${
                          evento.tipo === "receita"
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {evento.tipo === "receita" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {evento.descricao}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              STATUS_BADGE_CLASSES[evento.status] ||
                              STATUS_BADGE_CLASSES.pendente
                            }`}
                          >
                            {STATUS_LABELS[evento.status] || evento.status}
                          </span>
                          {evento.forma_pagamento && (
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {evento.forma_pagamento}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Value + Action */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`text-sm font-bold ${
                            evento.tipo === "receita"
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {evento.tipo === "receita" ? "+" : "-"}
                          {formatarMoeda(evento.valor)}
                        </span>
                        {evento.status !== "pago" &&
                          evento.status !== "cancelado" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleMarcarPago(evento)}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Pago
                            </Button>
                          )}
                        {evento.status === "pago" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-muted-foreground"
                            onClick={() => handleDesmarcarPago(evento)}
                          >
                            Desmarcar
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {eventosDiaSelecionado.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <CalendarDays className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Nenhuma receita ou despesa para este dia
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
