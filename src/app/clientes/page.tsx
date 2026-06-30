"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda, formatarTelefone } from "@/utils";
import type { Cliente } from "@/types/database";

export default function ClientesPage() {
  const supabase = createClient();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    whatsapp: "",
    email: "",
    cpf_cnpj: "",
    tipo: "esporadico" as "fixo" | "esporadico",
    observacoes: "",
  });

  useEffect(() => {
    carregarClientes();
  }, [supabase]);

  async function carregarClientes() {
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

    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("negocio_id", negocio.id)
      .order("nome");

    setClientes(data || []);
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

    if (clienteEditando) {
      await supabase
        .from("clientes")
        .update(form)
        .eq("id", clienteEditando.id);
    } else {
      await supabase.from("clientes").insert({
        negocio_id: negocio.id,
        ...form,
      });
    }

    setModalAberto(false);
    setClienteEditando(null);
    setForm({
      nome: "",
      telefone: "",
      whatsapp: "",
      email: "",
      cpf_cnpj: "",
      tipo: "esporadico",
      observacoes: "",
    });
    carregarClientes();
  }

  function editarCliente(cliente: Cliente) {
    setClienteEditando(cliente);
    setForm({
      nome: cliente.nome,
      telefone: cliente.telefone || "",
      whatsapp: cliente.whatsapp || "",
      email: cliente.email || "",
      cpf_cnpj: cliente.cpf_cnpj || "",
      tipo: cliente.tipo,
      observacoes: cliente.observacoes || "",
    });
    setModalAberto(true);
  }

  async function excluirCliente(id: string) {
    if (confirm("Tem certeza que deseja excluir este cliente?")) {
      await supabase.from("clientes").delete().eq("id", id);
      carregarClientes();
    }
  }

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.email?.toLowerCase().includes(busca.toLowerCase()) ||
      c.telefone?.includes(busca)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie seus clientes ({clientes.length})
          </p>
        </div>
        <button
          onClick={() => {
            setClienteEditando(null);
            setForm({
              nome: "",
              telefone: "",
              whatsapp: "",
              email: "",
              cpf_cnpj: "",
              tipo: "esporadico",
              observacoes: "",
            });
            setModalAberto(true);
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Novo Cliente
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          🔍
        </span>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
          <div className="mb-4 text-4xl">👥</div>
          <h3 className="mb-2 text-lg font-semibold">
            {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </h3>
          <p className="mb-4 text-muted-foreground">
            {busca
              ? "Tente buscar com outros termos"
              : "Adicione seu primeiro cliente"}
          </p>
          {!busca && (
            <button
              onClick={() => setModalAberto(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Adicionar Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((cliente) => (
            <div
              key={cliente.id}
              className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {cliente.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{cliente.nome}</p>
                    {cliente.email && (
                      <p className="text-sm text-muted-foreground">
                        {cliente.email}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    cliente.tipo === "fixo"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {cliente.tipo === "fixo" ? "Fixo" : "Esporádico"}
                </span>
              </div>

              {cliente.telefone && (
                <p className="mb-1 text-sm text-muted-foreground">
                  📱 {formatarTelefone(cliente.telefone)}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => editarCliente(cliente)}
                  className="flex-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Editar
                </button>
                <button
                  onClick={() => excluirCliente(cliente.id)}
                  className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-card shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">
                {clienteEditando ? "Editar Cliente" : "Novo Cliente"}
              </h2>
              <button
                onClick={() => {
                  setModalAberto(false);
                  setClienteEditando(null);
                }}
                className="text-xl text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={form.telefone}
                    onChange={(e) =>
                      setForm({ ...form, telefone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    WhatsApp
                  </label>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={(e) =>
                      setForm({ ...form, whatsapp: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  E-mail
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    CPF/CNPJ
                  </label>
                  <input
                    type="text"
                    value={form.cpf_cnpj}
                    onChange={(e) =>
                      setForm({ ...form, cpf_cnpj: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tipo
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tipo: e.target.value as "fixo" | "esporadico",
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="esporadico">Esporádico</option>
                    <option value="fixo">Fixo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Observações
                </label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) =>
                    setForm({ ...form, observacoes: e.target.value })
                  }
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalAberto(false);
                    setClienteEditando(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {clienteEditando ? "Salvar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
