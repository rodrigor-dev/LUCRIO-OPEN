"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Filter,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface Movimentacao {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  data: string;
  status: string;
}

const PERIODOS = [
  { value: "mes_atual", label: "Mês Atual" },
  { value: "ultimos_3", label: "Últimos 3 meses" },
  { value: "ultimos_6", label: "Últimos 6 meses" },
  { value: "este_ano", label: "Este Ano" },
];

function obterDataInicio(periodo: string): Date {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);

  switch (periodo) {
    case "mes_atual":
      return inicio;
    case "ultimos_3":
      return new Date(agora.getFullYear(), agora.getMonth() - 2, 1);
    case "ultimos_6":
      return new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
    case "este_ano":
      return new Date(agora.getFullYear(), 0, 1);
    default:
      return inicio;
  }
}

export default function FluxoCaixaPage() {
  const supabase = createClient();
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState("mes_atual");

  const carregarDados = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) return;

      const dataInicio = obterDataInicio(periodo).toISOString().split("T")[0];

      const [receitasRes, despesasRes] = await Promise.all([
        supabase
          .from("receitas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .gte("data", dataInicio)
          .order("data", { ascending: false }),
        supabase
          .from("despesas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .gte("data", dataInicio)
          .order("data", { ascending: false }),
      ]);

      if (receitasRes.error || despesasRes.error) {
        toast.error("Erro ao carregar fluxo de caixa");
        return;
      }

      const entradas: Movimentacao[] = (receitasRes.data || []).map((r) => ({
        id: r.id,
        tipo: "entrada" as const,
        descricao: r.descricao,
        valor: r.valor,
        data: r.data,
        status: r.status,
      }));

      const saidas: Movimentacao[] = (despesasRes.data || []).map((d) => ({
        id: d.id,
        tipo: "saida" as const,
        descricao: d.descricao,
        valor: d.valor,
        data: d.data,
        status: d.status,
      }));

      const todasMovimentacoes = [...entradas, ...saidas].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setMovimentacoes(todasMovimentacoes);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }, [supabase, periodo]);

  useEffect(() => {
    setCarregando(true);
    carregarDados();
  }, [carregarDados]);

  const totalEntradas = movimentacoes
    .filter((m) => m.tipo === "entrada" && m.status === "pago")
    .reduce((acc, m) => acc + m.valor, 0);

  const totalSaidas = movimentacoes
    .filter((m) => m.tipo === "saida" && m.status === "pago")
    .reduce((acc, m) => acc + m.valor, 0);

  const saldo = totalEntradas - totalSaidas;

  let saldoAcumulado = 0;
  const saldoPorData = new Map<string, number>();
  const ordenadas = [...movimentacoes].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );
  for (const m of ordenadas) {
    if (m.status === "pago") {
      saldoAcumulado += m.tipo === "entrada" ? m.valor : -m.valor;
    }
    saldoPorData.set(m.id, saldoAcumulado);
  }

  const movimentacoesComSaldo = movimentacoes.map((m) => ({
    ...m,
    saldoAcumulado: saldoPorData.get(m.id) ?? 0,
  }));

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wallet className="h-6 w-6 text-violet-600" />
            Fluxo de Caixa
          </h1>
          <p className="text-muted-foreground">
            Acompanhe suas entradas e saídas financeiras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {carregando ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="space-y-4 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatarMoeda(totalEntradas)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {movimentacoes.filter((m) => m.tipo === "entrada" && m.status === "pago").length} transação(ões)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
                <ArrowDownRight className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatarMoeda(totalSaidas)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {movimentacoes.filter((m) => m.tipo === "saida" && m.status === "pago").length} transação(ões)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo</CardTitle>
                <DollarSign className={`h-4 w-4 ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatarMoeda(saldo)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Entradas - Saídas (pago)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro</CardTitle>
                <TrendingUp className={`h-4 w-4 ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatarMoeda(saldo)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalEntradas > 0 ? `${((saldo / totalEntradas) * 100).toFixed(1)}%` : "—"} margem
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {movimentacoesComSaldo.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Wallet className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mb-2 text-lg font-semibold">Nenhuma movimentação encontrada</h3>
                  <p className="text-center text-sm text-muted-foreground">
                    Não há transações no período selecionado
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Filter className="h-4 w-4" />
                    Movimentações
                    <Badge variant="secondary" className="ml-auto">
                      {movimentacoesComSaldo.length} registro(s)
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimentacoesComSaldo.map((mov, index) => (
                          <motion.tr
                            key={mov.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell className="text-muted-foreground">
                              {new Intl.DateTimeFormat("pt-BR").format(new Date(mov.data))}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                    mov.tipo === "entrada"
                                      ? "bg-emerald-100 text-emerald-600"
                                      : "bg-red-100 text-red-600"
                                  }`}
                                >
                                  {mov.tipo === "entrada" ? (
                                    <TrendingUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <TrendingDown className="h-3.5 w-3.5" />
                                  )}
                                </div>
                                <span className="font-medium truncate max-w-[200px]">{mov.descricao}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={mov.tipo === "entrada" ? "default" : "destructive"}
                              >
                                {mov.tipo === "entrada" ? "Entrada" : "Saída"}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${mov.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                              {mov.tipo === "entrada" ? "+" : "-"} {formatarMoeda(mov.valor)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${mov.saldoAcumulado >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {formatarMoeda(mov.saldoAcumulado)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={mov.status === "pago" ? "default" : "secondary"}>
                                {mov.status === "pago" ? "Pago" : "Pendente"}
                              </Badge>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid gap-3 p-4 md:hidden">
                    {movimentacoesComSaldo.map((mov, index) => (
                      <motion.div
                        key={mov.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="rounded-lg border bg-card p-4 shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-sm text-muted-foreground">
                            {new Intl.DateTimeFormat("pt-BR").format(new Date(mov.data))}
                          </span>
                          <Badge
                            variant={mov.tipo === "entrada" ? "default" : "destructive"}
                          >
                            {mov.tipo === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              mov.tipo === "entrada"
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {mov.tipo === "entrada" ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                          </div>
                          <span className="font-medium">{mov.descricao}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t">
                          <span className={`text-lg font-bold ${mov.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                            {mov.tipo === "entrada" ? "+" : "-"} {formatarMoeda(mov.valor)}
                          </span>
                          <span className={`text-sm font-medium ${mov.saldoAcumulado >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            Saldo: {formatarMoeda(mov.saldoAcumulado)}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <Badge variant={mov.status === "pago" ? "default" : "secondary"}>
                            {mov.status === "pago" ? "Pago" : "Pendente"}
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}