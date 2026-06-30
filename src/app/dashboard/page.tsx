"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";

interface Metricas {
  receitaTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  ticketMedio: number;
  clientesAtivos: number;
  servicosRealizados: number;
  receitasPendentes: number;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [metricas, setMetricas] = useState<Metricas>({
    receitaTotal: 0,
    despesaTotal: 0,
    lucroLiquido: 0,
    ticketMedio: 0,
    clientesAtivos: 0,
    servicosRealizados: 0,
    receitasPendentes: 0,
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarMetricas() {
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

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
        .toISOString()
        .split("T")[0];

      const [receitas, despesas, clientes, servicos, receitasPendentes] =
        await Promise.all([
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
        ]);

      const receitaTotal = receitas.data?.reduce((acc, r) => acc + r.valor, 0) || 0;
      const despesaTotal = despesas.data?.reduce((acc, d) => acc + d.valor, 0) || 0;
      const pendentes = receitasPendentes.data?.reduce((acc, r) => acc + r.valor, 0) || 0;

      setMetricas({
        receitaTotal,
        despesaTotal,
        lucroLiquido: receitaTotal - despesaTotal,
        ticketMedio: servicos.count ? receitaTotal / servicos.count : 0,
        clientesAtivos: clientes.count || 0,
        servicosRealizados: servicos.count || 0,
        receitasPendentes: pendentes,
      });

      setCarregando(false);
    }

    carregarMetricas();
  }, [supabase]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const cards = [
    {
      titulo: "Receita do Mês",
      valor: formatarMoeda(metricas.receitaTotal),
      icone: "💰",
      cor: "text-green-600",
      bg: "bg-green-50",
    },
    {
      titulo: "Despesas do Mês",
      valor: formatarMoeda(metricas.despesaTotal),
      icone: "📤",
      cor: "text-red-600",
      bg: "bg-red-50",
    },
    {
      titulo: "Lucro Líquido",
      valor: formatarMoeda(metricas.lucroLiquido),
      icone: "📈",
      cor: metricas.lucroLiquido >= 0 ? "text-green-600" : "text-red-600",
      bg: metricas.lucroLiquido >= 0 ? "bg-green-50" : "bg-red-50",
    },
    {
      titulo: "Ticket Médio",
      valor: formatarMoeda(metricas.ticketMedio),
      icone: "🎯",
      cor: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      titulo: "Clientes Ativos",
      valor: metricas.clientesAtivos.toString(),
      icone: "👥",
      cor: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      titulo: "Serviços Realizados",
      valor: metricas.servicosRealizados.toString(),
      icone: "🔧",
      cor: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      titulo: "Valores Pendentes",
      valor: formatarMoeda(metricas.receitasPendentes),
      icone: "⏳",
      cor: "text-yellow-600",
      bg: "bg-yellow-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do seu negócio
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.titulo}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.titulo}</p>
              <span className={`text-2xl ${card.cor}`}>{card.icone}</span>
            </div>
            <p className={`mt-2 text-2xl font-bold ${card.cor}`}>{card.valor}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Receitas vs Despesas</h2>
          <div className="flex h-64 items-end justify-around gap-2 pb-8">
            {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"].map((mes, i) => (
              <div key={mes} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[30px] rounded-t bg-green-500"
                    style={{ height: `${Math.random() * 120 + 40}px` }}
                  />
                  <div
                    className="w-full max-w-[30px] rounded-t bg-red-400"
                    style={{ height: `${Math.random() * 80 + 20}px` }}
                  />
                </div>
                <span className="mt-2 text-xs text-muted-foreground">{mes}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              Receitas
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              Despesas
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Ações Rápidas</h2>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/receitas?novo=true"
              className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
            >
              <span className="text-lg">➕</span>
              Nova Receita
            </a>
            <a
              href="/despesas?novo=true"
              className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
            >
              <span className="text-lg">➕</span>
              Nova Despesa
            </a>
            <a
              href="/clientes?novo=true"
              className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
            >
              <span className="text-lg">👤</span>
              Novo Cliente
            </a>
            <a
              href="/propostas?novo=true"
              className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
            >
              <span className="text-lg">📋</span>
              Nova Proposta
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
