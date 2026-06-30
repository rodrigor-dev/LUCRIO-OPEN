"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";

export default function RelatoriosPage() {
  const supabase = createClient();
  const [periodo, setPeriodo] = useState("mes");
  const [dados, setDados] = useState({
    receitaTotal: 0,
    despesaTotal: 0,
    lucroLiquido: 0,
    ticketMedio: 0,
    totalClientes: 0,
    totalServicos: 0,
    receitas: [] as any[],
    despesas: [] as any[],
    topClientes: [] as any[],
    categoriasDespesas: [] as any[],
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarDados();
  }, [periodo, supabase]);

  async function carregarDados() {
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
          .eq("negocio_id", negocio.id),
      ]);

    const receitas = receitasRes.data || [];
    const despesas = despesasRes.data || [];

    const receitaTotal = receitas.reduce((acc, r) => acc + r.valor, 0);
    const despesaTotal = despesas.reduce((acc, d) => acc + d.valor, 0);

    const clientesMap = new Map();
    receitas.forEach((r) => {
      if (r.cliente?.nome) {
        const atual = clientesMap.get(r.cliente.nome) || 0;
        clientesMap.set(r.cliente.nome, atual + r.valor);
      }
    });

    const categoriasMap = new Map();
    despesas.forEach((d) => {
      const nome = d.categoria?.nome || "Outros";
      const atual = categoriasMap.get(nome) || 0;
      categoriasMap.set(nome, atual + d.valor);
    });

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
    });

    setCarregando(false);
  }

  function exportarCSV(tipo: "receitas" | "despesas") {
    const dadosExportar = tipo === "receitas" ? dados.receitas : dados.despesas;
    const cabecalho =
      tipo === "receitas"
        ? "Descrição,Valor,Data,Status,Cliente\n"
        : "Descrição,Valor,Data,Status,Categoria\n";

    const linhas = dadosExportar
      .map((item) => {
        if (tipo === "receitas") {
          return `"${item.descricao}",${item.valor},"${item.data}","${item.status}","${item.cliente?.nome || ""}"`;
        }
        return `"${item.descricao}",${item.valor},"${item.data}","${item.status}","${item.categoria?.nome || ""}"`;
      })
      .join("\n");

    const blob = new Blob([cabecalho + linhas], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lucrio_${tipo}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Analise o desempenho do seu negócio
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportarCSV("receitas")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            📥 Exportar Receitas
          </button>
          <button
            onClick={() => exportarCSV("despesas")}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            📥 Exportar Despesas
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { valor: "mes", label: "Mês" },
          { valor: "trimestre", label: "Trimestre" },
          { valor: "ano", label: "Ano" },
        ].map((p) => (
          <button
            key={p.valor}
            onClick={() => setPeriodo(p.valor)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              periodo === p.valor
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatarMoeda(dados.receitaTotal)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Despesas Total</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatarMoeda(dados.despesaTotal)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Lucro Líquido</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              dados.lucroLiquido >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatarMoeda(dados.lucroLiquido)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {formatarMoeda(dados.ticketMedio)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Top Clientes</h2>
          {dados.topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum dado disponível
            </p>
          ) : (
            <div className="space-y-3">
              {dados.topClientes.map((cliente, index) => (
                <div
                  key={cliente.nome}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="font-medium">{cliente.nome}</span>
                  </div>
                  <span className="font-semibold text-green-600">
                    {formatarMoeda(cliente.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Despesas por Categoria
          </h2>
          {dados.categoriasDespesas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
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
                      <span className="font-medium">{cat.nome}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatarMoeda(cat.valor)} ({percentual.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-accent">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
