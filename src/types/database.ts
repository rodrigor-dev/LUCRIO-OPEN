export interface Usuario {
  id: string;
  email: string;
  nome: string;
  avatar_url?: string;
  telefone?: string;
  is_admin: boolean;
  plano_id?: string;
  trial_termina_em?: string;
  is_ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Plano {
  id: string;
  nome: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  moeda: string;
  funcionalidades: string[];
  max_clientes?: number;
  max_servicos?: number;
  is_ativo: boolean;
  criado_em: string;
}

export interface Negocio {
  id: string;
  usuario_id: string;
  nome: string;
  cnpj_cpf?: string;
  telefone?: string;
  email?: string;
  endereco: Endereco;
  logo_url?: string;
  is_ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Endereco {
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export interface Cliente {
  id: string;
  negocio_id: string;
  nome: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  cpf_cnpj?: string;
  endereco: Endereco;
  tipo: "fixo" | "esporadico";
  valor_mensal?: number;
  dia_vencimento?: number;
  fornecedor?: string;
  observacoes?: string;
  is_ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Servico {
  id: string;
  negocio_id: string;
  cliente_id?: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  valor: number;
  data: string;
  status: "pendente" | "concluido" | "cancelado";
  forma_pagamento?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Receita {
  id: string;
  negocio_id: string;
  cliente_id?: string;
  servico_id?: string;
  descricao: string;
  valor: number;
  data: string;
  data_vencimento?: string;
  data_pagamento?: string;
  status: "pendente" | "pago" | "cancelado" | "atrasado";
  forma_pagamento?: string;
  comprovante_url?: string;
  recorrencia_tipo?: string;
  recorrencia_id?: string;
  parcela_numero?: number;
  parcela_total?: number;
  grupo_parcela_id?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Despesa {
  id: string;
  negocio_id: string;
  categoria_id: string;
  descricao: string;
  valor: number;
  data: string;
  data_vencimento?: string;
  data_pagamento?: string;
  fornecedor?: string;
  forma_pagamento?: string;
  status: "pendente" | "pago" | "cancelado" | "atrasado";
  observacoes?: string;
  comprovante_url?: string;
  parcela_numero?: number;
  parcela_total?: number;
  grupo_parcela_id?: string;
  cartao_tipo?: "avista" | "parcelado";
  cartao_parcelas?: number;
  cartao_valor_total?: number;
  criado_em: string;
  atualizado_em: string;
}

export interface CategoriaDespesa {
  id: string;
  negocio_id: string;
  nome: string;
  icone?: string;
  cor?: string;
  tipo: "padrao" | "personalizada";
  is_ativo: boolean;
  criado_em: string;
}

export interface ContaBancaria {
  id: string;
  negocio_id: string;
  nome_banco: string;
  numero_conta: string;
  agencia?: string;
  tipo_conta: "corrente" | "poupanca";
  saldo: number;
  is_ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface PropostaComercial {
  id: string;
  negocio_id: string;
  cliente_id?: string;
  numero_proposta: string;
  validade: string;
  status: "rascunho" | "enviada" | "aceita" | "recusada" | "expirada";
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  condicoes_gerais?: string;
  observacoes?: string;
  pdf_url?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface ItemProposta {
  id: string;
  proposta_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  total: number;
  observacoes?: string;
  criado_em: string;
}

export interface Assinatura {
  id: string;
  usuario_id: string;
  plano_id: string;
  status: "trial" | "ativo" | "atrasado" | "cancelado" | "incompleto";
  inicio_periodo: string;
  fim_periodo: string;
  trial_termina?: string;
  cancelar_ao_fim_periodo: boolean;
  cancelado_em?: string;
  metodo_pagamento_id?: string;
  intent_pagamento_id?: string;
  ultimo_pagamento?: string;
  proximo_pagamento?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Pagamento {
  id: string;
  assinatura_id?: string;
  negocio_id?: string;
  valor: number;
  moeda: string;
  status: "pendente" | "concluido" | "falhou" | "reembolsado";
  metodo_pagamento?: string;
  data_pagamento?: string;
  transacao_id?: string;
  metadata?: Record<string, unknown>;
  criado_em: string;
  atualizado_em: string;
}

export interface LogAtividade {
  id: string;
  usuario_id: string;
  acao: string;
  entidade_tipo: string;
  entidade_id?: string;
  alteracoes?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  criado_em: string;
}

export interface Recorrencia {
  id: string;
  negocio_id: string;
  cliente_id?: string;
  tipo: "receita" | "despesa";
  recorrencia: "mensal" | "semanal" | "quinzenal" | "anual";
  valor: number;
  descricao: string;
  categoria_id?: string;
  forma_pagamento?: string;
  dia_vencimento?: number;
  is_ativa: boolean;
  proximo_gerar_em?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface CalendarioItem {
  id: string;
  negocio_id: string;
  cliente_id?: string;
  fornecedor?: string;
  descricao: string;
  valor: number;
  data_evento: string;
  tipo: "receita" | "despesa";
  status: string;
  data_vencimento?: string;
  data_pagamento?: string;
  cliente_nome?: string;
}

export interface ResumoCliente {
  cliente_id: string;
  negocio_id: string;
  nome: string;
  tipo: string;
  valor_mensal?: number;
  is_ativo: boolean;
  total_recebido: number;
  total_em_aberto: number;
  total_pagos: number;
  total_atrasados: number;
  total_pendentes: number;
  ultimo_pagamento?: string;
  total_receitas: number;
  primeira_receita?: string;
}

export interface KPIDashboard {
  negocio_id: string;
  receita_mes: number;
  a_receber: number;
  atrasado: number;
  despesa_mes: number;
  mrr: number;
}
