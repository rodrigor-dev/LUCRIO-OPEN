"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda, formatarData } from "@/utils";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  Wrench,
  Clock,
  Plus,
  ArrowRight,
  Activity,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

interface Metricas {
  receitaTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  ticketMedio: number;
  clientesAtivos: number;
  servicosRealizados: number;
  receitasPendentes: number;
}

interface DadosGrafico {
  mes: string;
  receitas: number;
  despesas: number;
}

interface Atividade {
  id: string;
  tipo: string;
  descricao: string;
  data: string;
}

function AnimatedNumber({ value, format }: { value: number; format?: "moeda" | "inteiro" }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1000;
    const start = performance.now();
    const from = 0;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + (value - from) * eased);

      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    }

    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value]);

  if (format === "inteiro") return <>{Math.round(displayValue)}</>;
  return <>{formatarMoeda(displayValue)}</>;
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-72 w-full" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [metricas, setMetricas] = useState<Metricas>({
    receitaTotal: 0,
    despesaTotal: 0,
    lucroLiquido: 0,
    ticketMedio: 0,
    clientesAtivos: 0,
    servicosRealizados: 0,
    receitasPendentes: 0,
  });
  const [dadosGrafico, setDadosGrafico] = useState<DadosGrafico[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) {
        setCarregando(false);
        return;
      }

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
        .toISOString()
        .split("T")[0];

      const [
        receitasMes,
        despesasMes,
        clientes,
        servicos,
        receitasPendentes,
        receitas6Meses,
        despesas6Meses,
        ultimasReceitas,
        ultimasDespesas,
      ] = await Promise.all([
        supabase
          .from("receitas")
          .select("valor")
          .eq("negocio_id", negocio.id)
          .gte("data", inicioMes)
          .eq("status", "pago"),
        supabase
          .from("despesas")
          .select("valor")
          .eq("negocio_id", negocio.id)
          .gte("data", inicioMes)
          .eq("status", "pago"),
        supabase
          .from("clientes")
          .select("id", { count: "exact" })
          .eq("negocio_id", negocio.id)
          .eq("is_ativo", true),
        supabase
          .from("servicos")
          .select("id", { count: "exact" })
          .eq("negocio_id", negocio.id)
          .eq("status", "concluido"),
        supabase
          .from("receitas")
          .select("valor")
          .eq("negocio_id", negocio.id)
          .eq("status", "pendente"),
        supabase
          .from("receitas")
          .select("valor, data, status")
          .eq("negocio_id", negocio.id)
          .eq("status", "pago"),
        supabase
          .from("despesas")
          .select("valor, data, status")
          .eq("negocio_id", negocio.id)
          .eq("status", "pago"),
        supabase
          .from("receitas")
          .select("id, valor, descricao, data")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false })
          .limit(5),
        supabase
          .from("despesas")
          .select("id, valor, descricao, data")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false })
          .limit(5),
      ]);

      const receitaTotal = receitasMes.data?.reduce((acc, r) => acc + r.valor, 0) || 0;
      const despesaTotal = despesasMes.data?.reduce((acc, d) => acc + d.valor, 0) || 0;
      const pendentes =
        receitasPendentes.data?.reduce((acc, r) => acc + r.valor, 0) || 0;

      setMetricas({
        receitaTotal,
        despesaTotal,
        lucroLiquido: receitaTotal - despesaTotal,
        ticketMedio: servicos.count ? receitaTotal / servicos.count : 0,
        clientesAtivos: clientes.count || 0,
        servicosRealizados: servicos.count || 0,
        receitasPendentes: pendentes,
      });

      const mesesNomes = [
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

      const mapaMeses: DadosGrafico[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        mapaMeses.push({
          mes: mesesNomes[d.getMonth()],
          receitas: 0,
          despesas: 0,
        });

        const receitasMesFiltro =
          receitas6Meses.data?.filter((r) => {
            const dataR = new Date(r.data);
            return (
              dataR.getFullYear() === d.getFullYear() &&
              dataR.getMonth() === d.getMonth()
            );
          }) || [];

        const despesasMesFiltro =
          despesas6Meses.data?.filter((ds) => {
            const dataD = new Date(ds.data);
            return (
              dataD.getFullYear() === d.getFullYear() &&
              dataD.getMonth() === d.getMonth()
            );
          }) || [];

        const idx = mapaMeses.length - 1;
        mapaMeses[idx].receitas = receitasMesFiltro.reduce(
          (acc, r) => acc + r.valor,
          0
        );
        mapaMeses[idx].despesas = despesasMesFiltro.reduce(
          (acc, d) => acc + d.valor,
          0
        );
      }

      setDadosGrafico(mapaMeses);

      const atividadesFormatadas: Atividade[] = [];

      ultimasReceitas.data?.forEach((r) => {
        atividadesFormatadas.push({
          id: `r-${r.id}`,
          tipo: "receita",
          descricao: `Receita de ${formatarMoeda(r.valor)}${r.descricao ? ` - ${r.descricao}` : ""}`,
          data: r.data,
        });
      });

      ultimasDespesas.data?.forEach((d) => {
        atividadesFormatadas.push({
          id: `d-${d.id}`,
          tipo: "despesa",
          descricao: `Despesa de ${formatarMoeda(d.valor)}${d.descricao ? ` - ${d.descricao}` : ""}`,
          data: d.data,
        });
      });

      atividadesFormatadas.sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setAtividades(atividadesFormatadas.slice(0, 8));

      setCarregando(false);
    }

    carregarDados();
  }, [supabase]);

  if (carregando) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      titulo: "Receita do Mês",
      valor: metricas.receitaTotal,
      formato: "moeda" as const,
      icone: TrendingUp,
      cor: "text-green-600",
      bg: "bg-green-50",
      hoverBg: "hover:bg-green-100",
      borderHover: "hover:border-green-200",
    },
    {
      titulo: "Despesas do Mês",
      valor: metricas.despesaTotal,
      formato: "moeda" as const,
      icone: TrendingDown,
      cor: "text-red-600",
      bg: "bg-red-50",
      hoverBg: "hover:bg-red-100",
      borderHover: "hover:border-red-200",
    },
    {
      titulo: "Lucro Líquido",
      valor: metricas.lucroLiquido,
      formato: "moeda" as const,
      icone: DollarSign,
      cor: metricas.lucroLiquido >= 0 ? "text-green-600" : "text-red-600",
      bg: metricas.lucroLiquido >= 0 ? "bg-green-50" : "bg-red-50",
      hoverBg: metricas.lucroLiquido >= 0 ? "hover:bg-green-100" : "hover:bg-red-100",
      borderHover: metricas.lucroLiquido >= 0 ? "hover:border-green-200" : "hover:border-red-200",
    },
    {
      titulo: "Ticket Médio",
      valor: metricas.ticketMedio,
      formato: "moeda" as const,
      icone: Target,
      cor: "text-blue-600",
      bg: "bg-blue-50",
      hoverBg: "hover:bg-blue-100",
      borderHover: "hover:border-blue-200",
    },
    {
      titulo: "Clientes Ativos",
      valor: metricas.clientesAtivos,
      formato: "inteiro" as const,
      icone: Users,
      cor: "text-purple-600",
      bg: "bg-purple-50",
      hoverBg: "hover:bg-purple-100",
      borderHover: "hover:border-purple-200",
    },
    {
      titulo: "Serviços Realizados",
      valor: metricas.servicosRealizados,
      formato: "inteiro" as const,
      icone: Wrench,
      cor: "text-orange-600",
      bg: "bg-orange-50",
      hoverBg: "hover:bg-orange-100",
      borderHover: "hover:border-orange-200",
    },
    {
      titulo: "Valores Pendentes",
      valor: metricas.receitasPendentes,
      formato: "moeda" as const,
      icone: Clock,
      cor: "text-yellow-600",
      bg: "bg-yellow-50",
      hoverBg: "hover:bg-yellow-100",
      borderHover: "hover:border-yellow-200",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg border bg-white p-3 shadow-lg">
        <p className="mb-1 text-sm font-semibold text-gray-900">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatarMoeda(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio
        </p>
      </div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {metricCards.slice(0, 4).map((card) => (
          <motion.div key={card.titulo} variants={itemVariants}>
            <Card className={`transition-colors ${card.borderHover}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.titulo}</p>
                    <p className={`mt-1 text-2xl font-bold ${card.cor}`}>
                      <AnimatedNumber value={card.valor} format={card.formato} />
                    </p>
                  </div>
                  <div className={`rounded-full p-3 ${card.bg}`}>
                    <card.icone className={`h-6 w-6 ${card.cor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {metricCards.slice(4).map((card) => (
          <motion.div key={card.titulo} variants={itemVariants}>
            <Card className={`transition-colors ${card.borderHover}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.titulo}</p>
                    <p className={`mt-1 text-2xl font-bold ${card.cor}`}>
                      <AnimatedNumber value={card.valor} format={card.formato} />
                    </p>
                  </div>
                  <div className={`rounded-full p-3 ${card.bg}`}>
                    <card.icone className={`h-6 w-6 ${card.cor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="grid gap-6 lg:grid-cols-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receitas vs Despesas</CardTitle>
            <CardDescription>Comparativo dos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} barGap={4}>
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
                    tickFormatter={(value) =>
                      value >= 1000
                        ? `${(value / 1000).toFixed(0)}k`
                        : String(value)
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  <Bar
                    dataKey="receitas"
                    name="Receitas"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="despesas"
                    name="Despesas"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução do Lucro</CardTitle>
            <CardDescription>Lucro líquido nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dadosGrafico.map((d) => ({
                    ...d,
                    lucro: d.receitas - d.despesas,
                  }))}
                >
                  <defs>
                    <linearGradient id="lucroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                    tickFormatter={(value) =>
                      value >= 1000
                        ? `${(value / 1000).toFixed(0)}k`
                        : String(value)
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="lucro"
                    name="Lucro"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#lucroGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        className="grid gap-6 lg:grid-cols-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                <CardDescription>Acesse as principais funcionalidades</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/receitas?novo=true"
                className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-green-50 hover:border-green-200 group"
              >
                <div className="rounded-full bg-green-100 p-2 transition-colors group-hover:bg-green-200">
                  <Plus className="h-4 w-4 text-green-600" />
                </div>
                <span>Nova Receita</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard/despesas?novo=true"
                className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-red-50 hover:border-red-200 group"
              >
                <div className="rounded-full bg-red-100 p-2 transition-colors group-hover:bg-red-200">
                  <Plus className="h-4 w-4 text-red-600" />
                </div>
                <span>Nova Despesa</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard/clientes?novo=true"
                className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-purple-50 hover:border-purple-200 group"
              >
                <div className="rounded-full bg-purple-100 p-2 transition-colors group-hover:bg-purple-200">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <span>Novo Cliente</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/dashboard/propostas?novo=true"
                className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-blue-50 hover:border-blue-200 group"
              >
                <div className="rounded-full bg-blue-100 p-2 transition-colors group-hover:bg-blue-200">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <span>Nova Proposta</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Atividade Recente</CardTitle>
                <CardDescription>Últimas transações registradas</CardDescription>
              </div>
              <Badge variant="secondary">{atividades.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {atividades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade registrada ainda
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {atividades.map((atividade) => (
                  <div
                    key={atividade.id}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={`rounded-full p-2 ${
                        atividade.tipo === "receita"
                          ? "bg-green-100"
                          : "bg-red-100"
                      }`}
                    >
                      {atividade.tipo === "receita" ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {atividade.descricao}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatarData(atividade.data)}
                      </p>
                    </div>
                    <Badge
                      variant={atividade.tipo === "receita" ? "default" : "destructive"}
                      className="shrink-0"
                    >
                      {atividade.tipo === "receita" ? "Receita" : "Despesa"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
