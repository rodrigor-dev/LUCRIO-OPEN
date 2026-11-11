import { createClient } from "@/lib/supabase/client";
import {
  ultimoDiaDoMesISO,
  vencimentoNoMesAtual,
  proximaDataRecorrencia,
  dataNoMes,
  lerISO,
} from "@/lib/recorrencia-datas";
import type { Recorrencia } from "@/types/database";

const supabase = createClient();

// Lock em memória: evita que gerarReceitasRecorrentes/gerarDespesasRecorrentes
// execute duas vezes ao mesmo tempo para o mesmo negócio (Dashboard + Financeiro
// disparam a função ao carregar, causando condição de corrida).
const locksEmExecucao = new Map<string, Promise<unknown>>();

export async function listarRecorrencias(
  negocioId: string,
  tipo?: "receita" | "despesa"
): Promise<Recorrencia[]> {
  let query = supabase
    .from("recorrencias")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("criado_em", { ascending: false });

  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function criarRecorrencia(
  recorrencia: Omit<Recorrencia, "id" | "criado_em" | "atualizado_em">
): Promise<Recorrencia> {
  const { data, error } = await supabase
    .from("recorrencias")
    .insert(recorrencia)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarRecorrencia(
  id: string,
  dados: Partial<Omit<Recorrencia, "id" | "negocio_id" | "criado_em" | "atualizado_em">>
): Promise<Recorrencia> {
  const { data, error } = await supabase
    .from("recorrencias")
    .update(dados)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function excluirRecorrencia(id: string): Promise<void> {
  const { error } = await supabase.from("recorrencias").delete().eq("id", id);
  if (error) throw error;
}

export async function obterRecorrencia(id: string): Promise<Recorrencia | null> {
  const { data, error } = await supabase
    .from("recorrencias")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/** Limite de ciclos gerados por recorrência numa única execução (segurança). */
const MAX_CICLOS_POR_EXECUCAO = 60;

type ClienteFixo = {
  id: string;
  nome: string;
  valor_mensal: number | null;
  dia_vencimento: number | null;
};

/**
 * Gera as receitas de todas as recorrências ativas do negócio até o fim do
 * mês atual. Assim, no começo de cada mês TODOS os clientes fixos já
 * aparecem em Receitas (como "pendente", com o vencimento certo) — antes,
 * só apareciam os clientes cujo dia de vencimento já tinha passado.
 *
 * Também se "autocorrige": cliente fixo ativo que ficou sem recorrência
 * (cadastro antigo, erro de rede na hora de salvar etc.) ganha a recorrência
 * aqui, sem o usuário precisar editar o cliente.
 */
export async function gerarReceitasRecorrentes(negocioId: string): Promise<number> {
  // Se já existe uma execução em andamento para este negócio, reaproveita —
  // Dashboard e Receitas disparam ao carregar.
  const chave = `receita_${negocioId}`;
  const execucaoAnterior = locksEmExecucao.get(chave);
  if (execucaoAnterior) return execucaoAnterior as Promise<number>;

  const promessa = (async () => {
    await garantirRecorrenciasDosClientesFixos(negocioId);
    return _gerarReceitasRecorrentesInterno(negocioId);
  })();
  locksEmExecucao.set(chave, promessa);

  try {
    return await promessa;
  } finally {
    locksEmExecucao.delete(chave);
  }
}

async function _gerarReceitasRecorrentesInterno(negocioId: string): Promise<number> {
  const limite = ultimoDiaDoMesISO();

  const { data: recorrencias, error } = await supabase
    .from("recorrencias")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("tipo", "receita")
    .eq("is_ativa", true)
    .not("proximo_gerar_em", "is", null)
    .lte("proximo_gerar_em", limite);

  if (error) throw error;
  if (!recorrencias || recorrencias.length === 0) return 0;

  let geradas = 0;

  for (const rec of recorrencias as Recorrencia[]) {
    const dataOriginal = rec.proximo_gerar_em as string;
    let data = dataOriginal;
    let ciclos = 0;
    let falhou = false;

    // Gera todos os ciclos pendentes (ex.: usuário ficou 3 meses sem abrir
    // o sistema → gera os 3 meses, não só um por acesso).
    while (data <= limite && ciclos < MAX_CICLOS_POR_EXECUCAO) {
      const { error: insertError } = await supabase.from("receitas").insert({
        negocio_id: rec.negocio_id,
        cliente_id: rec.cliente_id ?? null,
        descricao: rec.descricao,
        valor: rec.valor,
        data,
        data_vencimento: data,
        status: "pendente",
        forma_pagamento: rec.forma_pagamento ?? null,
        recorrencia_tipo: rec.recorrencia,
        recorrencia_id: rec.id,
      });

      // 23505 = já existe receita desta recorrência nesta data (outra aba
      // ou o cadastro do cliente já gerou). Não é erro: só segue em frente.
      if (insertError && insertError.code !== "23505") {
        console.error("[recorrencia] erro ao gerar receita:", insertError);
        falhou = true;
        break;
      }
      if (!insertError) geradas++;

      data = proximaDataRecorrencia(data, rec.recorrencia, rec.dia_vencimento);
      ciclos++;
    }

    if (data !== dataOriginal) {
      const { error: updError } = await supabase
        .from("recorrencias")
        .update({ proximo_gerar_em: data })
        .eq("id", rec.id)
        .eq("proximo_gerar_em", dataOriginal);
      if (updError) console.error("[recorrencia] erro ao avançar data:", updError);
    }

    if (falhou) {
      console.error("[recorrencia] geração interrompida para a recorrência", rec.id);
    }
  }

  return geradas;
}

/**
 * Cria (ou reativa) a recorrência de todo cliente Fixo + ativo + com valor
 * mensal que esteja sem recorrência ativa.
 */
async function garantirRecorrenciasDosClientesFixos(negocioId: string): Promise<void> {
  const [clientesRes, recorrenciasRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, valor_mensal, dia_vencimento")
      .eq("negocio_id", negocioId)
      .eq("tipo", "fixo")
      .eq("is_ativo", true)
      .gt("valor_mensal", 0),
    supabase
      .from("recorrencias")
      .select("*")
      .eq("negocio_id", negocioId)
      .eq("tipo", "receita")
      .not("cliente_id", "is", null),
  ]);

  if (clientesRes.error) throw clientesRes.error;
  if (recorrenciasRes.error) throw recorrenciasRes.error;

  const recorrencias = (recorrenciasRes.data || []) as Recorrencia[];

  for (const cliente of (clientesRes.data || []) as ClienteFixo[]) {
    const doCliente = recorrencias.filter((r) => r.cliente_id === cliente.id);
    if (doCliente.some((r) => r.is_ativa)) continue;

    try {
      await sincronizarRecorrenciaCliente({
        negocioId,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        tipo: "fixo",
        isAtivo: true,
        valorMensal: Number(cliente.valor_mensal),
        diaVencimento: cliente.dia_vencimento,
        recorrenciasDoCliente: doCliente,
        gerarAgora: false,
      });
    } catch (erro) {
      console.error("[recorrencia] erro ao criar recorrência do cliente fixo:", cliente.id, erro);
    }
  }
}

/**
 * Mantém a recorrência mensal de um cliente em sincronia com o cadastro:
 * - Fixo + ativo + valor > 0 → recorrência ativa (cria ou reativa) e a
 *   cobrança do mês atual é gerada na hora.
 * - Qualquer outro caso → recorrência pausada (o histórico é mantido).
 */
export async function sincronizarRecorrenciaCliente(params: {
  negocioId: string;
  clienteId: string;
  clienteNome: string;
  tipo: "fixo" | "esporadico";
  isAtivo: boolean;
  valorMensal: number | null;
  diaVencimento: number | null;
  recorrenciasDoCliente?: Recorrencia[];
  gerarAgora?: boolean;
}): Promise<void> {
  const {
    negocioId,
    clienteId,
    clienteNome,
    tipo,
    isAtivo,
    valorMensal,
    diaVencimento,
    gerarAgora = true,
  } = params;

  let doCliente = params.recorrenciasDoCliente;
  if (!doCliente) {
    const { data, error } = await supabase
      .from("recorrencias")
      .select("*")
      .eq("negocio_id", negocioId)
      .eq("tipo", "receita")
      .eq("cliente_id", clienteId)
      .order("criado_em", { ascending: false });
    if (error) throw error;
    doCliente = (data || []) as Recorrencia[];
  }

  const ativa = doCliente.find((r) => r.is_ativa);
  const existente = ativa ?? doCliente[0];
  const deveEstarAtiva = tipo === "fixo" && isAtivo && !!valorMensal && valorMensal > 0;

  if (!deveEstarAtiva) {
    for (const r of doCliente.filter((r) => r.is_ativa)) {
      await atualizarRecorrencia(r.id, { is_ativa: false });
    }
    return;
  }

  const descricao = `Mensalidade - ${clienteNome}`;
  const vencimentoMesAtual = vencimentoNoMesAtual(diaVencimento);

  if (existente) {
    let proximo = existente.proximo_gerar_em ?? vencimentoMesAtual;

    if (!existente.is_ativa) {
      // Reativando: retoma a partir do mês atual (não cobra meses parados).
      proximo = vencimentoMesAtual;
    } else if (diaVencimento && existente.dia_vencimento !== diaVencimento && existente.proximo_gerar_em) {
      // Mudou o dia de vencimento: ajusta o próximo ciclo para o novo dia.
      const { ano, mes } = lerISO(existente.proximo_gerar_em);
      proximo = dataNoMes(ano, mes, diaVencimento);
    }

    const { error } = await supabase
      .from("recorrencias")
      .update({
        valor: valorMensal,
        descricao,
        dia_vencimento: diaVencimento ?? null,
        is_ativa: true,
        proximo_gerar_em: proximo,
      })
      .eq("id", existente.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("recorrencias").insert({
      negocio_id: negocioId,
      cliente_id: clienteId,
      tipo: "receita",
      recorrencia: "mensal",
      valor: valorMensal,
      descricao,
      dia_vencimento: diaVencimento ?? null,
      is_ativa: true,
      proximo_gerar_em: vencimentoMesAtual,
    });
    // 23505: outra aba criou a recorrência ao mesmo tempo — tudo certo.
    if (error && error.code !== "23505") throw error;
  }

  if (gerarAgora) {
    await _gerarReceitasRecorrentesInterno(negocioId);
  }
}
