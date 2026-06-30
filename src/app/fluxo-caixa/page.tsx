"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";
import type { Receita, Despesa } from "@/types/database";

interface Movimentacao {
  id: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  data: string;
  status: string;
}

export default function FluxoCaixaPage() {
  const supabase = createClient();
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [saldoAtual, setSaldoAtual] = useState(0);
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [totalSaidas, setTotalSaidas] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
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

      const [receitasRes, despesasRes] = await Promise.all([
        supabase
          .from("receitas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false }),
        supabase
          .from("despesas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false }),
      ]);

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

      const totalE = entradas
        .filter((e) => e.status === "pago")
        .reduce((acc, e) => acc + e.valor, 0);
      const totalS = saidas
        .filter((s) => s.status === "pago")
        .reduce((acc, s) => acc + s.valor, 0);

      setMovimentacoes(todasMovimentacoes);
      setTotalEntradas(totalE);
      setTotalSaidas(totalS);
      setSaldoAtual(totalE - totalS);
      setCarregando(false);
    }

    carregarDados();
  }, [supabase]);

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
        <p className="text-muted-foreground">
          Acompanhe suas entradas e saídas
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo Atual</p>
          <p className={`mt-2 text-2xl font-bold ${saldoAtual >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatarMoeda(saldoAtual)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Entradas</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {formatarMoeda(totalEntradas)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Saídas</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {formatarMoeda(totalSaidas)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">Movimentações</h2>
        </div>
        <div className="divide-y">
          {movimentacoes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma movimentação encontrada
            </div>
          ) : (
            movimentacoes.map((mov) => (
              <div
                key={mov.id}
                className="flex items-center justify-between p-4 hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      mov.tipo === "entrada"
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {mov.tipo === "entrada" ? "💰" : "📤"}
                  </div>
                  <div>
                    <p className="font-medium">{mov.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(mov.data)
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      mov.tipo === "entrada"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {mov.tipo === "entrada" ? "+" : "-"}{" "}
                    {formatarMoeda(mov.valor)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mov.status === "pago" ? "Pago" : "Pendente"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
