"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  FlaskConical,
  Gift,
  XCircle,
  AlertTriangle,
  RotateCcw,
  CalendarCheck,
  RefreshCw,
  Download,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { formatarMoeda, formatarData, dateToLocalISO } from "@/utils";
import {
  obterFinanceiroAdmin,
  obterReceitaMensal,
  obterDistribuicaoPlanos,
  listarUsuariosAssinaturas,
} from "@/services/admin.service";
import type { AdminFinanceiro } from "@/types/admin";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Financeiro do SaaS — SOMENTE dados reais.
 * (A versão anterior mostrava gráficos com números aleatórios, variações
 * "+12%"/"+15%" fixas no código e planos que não existem.)
 */

const CORES = ["#10b981", "#6366f1", "#f59e0b", "#8b5cf6", "#94a3b8"];

type LinhaAssinatura = {
  usuario_nome: string | null;
  usuario_email: string | null;
  status: string | null;
  categoria?: string | null;
  fim_periodo: string | null;
  metodo_pagamento_id?: string | null;
  tem_acesso?: boolean | null;
};

const ROTULO_CATEGORIA: Record<string, { label: string; className: string }> = {
  mensal: { label: "Mensal", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  anual: { label: "Anual", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  teste: { label: "Teste grátis", className: "bg-amber-100 text-amber-700 border-amber-200" },
  cortesia: { label: "Cortesia/Admin", className: "bg-violet-100 text-violet-700 border-violet-200" },
  vencido: { label: "Vencido", className: "bg-gray-100 text-gray-700 border-gray-200" },
  sem_assinatura: { label: "Sem assinatura", className: "bg-gray-100 text-gray-700 border-gray-200" },
};

function Kpi({
  titulo,
  valor,
  detalhe,
  icone: Icone,
  cor,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: React.ElementType;
  cor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cor}`}>
            <Icone className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-1 whitespace-nowrap text-lg font-bold leading-tight sm:text-2xl">{valor}</p>
        {detalhe && <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminFinanceiroPage() {
  const [fin, setFin] = useState<AdminFinanceiro | null>(null);
  const [receita, setReceita] = useState<{ mes: string; receita: number }[]>([]);
  const [distribuicao, setDistribuicao] = useState<{ nome: string; value: number }[]>([]);
  const [assinaturas, setAssinaturas] = useState<LinhaAssinatura[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [f, r, d, a] = await Promise.all([
        obterFinanceiroAdmin(),
        obterReceitaMensal(),
        obterDistribuicaoPlanos(),
        listarUsuariosAssinaturas(),
      ]);
      setFin(f);
      setReceita(r.map((x) => ({ mes: x.mes, receita: Number(x.receita) || 0 })));
      setDistribuicao(d.map((x) => ({ nome: x.nome, value: Number(x.value) || 0 })));
      setAssinaturas(a as LinhaAssinatura[]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pagantes = useMemo(
    () =>
      assinaturas
        .filter((a) => a.categoria === "mensal" || a.categoria === "anual")
        .sort((x, y) => (x.fim_periodo || "").localeCompare(y.fim_periodo || "")),
    [assinaturas]
  );

  const receitaTotal6m = receita.reduce((acc, r) => acc + r.receita, 0);

  const exportarCsv = () => {
    const linhas = [
      ["Nome", "E-mail", "Tipo", "Status", "Vence em", "Pagamento"].join(";"),
      ...assinaturas.map((a) =>
        [
          a.usuario_nome || "",
          a.usuario_email || "",
          ROTULO_CATEGORIA[a.categoria || ""]?.label || a.categoria || "",
          a.status || "",
          a.fim_periodo ? formatarData(a.fim_periodo) : "",
          a.metodo_pagamento_id === "cakto" ? "Cakto" : "Manual/antigo",
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(";")
      ),
    ].join("\n");
    const blob = new Blob(["﻿" + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `faturion_assinaturas_${dateToLocalISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground">Receita e assinaturas do FATURION, com dados reais</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`mr-2 h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={assinaturas.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {carregando && !fin ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <Kpi
            titulo="MRR"
            valor={formatarMoeda(fin?.mrr || 0)}
            detalhe="Receita mensal recorrente"
            icone={DollarSign}
            cor="bg-emerald-100 text-emerald-600"
          />
          <Kpi
            titulo="ARR estimado"
            valor={formatarMoeda(fin?.arr_estimado || 0)}
            detalhe="MRR × 12"
            icone={TrendingUp}
            cor="bg-indigo-100 text-indigo-600"
          />
          <Kpi
            titulo="Recebido este mês"
            valor={formatarMoeda(fin?.receita_mes_atual || 0)}
            detalhe={`${fin?.pagamentos_mes_atual ?? 0} pagamento(s) pela Cakto`}
            icone={CalendarCheck}
            cor="bg-cyan-100 text-cyan-600"
          />
          <Kpi
            titulo="Assinantes pagantes"
            valor={String(fin?.total_assinaturas_ativas ?? 0)}
            detalhe={`${fin?.pagantes_mensal ?? 0} mensal · ${fin?.pagantes_anual ?? 0} anual`}
            icone={Users}
            cor="bg-green-100 text-green-600"
          />
          <Kpi
            titulo="Em teste grátis"
            valor={String(fin?.total_trials ?? 0)}
            icone={FlaskConical}
            cor="bg-amber-100 text-amber-600"
          />
          <Kpi
            titulo="Cortesias/Admin"
            valor={String(fin?.cortesias ?? 0)}
            detalhe="Não entram no MRR"
            icone={Gift}
            cor="bg-violet-100 text-violet-600"
          />
          <Kpi
            titulo="Cancelamentos"
            valor={String(fin?.total_cancelamentos ?? 0)}
            detalhe={`${fin?.atrasados ?? 0} com pagamento atrasado`}
            icone={XCircle}
            cor="bg-rose-100 text-rose-600"
          />
          <Kpi
            titulo="Reembolsos"
            valor={String(fin?.reembolsos ?? 0)}
            detalhe={`${fin?.vencidos ?? 0} conta(s) sem acesso`}
            icone={fin?.reembolsos ? AlertTriangle : RotateCcw}
            cor="bg-orange-100 text-orange-600"
          />
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Receita confirmada por mês</CardTitle>
            <CardDescription>
              Pagamentos aprovados pela Cakto · {formatarMoeda(receitaTotal6m)} nos últimos 6 meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={receita} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} labelClassName="font-medium" />
                  <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Pagamentos do Mercado Pago (antes de novembro/2026) não ficaram registrados no sistema.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contas por tipo</CardTitle>
            <CardDescription>Situação atual de todos os usuários</CardDescription>
          </CardHeader>
          <CardContent>
            {distribuicao.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribuicao} dataKey="value" nameKey="nome" innerRadius={45} outerRadius={70} paddingAngle={2}>
                        {distribuicao.map((_, i) => (
                          <Cell key={i} fill={CORES[i % CORES.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {distribuicao.map((d, i) => (
                    <li key={d.nome} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                        {d.nome}
                      </span>
                      <span className="font-medium">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Assinantes pagantes</CardTitle>
              <CardDescription>Ordenados pelo próximo vencimento</CardDescription>
            </div>
            <Badge variant="secondary">{pagantes.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {pagantes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum assinante pagante no momento</p>
          ) : (
            <ul className="divide-y">
              {pagantes.map((a, i) => {
                const cat = ROTULO_CATEGORIA[a.categoria || ""];
                return (
                  <li key={(a.usuario_email || "") + i} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.usuario_nome || "Sem nome"}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.usuario_email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {cat && (
                        <Badge variant="outline" className={cat.className}>
                          {cat.label}
                        </Badge>
                      )}
                      {a.status === "atrasado" && (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          Pagamento atrasado
                        </Badge>
                      )}
                      {a.status === "cancelado" && (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                          Cancelou
                        </Badge>
                      )}
                      <span className="text-muted-foreground">
                        {a.status === "cancelado" ? "Acesso até" : "Vence"}{" "}
                        {a.fim_periodo ? formatarData(a.fim_periodo) : "—"}
                      </span>
                      <span className="text-muted-foreground">
                        · {a.metodo_pagamento_id === "cakto" ? "Cakto" : "Manual/antigo"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
