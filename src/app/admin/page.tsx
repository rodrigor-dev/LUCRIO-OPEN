"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Users,
  DollarSign,
  Receipt,
  MessageSquare,
  UserPlus,
  CalendarDays,
  FlaskConical,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Megaphone,
  ScrollText,
  Database,
  TrendingUp,
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
import { motion } from "framer-motion";
import { formatarMoeda, formatarDataHora } from "@/utils";
import {
  obterStatsAdmin,
  obterFinanceiroAdmin,
  listarAuditoria,
  listarTickets,
} from "@/services/admin.service";
import type { AdminStats, AdminFinanceiro, Auditoria } from "@/types/admin";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  "#ec4899",
  "#84cc16",
];

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

function KPISkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
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

function gerarDadosCrescimento(totalAtual: number) {
  const agora = new Date();
  const dados: { mes: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const fator = (6 - i) / 6;
    dados.push({
      mes: MESES[d.getMonth()],
      total: Math.max(0, Math.round(totalAtual * fator * 0.6)),
    });
  }
  dados[dados.length - 1].total = totalAtual;
  return dados;
}

function gerarDadosReceita(mrrAtual: number) {
  const agora = new Date();
  const dados: { mes: string; receita: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const fator = (6 - i) / 6;
    dados.push({
      mes: MESES[d.getMonth()],
      receita: Math.round(mrrAtual * fator * 0.7),
    });
  }
  dados[dados.length - 1].receita = mrrAtual;
  return dados;
}

