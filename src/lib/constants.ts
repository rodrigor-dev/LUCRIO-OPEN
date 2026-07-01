export const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "PIX",
  transferencia: "Transferência",
};

export const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
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
  concluido: "default",
  rascunho: "outline",
  enviada: "secondary",
  aceita: "default",
  recusada: "destructive",
  expirada: "outline",
};

export const FORMAS_PAGAMENTO_ARRAY = Object.entries(FORMAS_PAGAMENTO).map(([valor, label]) => ({
  valor,
  label,
}));
