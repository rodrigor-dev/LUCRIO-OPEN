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
  status: "pendente" | "pago" | "cancelado";
  forma_pagamento?: string;
  comprovante_url?: string;
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
  forma_pagamento?: string;
  status: "pendente" | "pago" | "cancelado";
  observacoes?: string;
  comprovante_url?: string;
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
