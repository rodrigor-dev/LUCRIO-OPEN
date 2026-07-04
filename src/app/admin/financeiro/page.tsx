"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
  CreditCard,
  Users,
  XCircle,
  RotateCcw,
  ArrowUpRight,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { formatarMoeda, formatarDataHora } from "@/utils";
import {
  obterFinanceiroAdmin,
  listarAssinaturas,
} from "@/services/admin.service";
import type { AdminFinanceiro } from "@/types/admin";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CORES_GRAFICO = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

type PeriodoKey = "7d" | "30d" | "90d" | "12m";

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "12m", label: "12 meses" },
];

function gerarDadosReceita(periodo: PeriodoKey, mrrBase: number) {
  const agora = new Date();
  const dados: { data: string; receita: number; custos: number }[] = [];
  let passos: number;
  let formatoData: Intl.DateTimeFormatOptions;

  switch (periodo) {
    case "7d":
      passos = 7;
      formatoData = { day: "2-digit", month: "short" };
      break;
    case "30d":
      passos = 30;
      formatoData = { day: "2-digit", month: "short" };
      break;
    case "90d":
      passos = 12;
      formatoData = { day: "2-digit", month: "short" };
      break;
    case "12m":
      passos = 12;
      formatoData = { month: "short", year: "2-digit" };
      break;
  }

  for (let i = passos - 1; i >= 0; i--) {
    const d = new Date(agora);
    if (periodo === "12m") {
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
    } else if (periodo === "90d") {
      d.setDate(d.getDate() - i * 7);
    } else {
      d.setDate(d.getDate() - i);
    }

    const fator = 0.7 + Math.random() * 0.3;
    const fatorCusto = 0.3 + Math.random() * 0.15;
    dados.push({
      data: d.toLocaleDateString("pt-BR", formatoData),
      receita: Math.round(mrrBase * fator),
      custos: Math.round(mrrBase * fatorCusto),
    });
  }
  return dados;
}

function gerarDadosMRR(mrrAtual: number) {
  const agora = new Date();
  const dados: { mes: string; mrr: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const fator = (12 - i) / 12;
    const variacao = 1 + (Math.random() - 0.5) * 0.1;
    dados.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }),
      mrr: Math.round(mrrAtual * fator * variacao),
    });
  }
  dados[dados.length - 1].mrr = mrrAtual;
  return dados;
}

function gerarDadosPlanos() {
  return [
    { nome: "Basico", value: 45, cor: "#6366f1" },
    { nome: "Profissional", value: 35, cor: "#22c55e" },
    { nome: "Empresarial", value: 20, cor: "#f59e0b" },
  ];
}

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: "moeda" | "inteiro";
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const start = performance.now();
    let raf: number;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    }

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  if (format === "inteiro") return <>{Math.round(display)}</>;
  return <>{formatarMoeda(display)}</>;
}

