"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/utils";
import { gerarNumeroProposta } from "@/utils";

interface ItemProposta {
  id?: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  total: number;
}

interface Cliente {
  id: string;
  nome: string;
}

export default function PropostasPage() {
  const supabase = createClient();
  const [propostas, setPropostas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [form, setForm] = useState({
    cliente_id: "",
    validade: "",
    desconto: 0,
    frete: 0,
    condicoes_gerais: "",
    observacoes: "",
  });

  const [itens, setItens] = useState<ItemProposta[]>([
    { descricao: "", quantidade: 1, valor_unitario: 0, total: 0 },
  ]);

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

      const [propostasRes, clientesRes] = await Promise.all([
        supabase
          .from("propostas")
          .select("*, cliente:clientes(nome)")
          .eq("negocio_id", negocio.id)
          .order("criado_em", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome")
          .eq("negocio_id", negocio.id)
          .order("nome"),
      ]);

      setPropostas(propostasRes.data || []);
      setClientes(clientesRes.data || []);
      setCarregando(false);
    }

    carregarDados();
  }, [supabase]);

  function atualizarItem(
    index: number,
    campo: keyof ItemProposta,
    valor: string | number
  ) {
    const novosItens = [...itens];
    novosItens[index] = {
      ...novosItens[index],
      [campo]: valor,
    };

    if (campo === "quantidade" || campo === "valor_unitario") {
      novosItens[index].total =
        novosItens[index].quantidade * novosItens[index].valor_unitario;
    }

    setItens(novosItens);
  }

  function adicionarItem() {
    setItens([
      ...itens,
      { descricao: "", quantidade: 1, valor_unitario: 0, total: 0 },
    ]);
  }

  function removerItem(index: number) {
    if (itens.length > 1) {
      setItens(itens.filter((_, i) => i !== index));
    }
  }

  const subtotal = itens.reduce((acc, item) => acc + item.total, 0);
  const total = subtotal - form.desconto + form.frete;

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

    const validade = new Date();
    validade.setDate(validade.getDate() + 30);

    const { data: proposta, error } = await supabase
      .from("propostas")
      .insert({
        negocio_id: negocio.id,
        cliente_id: form.cliente_id || null,
        numero_proposta: gerarNumeroProposta(),
        validade: form.validade || validade.toISOString().split("T")[0],
        status: "rascunho",
        subtotal,
        desconto: form.desconto,
        frete: form.frete,
        total,
        condicoes_gerais: form.condicoes_gerais,
        observacoes: form.observacoes,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (proposta) {
      const itensParaInserir = itens
        .filter((item) => item.descricao)
        .map((item) => ({
          proposta_id: proposta.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          total: item.total,
        }));

      if (itensParaInserir.length > 0) {
        await supabase.from("itens_proposta").insert(itensParaInserir);
      }
    }

    setModalAberto(false);
    setForm({
      cliente_id: "",
      validade: "",
      desconto: 0,
      frete: 0,
      condicoes_gerais: "",
      observacoes: "",
    });
    setItens([{ descricao: "", quantidade: 1, valor_unitario: 0, total: 0 }]);
  }

  const statusColors: Record<string, string> = {
    rascunho: "bg-gray-100 text-gray-700",
    enviada: "bg-blue-100 text-blue-700",
    aceita: "bg-green-100 text-green-700",
    recusada: "bg-red-100 text-red-700",
    expirada: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propostas Comerciais</h1>
          <p className="text-muted-foreground">
            Gerencie suas propostas
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Nova Proposta
        </button>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : propostas.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
          <div className="mb-4 text-4xl">📄</div>
          <h3 className="mb-2 text-lg font-semibold">
            Nenhuma proposta encontrada
          </h3>
          <p className="mb-4 text-muted-foreground">
            Crie sua primeira proposta comercial
          </p>
          <button
            onClick={() => setModalAberto(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Criar Proposta
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {propostas.map((proposta) => (
            <div
              key={proposta.id}
              className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {proposta.numero_proposta}
                  </p>
                  <p className="font-medium">
                    {proposta.cliente?.nome || "Sem cliente"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    statusColors[proposta.status] || ""
                  }`}
                >
                  {proposta.status.charAt(0).toUpperCase() +
                    proposta.status.slice(1)}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">
                    {formatarMoeda(proposta.total)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Válido até{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(
                    new Date(proposta.validade)
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Nova Proposta</h2>
              <button
                onClick={() => setModalAberto(false)}
                className="text-xl text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Cliente (opcional)
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
                    Validade
                  </label>
                  <input
                    type="date"
                    value={form.validade}
                    onChange={(e) =>
                      setForm({ ...form, validade: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Itens</label>
                  <button
                    type="button"
                    onClick={adicionarItem}
                    className="text-sm text-primary hover:underline"
                  >
                    + Adicionar item
                  </button>
                </div>
                <div className="space-y-2">
                  {itens.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        placeholder="Descrição"
                        value={item.descricao}
                        onChange={(e) =>
                          atualizarItem(index, "descricao", e.target.value)
                        }
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Qtd"
                        value={item.quantidade}
                        onChange={(e) =>
                          atualizarItem(
                            index,
                            "quantidade",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Valor"
                        value={item.valor_unitario}
                        onChange={(e) =>
                          atualizarItem(
                            index,
                            "valor_unitario",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <span className="flex items-center text-sm text-muted-foreground">
                        {formatarMoeda(item.total)}
                      </span>
                      {itens.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerItem(index)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Desconto (R$)
                  </label>
                  <input
                    type="number"
                    value={form.desconto}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        desconto: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Frete (R$)
                  </label>
                  <input
                    type="number"
                    value={form.frete}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        frete: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Condições Gerais
                </label>
                <textarea
                  value={form.condicoes_gerais}
                  onChange={(e) =>
                    setForm({ ...form, condicoes_gerais: e.target.value })
                  }
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-accent p-4">
                <span className="font-medium">Total da Proposta:</span>
                <span className="text-xl font-bold">
                  {formatarMoeda(total)}
                </span>
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
                  Criar Proposta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