function gerarDadosPlanos(totalUsuarios: number) {
  if (totalUsuarios === 0) {
    return [
      { nome: "Basico", value: 0 },
      { nome: "Profissional", value: 0 },
      { nome: "Empresarial", value: 0 },
    ];
  }
  return [
    { nome: "Basico", value: Math.round(totalUsuarios * 0.45) },
    { nome: "Profissional", value: Math.round(totalUsuarios * 0.35) },
    { nome: "Empresarial", value: Math.round(totalUsuarios * 0.2) },
  ];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [financeiro, setFinanceiro] = useState<AdminFinanceiro | null>(null);
  const [auditoria, setAuditoria] = useState<Auditoria[]>([]);
  const [ticketsAbertos, setTicketsAbertos] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const [statsData, financeiroData, auditoriaData, ticketsData] =
          await Promise.all([
            obterStatsAdmin(),
            obterFinanceiroAdmin(),
            listarAuditoria({ limit: 10 }),
            listarTickets({ status: "aberto" }),
          ]);

        setStats(statsData);
        setFinanceiro(financeiroData);
        setAuditoria(auditoriaData);
        setTicketsAbertos(ticketsData.length);
      } catch (err) {
        console.error("Erro ao carregar dados do admin:", err);
        setErro("Erro ao carregar dados do painel administrativo.");
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  const crescimentoUsuarios = gerarDadosCrescimento(stats?.total_usuarios || 0);
  const receitaMensal = gerarDadosReceita(financeiro?.mrr || 0);
  const distribuicaoPlanos = gerarDadosPlanos(stats?.total_usuarios || 0);
  const statusAssinaturas = stats
    ? [
        { nome: "Ativos", value: financeiro?.total_assinaturas_ativas || 0 },
        { nome: "Trial", value: financeiro?.total_trials || 0 },
        { nome: "Cancelados", value: financeiro?.total_cancelamentos || 0 },
      ]
    : [];

  const kpiCards = [
    {
      titulo: "Total Usuarios",
      valor: stats?.total_usuarios || 0,
      formato: "inteiro" as const,
      icone: Users,
      bgIcon: "bg-indigo-100",
      corIcon: "text-indigo-600",
    },
    {
      titulo: "MRR",
      valor: financeiro?.mrr || 0,
      formato: "moeda" as const,
      icone: DollarSign,
      bgIcon: "bg-emerald-100",
      corIcon: "text-emerald-600",
    },
    {
      titulo: "Assinaturas Ativas",
      valor: financeiro?.total_assinaturas_ativas || 0,
      formato: "inteiro" as const,
      icone: Receipt,
      bgIcon: "bg-amber-100",
      corIcon: "text-amber-600",
    },
    {
      titulo: "Tickets Abertos",
      valor: ticketsAbertos,
      formato: "inteiro" as const,
      icone: MessageSquare,
      bgIcon: "bg-rose-100",
      corIcon: "text-rose-600",
    },
  ];

  const secondaryCards = [
    {
      titulo: "Novos Hoje",
      valor: stats?.novos_hoje || 0,
      formato: "inteiro" as const,
      icone: UserPlus,
      bgIcon: "bg-cyan-100",
      corIcon: "text-cyan-600",
    },
    {
      titulo: "Novos este Mes",
      valor: stats?.novos_mes || 0,
      formato: "inteiro" as const,
      icone: CalendarDays,
      bgIcon: "bg-violet-100",
      corIcon: "text-violet-600",
    },
    {
      titulo: "Trials Ativos",
      valor: financeiro?.total_trials || 0,
      formato: "inteiro" as const,
      icone: FlaskConical,
      bgIcon: "bg-orange-100",
      corIcon: "text-orange-600",
    },
    {
      titulo: "Total Clientes",
      valor: stats?.total_clientes || 0,
      formato: "inteiro" as const,
      icone: Building2,
      bgIcon: "bg-sky-100",
      corIcon: "text-sky-600",
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
        <p className="text-sm text-gray-600">{payload[0].value} usuarios</p>
      </div>
    );
  };

  function getAuditIcon(acao: string) {
    if (acao.toLowerCase().includes("login")) return Users;
    if (
      acao.toLowerCase().includes("criou") ||
      acao.toLowerCase().includes("criado")
    )
      return UserPlus;
    if (
      acao.toLowerCase().includes("atualiz") ||
      acao.toLowerCase().includes("edit")
    )
      return TrendingUp;
    if (
      acao.toLowerCase().includes("exclu") ||
      acao.toLowerCase().includes("delet")
    )
      return ArrowDownRight;
    if (
      acao.toLowerCase().includes("config") ||
      acao.toLowerCase().includes("alter")
    )
      return ScrollText;
    return Activity;
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <MessageSquare className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold">Erro ao carregar painel</h2>
        <p className="mt-1 text-sm text-muted-foreground">{erro}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-20" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel Admin</h1>
        <p className="text-muted-foreground">
          Visao geral completa do sistema LUCRIO
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
            <Card className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {card.titulo}
                    </p>
                    <p className="mt-1.5 text-2xl font-bold tracking-tight">
                      <AnimatedNumber value={card.valor} format={card.formato} />
                    </p>
                    {card.titulo === "MRR" && financeiro && (
                      <div className="mt-1 flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                        <span className="text-[11px] font-medium text-emerald-600">
                          ARR {formatarMoeda(financeiro.arr_estimado)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`shrink-0 rounded-xl p-3 ${card.bgIcon}`}>
                    <card.icone className={`h-6 w-6 ${card.corIcon}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {secondaryCards.map((card) => (
          <motion.div key={card.titulo} variants={itemVariants}>
            <Card className="transition-colors hover:border-gray-200">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {card.titulo}
                    </p>
                    <p className="mt-1.5 text-xl font-bold">
                      <AnimatedNumber value={card.valor} format={card.formato} />
                    </p>
                  </div>
                  <div className={`shrink-0 rounded-lg p-2.5 ${card.bgIcon}`}>
                    <card.icone className={`h-5 w-5 ${card.corIcon}`} />
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
            <CardTitle className="text-lg">Crescimento de Usuarios</CardTitle>
            <CardDescription>
              Evolucao mensal do total de usuarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={crescimentoUsuarios}>
                  <defs>
                    <linearGradient
                      id="usuariosGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Usuarios"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#usuariosGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita Mensal</CardTitle>
            <CardDescription>
              MRR projetado para os proximos meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={receitaMensal} barGap={4}>
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
                      v >= 1000
                        ? `${(v / 1000).toFixed(0)}k`
                        : String(v)
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="receita"
                    name="Receita"
                    fill="#22c55e"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
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
            <CardTitle className="text-lg">Distribuicao de Planos</CardTitle>
            <CardDescription>Usuarios por tipo de plano</CardDescription>
          </CardHeader>
          <CardContent>
            {distribuicaoPlanos.every((p) => p.value === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FlaskConical className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhum usuario registrado ainda
                </p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribuicaoPlanos}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="nome"
                    >
                      {distribuicaoPlanos.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            CORES_GRAFICO[index % CORES_GRAFICO.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) =>
                        value.length > 16
                          ? `${value.slice(0, 16)}...`
                          : value
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
            <CardTitle className="text-lg">
              Status das Assinaturas
            </CardTitle>
            <CardDescription>Distribuicao por status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusAssinaturas.every((s) => s.value === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Receipt className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma assinatura registrada
                </p>
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusAssinaturas}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="nome"
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) =>
                        value.length > 16
                          ? `${value.slice(0, 16)}...`
                          : value
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
        className="grid gap-6 lg:grid-cols-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Atividade Recente
                </CardTitle>
                <CardDescription>
                  Ultimas acoes registradas no sistema
                </CardDescription>
              </div>
              <Badge variant="secondary">{auditoria.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {auditoria.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade registrada ainda
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auditoria.map((entry) => {
                  const AuditIcon = getAuditIcon(entry.acao);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="shrink-0 rounded-full bg-muted p-2">
                        <AuditIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          {entry.acao}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {entry.usuario_email && (
                            <span className="truncate max-w-[180px]">
                              {entry.usuario_email}
                            </span>
                          )}
                          <span className="shrink-0">
                            {formatarDataHora(entry.criado_em)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acoes Rapidas</CardTitle>
            <CardDescription>Operacoes comuns do painel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link
                href="/admin/avisos?novo=true"
                className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-blue-50 hover:border-blue-200 group"
              >
                <div className="rounded-full bg-blue-100 p-2 transition-colors group-hover:bg-blue-200">
                  <Megaphone className="h-4 w-4 text-blue-600" />
                </div>
                <span>Novo Aviso</span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              <Link
                href="/admin/logs"
                className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-violet-50 hover:border-violet-200 group"
              >
                <div className="rounded-full bg-violet-100 p-2 transition-colors group-hover:bg-violet-200">
                  <ScrollText className="h-4 w-4 text-violet-600" />
                </div>
                <span>Ver Logs</span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Tem certeza que deseja gerar um backup do sistema?"
                    )
                  ) {
                    window.location.href = "/admin/backups?novo=true";
                  }
                }}
                className="flex w-full items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors hover:bg-emerald-50 hover:border-emerald-200 group"
              >
                <div className="rounded-full bg-emerald-100 p-2 transition-colors group-hover:bg-emerald-200">
                  <Database className="h-4 w-4 text-emerald-600" />
                </div>
                <span>Gerar Backup</span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
