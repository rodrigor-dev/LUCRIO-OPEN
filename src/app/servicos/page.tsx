"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";

interface Cliente {
  id: string;
  nome: string;
}

export default function ServicosPage() {
  const supabase = createClient();
  const [servicos, setServicos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    categoria: "",
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

    const [servicosRes, clientesRes] = await Promise.all([
      supabase
        .from("servicos")
        .select("*, cliente:clientes(nome)")
        .eq("negocio_id", negocio.id)
        .order("data", { ascending: false }),
      supabase
        .from("clientes")
        .select("id, nome")
        .eq("negocio_id", negocio.id)
        .order("nome"),
    ]);

    setServicos(servicosRes.data || []);
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

    const { error } = await supabase.from("servicos").insert({
      negocio_id: negocio.id,
      nome: form.nome,
      descricao: form.descricao,
      categoria: form.categoria,
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
      nome: "",
      descricao: "",
      categoria: "",
      valor: "",
      data: new Date().toISOString().split("T")[0],
      status: "pendente",
      forma_pagamento: "pix",
      cliente_id: "",
      observacoes: "",
    });
    carregarDados();
  }

  async function excluirServico(id: string) {
    if (confirm("Tem certeza que deseja excluir este serviço?")) {
      await supabase.from("servicos").delete().eq("id", id);
      carregarDados();
    }
  }

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-700",
    concluido: "bg-green-100 text-green-700",
    cancelado: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Serviços</h1>
          <p className="text-muted-foreground">
            Gerencie seus serviços realizados
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Novo Serviço
        </button>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : servicos.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
          <div className="mb-4 text-4xl">🔧</div>
          <h3 className="mb-2 text-lg font-semibold">Nenhum serviço registrado</h3>
          <p className="mb-4 text-muted-foreground">Registre seu primeiro serviço</p>
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Registrar Serviço
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servicos.map((servico) => (
            <div
              key={servico.id}
              className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-medium">{servico.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {servico.cliente?.nome || "Sem cliente"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    statusColors[servico.status] || ""
                  }`}
                >
                  {servico.status === "concluido" ? "Concluído" : servico.status.charAt(0).toUpperCase() + servico.status.slice(1)}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor</p>
                  <p className="text-lg font-bold">{formatarMoeda(servico.valor)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => excluirServico(servico.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-card shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Novo Serviço</h2>
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
                  Nome do Serviço *
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  placeholder="Ex: Instalação elétrica"
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
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
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
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
