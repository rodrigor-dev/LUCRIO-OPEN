"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";

interface Cliente {
  id: string;
  nome: string;
}

export default function ReceitasPage() {
  const supabase = createClient();
  const [receitas, setReceitas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("");

  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    status: "pendente" as string,
    forma_pagamento: "pix" as string,
    cliente_id: "",
    observacoes: "",
  });

  useEffect(() => {
    carregarDados();
  }, [supabase]);

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

    const [receitasRes, clientesRes] = await Promise.all([
      supabase
        .from("receitas")
        .select("*, cliente:clientes(nome)")
        .eq("negocio_id", negocio.id)
        .order("data", { ascending: false }),
      supabase
        .from("clientes")
        .select("id, nome")
        .eq("negocio_id", negocio.id)
        .order("nome"),
    ]);

    setReceitas(receitasRes.data || []);
    setClientes(clientesRes.data || []);
    setCarregando(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

    const { error } = await supabase.from("receitas").insert({
      negocio_id: negocio.id,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data: form.data,
      status: form.status,
      forma_pagamento: form.forma_pagamento,
      cliente_id: form.cliente_id || null,
      observacoes: form.observacoes,
    });

    if (error) {
      console.error(error);
      return;
    }

    setModalAberto(false);
    setForm({
      descricao: "",
      valor: "",
      data: new Date().toISOString().split("T")[0],
      status: "pendente",
      forma_pagamento: "pix",
      cliente_id: "",
      observacoes: "",
    });
    carregarDados();
  }

  async function excluirReceita(id: string) {
    if (confirm("Tem certeza que deseja excluir esta receita?")) {
      await supabase.from("receitas").delete().eq("id", id);
      carregarDados();
    }
  }

  const receitasFiltradas = filtroStatus
    ? receitas.filter((r) => r.status === filtroStatus)
    : receitas;

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-700",
    pago: "bg-green-100 text-green-700",
    cancelado: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Receitas</h1>
          <p className="text-muted-foreground">
            Gerencie suas entradas
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Nova Receita
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "pendente", "pago", "cancelado"].map((status) => (
          <button
            key={status}
            onClick={() => setFiltroStatus(status)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filtroStatus === status
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {status === "" ? "Todos" : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : receitasFiltradas.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
          <div className="mb-4 text-4xl">💰</div>
          <h3 className="mb-2 text-lg font-semibold">Nenhuma receita encontrada</h3>
          <p className="mb-4 text-muted-foreground">Adicione sua primeira receita</p>
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Adicionar Receita
          </button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="divide-y">
            {receitasFiltradas.map((receita) => (
              <div
                key={receita.id}
                className="flex items-center justify-between p-4 hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                    💰
                  </div>
                  <div>
                    <p className="font-medium">{receita.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      {receita.cliente?.nome && `${receita.cliente?.nome} · `}
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(receita.data)
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatarMoeda(receita.valor)}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[receita.status] || ""
                      }`}
                    >
                      {receita.status === "pago" ? "Pago" : receita.status === "pendente" ? "Pendente" : "Cancelado"}
                    </span>
                  </div>
                  <button
                    onClick={() => excluirReceita(receita.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-card shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Nova Receita</h2>
              <button
                onClick={() => setModalAberto(false)}
                className="text-xl text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Descrição *
                </label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                  required
                  placeholder="Ex: Serviço de instalação"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor}
                    onChange={(e) =>
                      setForm({ ...form, valor: e.target.value })
                    }
                    required
                    placeholder="0,00"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Forma de Pagamento
                  </label>
                  <select
                    value={form.forma_pagamento}
                    onChange={(e) =>
                      setForm({ ...form, forma_pagamento: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="cartao">Cartão</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Cliente
                </label>
                <select
                  value={form.cliente_id}
                  onChange={(e) =>
                    setForm({ ...form, cliente_id: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
