"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/hooks/use-supabase";
import { formatarMoeda, formatarData } from "@/utils";
import { gerarReceitasRecorrentes } from "@/services/recorrencia.service";
import {
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  UserX,
  BarChart3,
  Repeat,
  Plus,
  ArrowRight,
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
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface KPIs {
  recebidoMes: number;
  aReceber: number;
  atrasado: number;
  totalMes: number;
  clientesAtivos: number;
  clientesInadimplentes: number;
  ticketMedio: number;
  mrr: number;
}

interface DadosMes {
  mes: string;
  receitas: number;
  despesas: number;
}

interface DadosSaldo {
  mes: string;
  saldo: number;
}

interface TopCliente {
  nome: string;
  valor: number;
}

interface DespesaCategoria {
  nome: string;
  valor: number;
}

interface Atividade {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  data: string;
}

const MESES = [
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

const CORES_GRAFICO = [
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: "moeda" | "inteiro";
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1000;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) ref.current = requestAnimationFrame(animate);
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
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const [kpis, setKpis] = useState<KPIs>({
    recebidoMes: 0,
    aReceber: 0,
    atrasado: 0,
    totalMes: 0,
    clientesAtivos: 0,
    clientesInadimplentes: 0,
    ticketMedio: 0,
    mrr: 0,
  });
  const [receitasDespesas, setReceitasDespesas] = useState<DadosMes[]>([]);
  const [evolucaoSaldo, setEvolucaoSaldo] = useState<DadosSaldo[]>([]);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [despesasCategoria, setDespesasCategoria] = useState<DespesaCategoria[]>([]);
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

      const negocioId = negocio.id;

      try {
        await gerarReceitasRecorrentes(negocioId);
      } catch (recErro) {
        console.error("[dashboard] erro ao gerar receitas recorrentes:", recErro);
      }

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const inicioAno = new Date(agora.getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0];
      const inicio12Meses = new Date(
        agora.getFullYear(),
        agora.getMonth() - 11,
        1
      )
        .toISOString()
        .split("T")[0];

      const [
        receitasMes,
        despesasMes,
        receitasPendentes,
        receitasAtrasadas,
        clientes,
        clientesInadimplentesRes,
        receitasMesTicket,
        clientesFixos,
        receitas12Meses,
        despesas12Meses,
        clientesTop,
        despesasCategoriaRes,
        ultimasReceitas,
        ultimasDespesas,
      ] = await Promise.all([
        supabase
          .from("receitas")
          .select("valor")
          .eq("negocio_id", negocioId)
          .gte("data", inicioMes)
          .eq("status", "pago"),
        supabase
          .from("despesas")
          .select("valor")
          .eq("negocio_id", negocioId)
          .gte("data", inicioMes)
          .eq("status", "pago"),
        supabase
          .from("receitas")
          .select("valor")
          .eq("negocio_id", negocioId)
          .eq("status", "pendente"),
        supabase
          .from("receitas")
          .select("valor")
          .eq("negocio_id", negocioId)
          .eq("status", "atrasado"),
        supabase
          .from("clientes")
          .select("id", { count: "exact" })
          .eq("negocio_id", negocioId)
          .eq("is_ativo", true),
        supabase
          .from("receitas")
          .select("cliente_id")
          .eq("negocio_id", negocioId)
          .eq("status", "atrasado"),
        supabase
          .from("receitas")
          .select("valor")
          .eq("negocio_id", negocioId)
          .gte("data", inicioMes)
          .eq("status", "pago"),
        supabase
          .from("clientes")
          .select("valor_mensal")
          .eq("negocio_id", negocioId)
          .eq("tipo", "fixo")
          .eq("is_ativo", true)
          .not("valor_mensal", "is", null),
        supabase
          .from("receitas")
          .select("valor, data")
          .eq("negocio_id", negocioId)
          .gte("data", inicio12Meses)
          .neq("status", "cancelado"),
        supabase
          .from("despesas")
          .select("valor, data")
          .eq("negocio_id", negocioId)
          .gte("data", inicio12Meses)
          .neq("status", "cancelado"),
        supabase
          .from("receitas")
          .select("cliente_id, valor, clientes!inner(nome)")
          .eq("negocio_id", negocioId)
          .gte("data", inicioMes)
          .eq("status", "pago"),
        supabase
          .from("despesas")
          .select("valor, categoria_id, categorias_despesas!inner(nome)")
          .eq("negocio_id", negocioId)
          .gte("data", inicioMes)
          .eq("status", "pago"),
        supabase
          .from("receitas")
          .select("id, valor, descricao, data")
          .eq("negocio_id", negocioId)
          .order("data", { ascending: false })
          .limit(5),
        supabase
          .from("despesas")
          .select("id, valor, descricao, data")
          .eq("negocio_id", negocioId)
          .order("data", { ascending: false })
          .limit(5),
      ]);

      const receitaMes =
        receitasMes.data?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;
      const despesaMes =
        despesasMes.data?.reduce((acc, d) => acc + Number(d.valor), 0) || 0;
      const pendente =
        receitasPendentes.data?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;
      const atrasado =
        receitasAtrasadas.data?.reduce((acc, r) => acc + Number(r.valor), 0) || 0;

      const clientesInadimplentesIds = new Set(
        clientesInadimplentesRes.data?.map((r) => r.cliente_id).filter(Boolean) || []
      );

      const ticketMedio =
        receitasMesTicket.data && receitasMesTicket.data.length > 0
          ? receitaMes / receitasMesTicket.data.length
          : 0;

      const mrr =
        clientesFixos.data?.reduce(
          (acc, c) => acc + Number(c.valor_mensal || 0),
          0
        ) || 0;

      setKpis({
        recebidoMes: receitaMes,
        aReceber: pendente,
        atrasado,
        totalMes: receitaMes - despesaMes,
        clientesAtivos: clientes.count || 0,
        clientesInadimplentes: clientesInadimplentesIds.size,
        ticketMedio,
        mrr,
      });

      const mapaMeses: DadosMes[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        mapaMeses.push({
          mes: MESES[d.getMonth()],
          receitas: 0,
          despesas: 0,
        });

        const idx = mapaMeses.length - 1;

        receitas12Meses.data
          ?.filter((r) => {
            const dataR = new Date(r.data);
            return (
              dataR.getFullYear() === d.getFullYear() &&
              dataR.getMonth() === d.getMonth()
            );
          })
          .forEach((r) => {
            mapaMeses[idx].receitas += Number(r.valor);
          });

        despesas12Meses.data
          ?.filter((ds) => {
            const dataD = new Date(ds.data);
            return (
              dataD.getFullYear() === d.getFullYear() &&
              dataD.getMonth() === d.getMonth()
            );
          })
          .forEach((ds) => {
            mapaMeses[idx].despesas += Number(ds.valor);
          });
      }

      setReceitasDespesas(mapaMeses);

      const mapaSaldo: DadosSaldo[] = [];
      let saldoAcumulado = 0;
      for (let i = 11; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        let receitasMesVal = 0;
        let despesasMesVal = 0;

        receitas12Meses.data
          ?.filter((r) => {
            const dataR = new Date(r.data);
            return (
              dataR.getFullYear() === d.getFullYear() &&
              dataR.getMonth() === d.getMonth()
            );
          })
          .forEach((r) => {
            receitasMesVal += Number(r.valor);
          });

        despesas12Meses.data
          ?.filter((ds) => {
            const dataD = new Date(ds.data);
            return (
              dataD.getFullYear() === d.getFullYear() &&
              dataD.getMonth() === d.getMonth()
            );
          })
          .forEach((ds) => {
            despesasMesVal += Number(ds.valor);
          });

        saldoAcumulado += receitasMesVal - despesasMesVal;
        mapaSaldo.push({
          mes: MESES[d.getMonth()],
          saldo: saldoAcumulado,
        });
      }

      setEvolucaoSaldo(mapaSaldo);

      const clienteMap = new Map<string, { nome: string; valor: number }>();
      clientesTop.data?.forEach((r: any) => {
        const nome = r.clientes?.nome || "Sem cliente";
        const existing = clienteMap.get(nome) || { nome, valor: 0 };
        existing.valor += Number(r.valor);
        clienteMap.set(nome, existing);
      });
      const top5 = Array.from(clienteMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);
      setTopClientes(top5);

      const catMap = new Map<string, number>();
      despesasCategoriaRes.data?.forEach((d: any) => {
        const nome = d.categorias_despesas?.nome || "Outros";
        catMap.set(nome, (catMap.get(nome) || 0) + Number(d.valor));
      });
      const categorias = Array.from(catMap.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor);
      setDespesasCategoria(categorias);

      const atividadesFormatadas: Atividade[] = [];
      ultimasReceitas.data?.forEach((r) => {
        atividadesFormatadas.push({
          id: `r-${r.id}`,
          tipo: "receita",
          descricao: `Receita de ${formatarMoeda(Number(r.valor))}${r.descricao ? ` - ${r.descricao}` : ""}`,
          data: r.data,
        });
      });
      ultimasDespesas.data?.forEach((d) => {
        atividadesFormatadas.push({
          id: `d-${d.id}`,
          tipo: "despesa",
          descricao: `Despesa de ${formatarMoeda(Number(d.valor))}${d.descricao ? ` - ${d.descricao}` : ""}`,
          data: d.data,
        });
      });
      atividadesFormatadas.sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );
      setAtividades(atividadesFormatadas.slice(0, 10));

      setCarregando(false);
    }

    carregarDados();
  }, [supabase, router]);

  const kpiCards = [
    {
      titulo: "Recebido no mês",
      valor: kpis.recebidoMes,
      formato: "moeda" as const,
      icone: DollarSign,
      cor: "text-green-600",
      bg: "bg-green-50",
    },
    {
      titulo: "A receber",
      valor: kpis.aReceber,
      formato: "moeda" as const,
      icone: Clock,
      cor: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      titulo: "Atrasado",
      valor: kpis.atrasado,
      formato: "moeda" as const,
      icone: AlertTriangle,
      cor: "text-red-600",
      bg: "bg-red-50",
    },
    {
      titulo: "Total do mês",
      valor: kpis.totalMes,
      formato: "moeda" as const,
      icone: TrendingUp,
      cor: kpis.totalMes >= 0 ? "text-purple-600" : "text-red-600",
      bg: kpis.totalMes >= 0 ? "bg-purple-50" : "bg-red-50",
    },
    {
      titulo: "Clientes ativos",
      valor: kpis.clientesAtivos,
      formato: "inteiro" as const,
      icone: Users,
      cor: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      titulo: "Clientes inadimplentes",
      valor: kpis.clientesInadimplentes,
      formato: "inteiro" as const,
      icone: UserX,
      cor: "text-red-600",
      bg: "bg-red-50",
    },
    {
      titulo: "Ticket médio",
      valor: kpis.ticketMedio,
      formato: "moeda" as const,
      icone: BarChart3,
      cor: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      titulo: "MRR",
      valor: kpis.mrr,
      formato: "moeda" as const,
      icone: Repeat,
      cor: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: "easeOut" },
    },
  };

  const CustomTooltip = ({
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
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatarMoeda(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number }>;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-white p-3 shadow-lg">
        <p className="text-sm font-semibold text-gray-900">{payload[0].name}</p>
        <p className="text-sm text-gray-600">{formatarMoeda(payload[0].value)}</p>
      </div>
    );
  };

  if (carregando) {
    return (
    <div className="space-y-6">
      <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio
        </p>
      </div>

      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {kpiCards.map((card) => (
          <motion.div key={card.titulo} variants={itemVariants}>
            <Card className="transition-colors hover:border-gray-200">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {card.titulo}
                    </p>
                    <p className={`mt-1 text-xl font-bold ${card.cor}`}>
                      <AnimatedNumber value={card.valor} format={card.formato} />
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-full p-2.5 ${card.bg}`}>
                    <card.icone className={`h-5 w-5 ${card.cor}`} />
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
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita vs Despesa</CardTitle>
            <CardDescription>Comparativo dos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={receitasDespesas} barGap={4}>
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
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
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
            <CardTitle className="text-lg">Evolução do Saldo</CardTitle>
            <CardDescription>Saldo acumulado nos últimos 12 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucaoSaldo}>
                  <defs>
                    <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
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
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#saldoGrad)"
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
        transition={{ delay: 0.45, duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Clientes</CardTitle>
            <CardDescription>Clientes que mais geraram receita este mês</CardDescription>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum cliente com receita este mês</p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topClientes}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="valor"
                      nameKey="nome"
                    >
                      {topClientes.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) =>
                        value.length > 16 ? `${value.slice(0, 16)}...` : value
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
            <CardDescription>Breakdown das despesas do mês</CardDescription>
          </CardHeader>
          <CardContent>
            {despesasCategoria.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhuma despesa registrada este mês</p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={despesasCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="valor"
                      nameKey="nome"
                    >
                      {despesasCategoria.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) =>
                        value.length > 16 ? `${value.slice(0, 16)}...` : value
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <span>Novo Orçamento</span>
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
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {atividades.map((atividade) => (
                  <div
                    key={atividade.id}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={`shrink-0 rounded-full p-2 ${
                        atividade.tipo === "receita"
                          ? "bg-green-100"
                          : "bg-red-100"
                      }`}
                    >
                      {atividade.tipo === "receita" ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
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
                      variant={
                        atividade.tipo === "receita" ? "default" : "destructive"
                      }
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
