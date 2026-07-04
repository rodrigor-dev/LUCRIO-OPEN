export const FORMAS_PAGAMENTO: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
  cartao: "Cartão",
};

export const FORMAS_PAGAMENTO_DESPESA: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
  atrasado: "Atrasado",
  concluido: "Concluído",
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

export const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  pago: "default",
  cancelado: "destructive",
  atrasado: "destructive",
  concluido: "default",
  rascunho: "outline",
  enviada: "secondary",
  aceita: "default",
  recusada: "destructive",
  expirada: "outline",
};

export const RECORRENCIA_OPCOES = [
  { valor: "mensal", label: "Mensal" },
  { valor: "semanal", label: "Semanal" },
  { valor: "quinzenal", label: "Quinzenal" },
  { valor: "anual", label: "Anual" },
] as const;

export const FORMAS_PAGAMENTO_ARRAY = Object.entries(FORMAS_PAGAMENTO).map(([valor, label]) => ({
  valor,
  label,
}));
