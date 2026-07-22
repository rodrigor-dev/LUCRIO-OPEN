"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Download,
  Filter,
  PieChart,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

interface DadosRelatorio {
  receitaTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  ticketMedio: number;
  totalClientes: number;
  totalServicos: number;
  receitas: any[];
  despesas: any[];
  topClientes: { nome: string; valor: number }[];
  categoriasDespesas: { nome: string; valor: number }[];
  receitasPorMes: { mes: string; valor: number }[];
  despesasPorMes: { mes: string; valor: number }[];
}

const COLORS = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

const mesesAbrev = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export default function RelatoriosPage() {
  const supabase = createClient();
  const [periodo, setPeriodo] = useState("mes");
  const [carregando, setCarregando] = useState(true);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [dados, setDados] = useState<DadosRelatorio>({
    receitaTotal: 0,
    despesaTotal: 0,
    lucroLiquido: 0,
    ticketMedio: 0,
    totalClientes: 0,
    totalServicos: 0,
    receitas: [],
    despesas: [],
    topClientes: [],
    categoriasDespesas: [],
    receitasPorMes: [],
    despesasPorMes: [],
  });

  useEffect(() => {
    carregarDados();
  }, [periodo, supabase]);

  async function carregarDados() {
    setCarregando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCarregando(false);
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
    let dataInicio: string;

    if (periodo === "mes") {
      dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
        .toISOString()
        .split("T")[0];
    } else if (periodo === "trimestre") {
      dataInicio = new Date(agora.getFullYear(), agora.getMonth() - 2, 1)
        .toISOString()
        .split("T")[0];
    } else {
      dataInicio = new Date(agora.getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0];
    }

    const [receitasRes, despesasRes, clientesRes, servicosRes] =
      await Promise.all([
        supabase
          .from("receitas")
          .select("*, cliente:clientes(nome)")
          .eq("negocio_id", negocio.id)
          .gte("data", dataInicio)
          .eq("status", "pago"),
        supabase
          .from("despesas")
          .select("*, categoria:categorias_despesas(nome, icone)")
          .eq("negocio_id", negocio.id)
          .gte("data", dataInicio)
          .eq("status", "pago"),
        supabase
          .from("clientes")
          .select("id", { count: "exact" })
          .eq("negocio_id", negocio.id),
        supabase
          .from("servicos")
          .select("id", { count: "exact" })
          .eq("negocio_id", negocio.id)
          .gte("data", dataInicio),
      ]);

    const receitas = receitasRes.data || [];
    const despesas = despesasRes.data || [];

    const receitaTotal = receitas.reduce((acc: number, r: any) => acc + r.valor, 0);
    const despesaTotal = despesas.reduce((acc: number, d: any) => acc + d.valor, 0);

    const clientesMap = new Map<string, number>();
    receitas.forEach((r: any) => {
      if (r.cliente?.nome) {
        const atual = clientesMap.get(r.cliente.nome) || 0;
        clientesMap.set(r.cliente.nome, atual + r.valor);
      }
    });

    const categoriasMap = new Map<string, number>();
    despesas.forEach((d: any) => {
      const nome = d.categoria?.nome || "Outros";
      const atual = categoriasMap.get(nome) || 0;
      categoriasMap.set(nome, atual + d.valor);
    });

    const receitasMesMap = new Map<string, number>();
    receitas.forEach((r: any) => {
      const d = new Date(r.data);
      const chave = mesesAbrev[d.getMonth()];
      const atual = receitasMesMap.get(chave) || 0;
      receitasMesMap.set(chave, atual + r.valor);
    });

    const despesasMesMap = new Map<string, number>();
    despesas.forEach((d: any) => {
      const data = new Date(d.data);
      const chave = mesesAbrev[data.getMonth()];
      const atual = despesasMesMap.get(chave) || 0;
      despesasMesMap.set(chave, atual + d.valor);
    });

    const mesesOrdenados = periodo === "ano"
      ? mesesAbrev
      : mesesAbrev.slice(
          Math.max(0, agora.getMonth() - (periodo === "trimestre" ? 2 : 0)),
          agora.getMonth() + 1
        );

    const receitasPorMes = mesesOrdenados.map((mes) => ({
      mes,
      valor: receitasMesMap.get(mes) || 0,
    }));

    const despesasPorMes = mesesOrdenados.map((mes) => ({
      mes,
      valor: despesasMesMap.get(mes) || 0,
    }));

    setDados({
      receitaTotal,
      despesaTotal,
      lucroLiquido: receitaTotal - despesaTotal,
      ticketMedio: servicosRes.count ? receitaTotal / servicosRes.count : 0,
      totalClientes: clientesRes.count || 0,
      totalServicos: servicosRes.count || 0,
      receitas,
      despesas,
      topClientes: Array.from(clientesMap.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5),
      categoriasDespesas: Array.from(categoriasMap.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor),
      receitasPorMes,
      despesasPorMes,
    });

    setCarregando(false);
  }

  const lucroTrend = useMemo(() => {
    return dados.receitasPorMes.map((r, i) => ({
      mes: r.mes,
      receita: r.valor,
      despesa: dados.despesasPorMes[i]?.valor || 0,
      lucro: r.valor - (dados.despesasPorMes[i]?.valor || 0),
    }));
  }, [dados.receitasPorMes, dados.despesasPorMes]);

  function exportarCSV(tipo: "receitas" | "despesas") {
    const dadosExportar = tipo === "receitas" ? dados.receitas : dados.despesas;
    const cabecalho =
      tipo === "receitas"
        ? "Descricao,Valor,Data,Status,Cliente\n"
        : "Descricao,Valor,Data,Status,Categoria\n";

    const linhas = dadosExportar
      .map((item: any) => {
        if (tipo === "receitas") {
          return `"${item.descricao}",${item.valor},"${item.data}","${item.status}","${item.cliente?.nome || ""}"`;
        }
        return `"${item.descricao}",${item.valor},"${item.data}","${item.status}","${item.categoria?.nome || ""}"`;
      })
      .join("\n");

    const blob = new Blob(["\uFEFF" + cabecalho + linhas], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `faturion_${tipo}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  function handleExportPDF() {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF();
        const fontName = "times";

        doc.setFontSize(16);
        doc.setFont(fontName, "bold");
        doc.text("Relatorio Financeiro - FATURION", 105, 15, { align: "center" });

        doc.setFontSize(10);
        doc.setFont(fontName, "normal");
        const periodoLabel = periodo === "mes" ? "Este Mes" : periodo === "trimestre" ? "Ultimos 3 Meses" : "Este Ano";
        doc.text(`Periodo: ${periodoLabel}`, 14, 25);
        doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 31);

        let y = 40;
        doc.setFont(fontName, "bold");
        doc.setFontSize(12);
        doc.text("Resumo", 14, y);
        y += 7;
        doc.setFont(fontName, "normal");
        doc.setFontSize(10);
        doc.text(`Receita Total: R$ ${dados.receitaTotal.toFixed(2).replace(".", ",")}`, 14, y); y += 6;
        doc.text(`Despesa Total: R$ ${dados.despesaTotal.toFixed(2).replace(".", ",")}`, 14, y); y += 6;
        doc.text(`Lucro Liquido: R$ ${dados.lucroLiquido.toFixed(2).replace(".", ",")}`, 14, y); y += 6;
        doc.text(`Ticket Medio: R$ ${dados.ticketMedio.toFixed(2).replace(".", ",")}`, 14, y); y += 6;
        doc.text(`Total Clientes: ${dados.totalClientes}`, 14, y); y += 6;
        doc.text(`Total Servicos: ${dados.totalServicos}`, 14, y); y += 10;

        if (dados.topClientes.length > 0) {
          doc.setFont(fontName, "bold");
          doc.setFontSize(12);
          doc.text("Top Clientes", 14, y); y += 7;
          (doc as any).autoTable({
            startY: y,
            head: [["Cliente", "Valor"]],
            body: dados.topClientes.map((c) => [c.nome, `R$ ${c.valor.toFixed(2).replace(".", ",")}`]),
            theme: "grid",
            headStyles: { fillColor: [16, 185, 129] },
            styles: { fontSize: 9 },
          });
          y = (doc as any).lastAutoTable.finalY + 10;
        }

        if (dados.categoriasDespesas.length > 0) {
          doc.setFont(fontName, "bold");
          doc.setFontSize(12);
          doc.text("Despesas por Categoria", 14, y); y += 7;
          (doc as any).autoTable({
            startY: y,
            head: [["Categoria", "Valor"]],
            body: dados.categoriasDespesas.map((c) => [c.nome, `R$ ${c.valor.toFixed(2).replace(".", ",")}`]),
            theme: "grid",
            headStyles: { fillColor: [239, 68, 68] },
            styles: { fontSize: 9 },
          });
        }

        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.text("Gerado pelo FATURION - Sistema Financeiro", 105, 285, { align: "center" });

        doc.save(`faturion_relatorio_${new Date().toISOString().split("T")[0]}.pdf`);
        toast.success("PDF exportado com sucesso!");
      });
    });
  }

  function handleExportEmBreve(formato: string) {
    toast.info(`Exportacao em ${formato} disponivel em breve!`);
  }

  if (carregando) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="mb-2 h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Analise o desempenho do seu negócio
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportarCSV("receitas")}
          >
            <Download className="h-4 w-4" />
            CSV Receitas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportarCSV("despesas")}
          >
            <Download className="h-4 w-4" />
            CSV Despesas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportPDF}
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleExportEmBreve("Excel")}
          >
            <BarChart3 className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          Período:
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Mês Atual</SelectItem>
            <SelectItem value="trimestre">Últimos 3 meses</SelectItem>
            <SelectItem value="ano">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Receitas</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600">
                    {formatarMoeda(dados.receitaTotal)}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Despesas</p>
                  <p className="mt-1 text-2xl font-bold text-red-600">
                    {formatarMoeda(dados.despesaTotal)}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lucro</p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      dados.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatarMoeda(dados.lucroLiquido)}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    dados.lucroLiquido >= 0
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {dados.lucroLiquido >= 0 ? (
                    <ArrowUpRight className="h-5 w-5" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">
                    {formatarMoeda(dados.ticketMedio)}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-full sm:w-auto">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="por-cliente">Por Cliente</TabsTrigger>
            <TabsTrigger value="por-categoria">Por Categoria</TabsTrigger>
            <TabsTrigger value="por-periodo">Por Período</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visao-geral" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Receitas por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dados.receitasPorMes.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={dados.receitasPorMes}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="mes" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          formatter={(value: number) => formatarMoeda(value)}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--background))",
                          }}
                        />
                        <Bar
                          dataKey="valor"
                          name="Receitas"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="h-4 w-4 text-muted-foreground" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dados.categoriasDespesas.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <div className="flex flex-col items-center gap-4 sm:flex-row">
                      <ResponsiveContainer width="100%" height={240}>
                        <RechartsPie>
                          <Pie
                            data={dados.categoriasDespesas}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="valor"
                            nameKey="nome"
                          >
                            {dados.categoriasDespesas.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => formatarMoeda(value)}
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid hsl(var(--border))",
                              background: "hsl(var(--background))",
                            }}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                      <div className="min-w-0 space-y-1.5">
                        {dados.categoriasDespesas.map((cat, i) => (
                          <div key={cat.nome} className="flex items-center gap-2 text-sm">
                            <div
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ background: COLORS[i % COLORS.length] }}
                            />
                            <span className="truncate">{cat.nome}</span>
                            <span className="ml-auto whitespace-nowrap text-muted-foreground">
                              {formatarMoeda(cat.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Tendência de Lucro
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lucroTrend.length === 0 || lucroTrend.every((l) => l.receita === 0 && l.despesa === 0) ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum dado disponível
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={lucroTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatarMoeda(value),
                          name === "receita"
                            ? "Receita"
                            : name === "despesa"
                              ? "Despesa"
                              : "Lucro",
                        ]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--background))",
                        }}
                      />
                      <Legend
                        formatter={(value: string) =>
                          value === "receita"
                            ? "Receita"
                            : value === "despesa"
                              ? "Despesa"
                              : "Lucro"
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="receita"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="despesa"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="lucro"
                        stroke="#6366f1"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="por-cliente" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Top Clientes por Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dados.topClientes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum dado disponível
                  </p>
                ) : (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={dados.topClientes} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis
                          type="category"
                          dataKey="nome"
                          className="text-xs"
                          width={120}
                        />
                        <Tooltip
                          formatter={(value: number) => formatarMoeda(value)}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--background))",
                          }}
                        />
                        <Bar dataKey="valor" name="Faturamento" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="space-y-2">
                      {dados.topClientes.map((cliente, index) => {
                        const percentual = dados.receitaTotal
                          ? (cliente.valor / dados.receitaTotal) * 100
                          : 0;
                        return (
                          <div key={cliente.nome}>
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-muted-foreground">
                                  {index + 1}º
                                </span>
                                <span className="text-sm font-medium">{cliente.nome}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {percentual.toFixed(1)}%
                                </span>
                                <span className="text-sm font-semibold text-emerald-600">
                                  {formatarMoeda(cliente.valor)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${percentual}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="por-categoria" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="h-4 w-4 text-muted-foreground" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dados.categoriasDespesas.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dados.categoriasDespesas.map((cat) => {
                        const percentual = dados.despesaTotal
                          ? (cat.valor / dados.despesaTotal) * 100
                          : 0;
                        return (
                          <div key={cat.nome}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium">{cat.nome}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {percentual.toFixed(1)}%
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatarMoeda(cat.valor)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${percentual}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Clientes por Faturamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dados.topClientes.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {dados.topClientes.map((cliente) => {
                        const percentual = dados.receitaTotal
                          ? (cliente.valor / dados.receitaTotal) * 100
                          : 0;
                        return (
                          <div key={cliente.nome}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm font-medium">{cliente.nome}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {percentual.toFixed(1)}%
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatarMoeda(cliente.valor)}
                                </span>
                              </div>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${percentual}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="por-periodo" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Receitas vs Despesas por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dados.receitasPorMes.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={lucroTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="mes" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            formatarMoeda(value),
                            name === "receita" ? "Receita" : "Despesa",
                          ]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--background))",
                          }}
                        />
                        <Legend
                          formatter={(value: string) =>
                            value === "receita" ? "Receita" : "Despesa"
                          }
                        />
                        <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    Lucro por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lucroTrend.length === 0 || lucroTrend.every((l) => l.lucro === 0) ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum dado disponível
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={lucroTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="mes" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          formatter={(value: number) => formatarMoeda(value)}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--background))",
                          }}
                        />
                        <Bar dataKey="lucro" name="Lucro" fill="#6366f1" radius={[4, 4, 0, 0]}>
                          {lucroTrend.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.lucro >= 0 ? "#10b981" : "#f43f5e"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}