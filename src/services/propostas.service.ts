import { createClient } from "@/lib/supabase/client";
import type { PropostaComercial, ItemProposta } from "@/types/database";

const supabase = createClient();

export async function listarPropostas(
  negocioId: string
): Promise<PropostaComercial[]> {
  const { data, error } = await supabase
    .from("propostas")
    .select("*, cliente:clientes(nome)")
    .eq("negocio_id", negocioId)
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function obterProposta(id: string): Promise<PropostaComercial | null> {
  const { data, error } = await supabase
    .from("propostas")
    .select("*, cliente:clientes(*), itens:itens_proposta(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarProposta(
  proposta: Omit<PropostaComercial, "id" | "criado_em" | "atualizado_em">,
  itens: Omit<ItemProposta, "id" | "proposta_id" | "criado_em">[]
): Promise<PropostaComercial> {
  const { data: propostaData, error: propostaError } = await supabase
    .from("propostas")
    .insert(proposta)
    .select()
    .single();

  if (propostaError) throw propostaError;

  if (itens.length > 0) {
    const itensComProposta = itens.map((item) => ({
      ...item,
      proposta_id: propostaData.id,
    }));

    const { error: itensError } = await supabase
      .from("itens_proposta")
      .insert(itensComProposta);

    if (itensError) throw itensError;
  }

  return propostaData;
}

export async function atualizarProposta(
  id: string,
  dados: Partial<PropostaComercial>,
  itens?: Omit<ItemProposta, "id" | "proposta_id" | "criado_em">[]
): Promise<PropostaComercial> {
  const { data, error } = await supabase
    .from("propostas")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (itens) {
    await supabase.from("itens_proposta").delete().eq("proposta_id", id);

    if (itens.length > 0) {
      const itensComProposta = itens.map((item) => ({
        ...item,
        proposta_id: id,
      }));

      await supabase.from("itens_proposta").insert(itensComProposta);
    }
  }

  return data;
}

export async function excluirProposta(id: string): Promise<void> {
  const { error } = await supabase.from("propostas").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicarProposta(id: string): Promise<PropostaComercial> {
  const proposta = await obterProposta(id);
  if (!proposta) throw new Error("Proposta não encontrada");

  const propostaData = proposta as PropostaComercial & {
    cliente?: { id: string };
    itens?: ItemProposta[];
  };

  const itens = propostaData.itens?.map((item) => ({
    descricao: item.descricao,
    quantidade: item.quantidade,
    valor_unitario: item.valor_unitario,
    total: item.total,
    observacoes: item.observacoes,
  })) || [];

  return criarProposta(
    {
      negocio_id: proposta.negocio_id,
      cliente_id: propostaData.cliente?.id,
      numero_proposta: `${proposta.numero_proposta}-COPIA`,
      validade: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0],
      status: "rascunho",
      subtotal: proposta.subtotal,
      desconto: proposta.desconto,
      frete: proposta.frete,
      total: proposta.total,
      condicoes_gerais: proposta.condicoes_gerais,
      observacoes: proposta.observacoes,
    },
    itens
  );
}
