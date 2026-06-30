"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";

interface Categoria {
  id: string;
  nome: string;
  icone: string;
  cor: string;
}

export default function DespesasPage() {
  const supabase = createClient();
  const [despesas, setDespesas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    status: "pendente" as string,
    forma_pagamento: "pix" as string,
    categoria_id: "",
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

    const [despesasRes, categoriasRes] = await Promise.all([
      supabase
        .from("despesas")
        .select("*, categoria:categorias_despesas(nome, icone, cor)")
        .eq("negocio_id", negocio.id)
        .order("data", { ascending: false }),
      supabase
        .from("categorias_despesas")
        .select("id, nome, icone, cor")
        .or(`negocio_id.eq.${negocio.id},negocio_id.is.null`)
        .order("nome"),
    ]);

    setDespesas(despesasRes.data || []);
    setCategorias(categoriasRes.data || []);
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

    const { error } = await supabase.from("despesas").insert({
      negocio_id: negocio.id,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data: form.data,
      status: form.status,
      forma_pagamento: form.forma_pagamento,
      categoria_id: form.categoria_id || null,
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
      categoria_id: "",
      observacoes: "",
    });
    carregarDados();
  }

  async function excluirDespesa(id: string) {
    if (confirm("Tem certeza que deseja excluir esta despesa?")) {
      await supabase.from("despesas").delete().eq("id", id);
      carregarDados();
    }
  }

  const despesasFiltradas = filtroCategoria
    ? despesas.filter((d) => d.categoria_id === filtroCategoria)
    : despesas;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Despesas</h1>
          <p className="text-muted-foreground">
            Gerencie suas saídas
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Nova Despesa
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroCategoria("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            filtroCategoria === ""
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground hover:bg-accent/80"
          }`}
        >
          Todas
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFiltroCategoria(cat.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filtroCategoria === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80"
            }`}
          >
            {cat.icone} {cat.nome}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : despesasFiltradas.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
          <div className="mb-4 text-4xl">📤</div>
          <h3 className="mb-2 text-lg font-semibold">
            Nenhuma despesa encontrada
          </h3>
          <p className="mb-4 text-muted-foreground">
            Adicione sua primeira despesa
          </p>
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Adicionar Despesa
          </button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="divide-y">
            {despesasFiltradas.map((despesa) => (
              <div
                key={despesa.id}
                className="flex items-center justify-between p-4 hover:bg-accent/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    style={{
                      backgroundColor: `${despesa.categoria?.cor || "#9E9E9E"}20`,
                    }}
                  >
                    {despesa.categoria?.icone || "📌"}
                  </div>
                  <div>
                    <p className="font-medium">{despesa.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      {despesa.categoria?.nome || "Sem categoria"} ·{" "}
                      {new Intl.DateTimeFormat("pt-BR").format(
                        new Date(despesa.data)
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-red-600">
                      -{formatarMoeda(despesa.valor)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {despesa.status === "pago" ? "Pago" : "Pendente"}
                    </p>
                  </div>
                  <button
                    onClick={() => excluirDespesa(despesa.id)}
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
              <h2 className="text-lg font-semibold">Nova Despesa</h2>
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
                  placeholder="Ex: Compra de materiais"
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
                    Categoria
                  </label>
                  <select
                    value={form.categoria_id}
                    onChange={(e) =>
                      setForm({ ...form, categoria_id: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Selecione uma categoria</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icone} {cat.nome}
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
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
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
