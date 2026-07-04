"use client";

import { useState, useEffect, useMemo } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import {
  formatarMoeda,
  formatarData,
  formatarTelefone,
} from "@/utils";
import type { Cliente, Receita } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Calendar,
  StickyNote,
} from "lucide-react";

interface ClienteHistoricoProps {
  clienteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatarEndereco(endereco: Record<string, string | undefined>): string {
  const partes = [
    endereco.rua,
    endereco.numero,
    endereco.complemento,
    endereco.bairro,
    endereco.cidade,
    endereco.estado,
    endereco.cep,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(", ") : "—";
}

function mesesEntre(dataInicio: string, dataFim: Date): number {
  const inicio = new Date(dataInicio);
  return (
    (dataFim.getFullYear() - inicio.getFullYear()) * 12 +
    (dataFim.getMonth() - inicio.getMonth())
  );
}

export function ClienteHistorico({
  clienteId,
  open,
  onOpenChange,
}: ClienteHistoricoProps) {
  const supabase = useSupabase();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!open || !clienteId) {
      setCliente(null);
      setReceitas([]);
      return;
    }

    async function carregarDados() {
      setCarregando(true);
      try {
        const { data: clienteData } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", clienteId!)
          .single();

        const { data: receitasData } = await supabase
          .from("receitas")
          .select("*")
          .eq("cliente_id", clienteId!)
          .order("data", { ascending: false });

        setCliente(clienteData);
        setReceitas(receitasData || []);
      } catch {
        // ignore
      } finally {
        setCarregando(false);
      }
    }

    carregarDados();
  }, [open, clienteId, supabase]);

  const stats = useMemo(() => {
    if (receitas.length === 0) {
      return {
        totalRecebido: 0,
        totalEmAberto: 0,
        tempoCliente: 0,
        maiorAtraso: 0,
        totalPagamentos: 0,
        pagamentosAtraso: 0,
        ticketMedio: 0,
        mesMaiorReceita: "—",
      };
    }

    const pagas = receitas.filter((r) => r.status === "pago");
    const pendentes = receitas.filter(
      (r) => r.status === "pendente" || r.status === "atrasado"
    );

    const totalRecebido = pagas.reduce((acc, r) => acc + r.valor, 0);
    const totalEmAberto = pendentes.reduce((acc, r) => acc + r.valor, 0);

    const primeiraReceita = receitas[receitas.length - 1]?.data;
    const tempoCliente = primeiraReceita
      ? Math.max(mesesEntre(primeiraReceita, new Date()), 1)
      : 0;

    let maiorAtraso = 0;
    for (const r of receitas) {
      if (r.status === "atrasado" || r.status === "pago") {
        const vencimento = r.data_vencimento
          ? new Date(r.data_vencimento)
          : new Date(r.data);
        const pagamento = r.data_pagamento
          ? new Date(r.data_pagamento)
          : new Date();
        const dias = Math.max(
          0,
          Math.floor(
            (pagamento.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        if (dias > maiorAtraso) maiorAtraso = dias;
      }
    }

    const totalPagamentos = pagas.length;
    const pagamentosAtraso = receitas.filter(
      (r) => r.status === "atrasado"
    ).length;
    const ticketMedio = totalPagamentos > 0 ? totalRecebido / totalPagamentos : 0;

    const receitaPorMes: Record<string, number> = {};
    for (const r of pagas) {
      const chave = `${new Date(r.data).getFullYear()}-${String(new Date(r.data).getMonth() + 1).padStart(2, "0")}`;
      receitaPorMes[chave] = (receitaPorMes[chave] || 0) + r.valor;
    }
    let mesMaiorReceita = "—";
    let maiorValor = 0;
    for (const [chave, valor] of Object.entries(receitaPorMes)) {
      if (valor > maiorValor) {
        maiorValor = valor;
        const [ano, mes] = chave.split("-");
        const nomesMes = [
          "Jan",
          "Fev",
          "Mar",
          "Abr",
          "Mai",
          "Jun",
          "Jul",
          "Ago",
          "Set",
          "Out",
          "Nov",
          "Dez",
        ];
        mesMaiorReceita = `${nomesMes[parseInt(mes) - 1]}/${ano}`;
      }
    }

    return {
      totalRecebido,
      totalEmAberto,
      tempoCliente,
      maiorAtraso,
      totalPagamentos,
      pagamentosAtraso,
      ticketMedio,
      mesMaiorReceita,
    };
  }, [receitas]);

  const statusLabel = (status: string) => {
    switch (status) {
      case "pago":
        return "Pago";
      case "pendente":
        return "Pendente";
      case "atrasado":
        return "Atrasado";
      case "cancelado":
        return "Cancelado";
      default:
        return status;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pago":
        return "default";
      case "pendente":
        return "secondary";
      case "atrasado":
        return "destructive";
      case "cancelado":
        return "outline";
      default:
        return "outline";
    }
  };

  const animProps = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          {carregando ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : cliente ? (
            <div className="flex items-center gap-3">
              <SheetTitle className="text-xl">{cliente.nome}</SheetTitle>
              <Badge variant={cliente.is_ativo ? "default" : "destructive"}>
                {cliente.is_ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          ) : null}
        </SheetHeader>

        {carregando ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : cliente ? (
          <div className="space-y-6 mt-2">
            {/* Summary Cards */}
            <motion.div {...animProps}>
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Total Recebido</span>
                    </div>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1">
                      {formatarMoeda(stats.totalRecebido)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-medium">Em Aberto</span>
                    </div>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400 mt-1">
                      {formatarMoeda(stats.totalEmAberto)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs font-medium">Tempo como cliente</span>
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {stats.tempoCliente}{" "}
                      {stats.tempoCliente === 1 ? "mês" : "meses"}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium">Maior atraso</span>
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {stats.maiorAtraso}{" "}
                      {stats.maiorAtraso === 1 ? "dia" : "dias"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>

            {/* Informações */}
            <motion.div {...animProps} transition={{ ...animProps.transition, delay: 0.1 }}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Informações
              </h3>
              <Card>
                <CardContent className="p-4 space-y-3">
                  {cliente.whatsapp && (
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <a
                        href={`https://wa.me/55${cliente.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 hover:underline"
                      >
                        {formatarTelefone(cliente.whatsapp)}
                      </a>
                    </div>
                  )}
                  {cliente.telefone && !cliente.whatsapp && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{formatarTelefone(cliente.telefone)}</span>
                    </div>
                  )}
                  {cliente.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.observacoes && (
                    <div className="flex items-start gap-3">
                      <StickyNote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-sm">{cliente.observacoes}</span>
                    </div>
                  )}
                  {cliente.endereco &&
                    Object.values(cliente.endereco).some(Boolean) && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {formatarEndereco(
                            cliente.endereco as Record<string, string | undefined>
                          )}
                        </span>
                      </div>
                    )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Últimas Receitas */}
            <motion.div {...animProps} transition={{ ...animProps.transition, delay: 0.2 }}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Últimas Receitas
              </h3>
              {receitas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma receita encontrada para este cliente.
                </p>
              ) : (
                <div className="space-y-2">
                  {receitas.slice(0, 10).map((receita) => (
                    <Card key={receita.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {receita.descricao}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatarData(receita.data)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <span className="text-sm font-semibold">
                              {formatarMoeda(receita.valor)}
                            </span>
                            <Badge
                              variant={statusVariant(receita.status)}
                              className="text-xs"
                            >
                              {statusLabel(receita.status)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>

            <Separator />

            {/* Estatísticas */}
            <motion.div {...animProps} transition={{ ...animProps.transition, delay: 0.3 }}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Estatísticas
              </h3>
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total de pagamentos</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {stats.totalPagamentos}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pagamentos em atraso</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {stats.pagamentosAtraso}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ticket médio</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {formatarMoeda(stats.ticketMedio)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mês com maior receita</p>
                      <p className="text-sm font-semibold mt-0.5">
                        {stats.mesMaiorReceita}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