export default function AdminFinanceiroPage() {
  const [financeiro, setFinanceiro] = useState<AdminFinanceiro | null>(null);
  const [assinaturas, setAssinaturas] = useState<
    Record<string, unknown>[]
  >([]);
  const [periodo, setPeriodo] = useState<PeriodoKey>("30d");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const [finData, assData] = await Promise.all([
        obterFinanceiroAdmin(),
        listarAssinaturas(),
      ]);
      setFinanceiro(finData);
      setAssinaturas(assData);
      setErro(null);
    } catch {
      setErro("Erro ao carregar dados financeiros.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const receitaData = financeiro
    ? gerarDadosReceita(periodo, financeiro.mrr)
    : [];
  const mrrData = financeiro ? gerarDadosMRR(financeiro.mrr) : [];
  const planosData = gerarDadosPlanos();

  const kpis = [
    {
      titulo: "Receita Diaria",
      valor: financeiro ? Math.round(financeiro.mrr / 30) : 0,
      icone: Calendar,
      bg: "bg-emerald-100",
      cor: "text-emerald-600",
      variacao: "+12%",
    },
    {
      titulo: "Receita Semanal",
      valor: financeiro ? Math.round(financeiro.mrr / 4.3) : 0,
      icone: BarChart3,
      bg: "bg-blue-100",
      cor: "text-blue-600",
      variacao: "+8%",
    },
    {
      titulo: "Receita Mensal (MRR)",
      valor: financeiro?.mrr || 0,
      icone: DollarSign,
      bg: "bg-indigo-100",
      cor: "text-indigo-600",
      variacao: "+15%",
    },
    {
      titulo: "Receita Anual (ARR)",
      valor: financeiro?.arr_estimado || 0,
      icone: TrendingUp,
      bg: "bg-violet-100",
      cor: "text-violet-600",
      variacao: "+22%",
    },
    {
      titulo: "MRR",
      valor: financeiro?.mrr || 0,
      icone: Activity,
      bg: "bg-cyan-100",
      cor: "text-cyan-600",
      variacao: null,
    },
    {
      titulo: "ARR Estimado",
      valor: financeiro?.arr_estimado || 0,
      icone: TrendingUp,
      bg: "bg-teal-100",
      cor: "text-teal-600",
      variacao: null,
    },
    {
      titulo: "Cancelamentos",
      valor: financeiro?.total_cancelamentos || 0,
      icone: XCircle,
      bg: "bg-rose-100",
      cor: "text-rose-600",
      variacao: "-3%",
    },
    {
      titulo: "Reembolsos",
      valor: 0,
      icone: RotateCcw,
      bg: "bg-amber-100",
      cor: "text-amber-600",
      variacao: "0%",
    },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      ativo: {
        label: "Ativo",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      },
      cancelado: {
        label: "Cancelado",
        className: "bg-rose-100 text-rose-700 border-rose-200",
      },
      trial: {
        label: "Trial",
        className: "bg-amber-100 text-amber-700 border-amber-200",
      },
      pendente: {
        label: "Pendente",
        className: "bg-gray-100 text-gray-700 border-gray-200",
      },
    };
    const s = map[status] || map.pendente;
    return (
      <Badge variant="outline" className={s.className}>
        {s.label}
      </Badge>
    );
  };

  const handleExportar = () => {
    const csv = [
      ["Status", "Plano", "Valor", "Criado em"].join(","),
      ...assinaturas.map((a) =>
        [
          a.status,
          (a.plano as Record<string, unknown>)?.nome || "N/A",
          (a.valor as string) || "0",
          a.criado_em,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ChartTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; name: string; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg border bg-white p-3 shadow-lg">
        <p className="mb-1 text-sm font-semibold text-gray-900">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatarMoeda(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  if (erro) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <XCircle className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">Erro ao carregar</h2>
        <p className="mt-1 text-sm text-muted-foreground">{erro}</p>
        <Button variant="outline" className="mt-4" onClick={carregar}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-72 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-72 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">
            Visao geral das receitas e assinaturas do SaaS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={periodo}
            onValueChange={(v) => setPeriodo(v as PeriodoKey)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </motion.div>

      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.06 }}
      >
        {kpis.slice(0, 4).map((kpi, i) => (
          <motion.div
            key={kpi.titulo}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {kpi.titulo}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold tracking-tight">
                      <AnimatedNumber value={kpi.valor} format="moeda" />
                    </p>
                    {kpi.variacao && (
                      <div className="mt-1 flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        <span className="text-[11px] font-medium text-emerald-600">
                          {kpi.variacao}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`shrink-0 rounded-xl p-3 ${kpi.bg}`}>
                    <kpi.icone className={`h-6 w-6 ${kpi.cor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {kpis.slice(4).map((kpi, i) => (
          <motion.div
            key={kpi.titulo}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
          >
            <Card className="transition-colors hover:border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {kpi.titulo}
                    </p>
                    <p className="mt-1.5 text-xl font-bold">
                      <AnimatedNumber value={kpi.valor} format="moeda" />
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-lg p-2.5 ${kpi.bg}`}>
                    <kpi.icone className={`h-5 w-5 ${kpi.cor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="grid gap-6 lg:grid-cols-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Receita ao Longo do Tempo</CardTitle>
            <CardDescription>
              Receita vs custos no periodo selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={receitaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="data"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#d1d5db" }}
                    interval={periodo === "30d" ? 4 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="receita"
                    name="Receita"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="custos"
                    name="Custos"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita por Plano</CardTitle>
            <CardDescription>Distribuicao percentual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planosData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="nome"
                  >
                    {planosData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Participacao"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crescimento MRR</CardTitle>
            <CardDescription>Evolucao mensal do MRR</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrData}>
                  <defs>
                    <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#6366f1"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="#6366f1"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#d1d5db" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    name="MRR"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#mrrGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Assinaturas Recentes
                </CardTitle>
                <CardDescription>
                  Ultimas assinaturas e pagamentos
                </CardDescription>
              </div>
              <Badge variant="secondary">{assinaturas.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {assinaturas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CreditCard className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma assinatura registrada
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assinaturas.slice(0, 15).map((ass) => {
                      const usuario = ass.usuario as Record<
                        string,
                        unknown
                      > | null;
                      const plano = ass.plano as Record<
                        string,
                        unknown
                      > | null;
                      return (
                        <TableRow key={ass.id as string}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {(usuario?.nome as string) || "N/A"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(usuario?.email as string) || ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {(plano?.nome as string) || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell>{statusBadge(ass.status as string)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatarMoeda(Number(ass.valor) || 0)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatarDataHora(ass.criado_em as string)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
