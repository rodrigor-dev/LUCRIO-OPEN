import { toast } from "sonner";

export function toastComDesfazer(
  message: string,
  onDesfazer: () => Promise<void>
) {
  toast.error(message, {
    action: {
      label: "Desfazer",
      onClick: async () => {
        try {
          await onDesfazer();
          toast.success("Ação desfeita com sucesso!");
        } catch {
          toast.error("Erro ao desfazer");
        }
      },
    },
    duration: 5000,
  });
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export function formatarMoedaSemSimbolo(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

export function formatarData(data: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

export function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

export function formatarPercentual(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor / 100);
}

export function formatarTelefone(telefone: string): string {
  const numeros = telefone.replace(/\D/g, "");
  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }
  if (numeros.length === 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }
  return telefone;
}

export function formatarCPFCNPJ(valor: string): string {
  const numeros = valor.replace(/\D/g, "");
  if (numeros.length === 11) {
    return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9)}`;
  }
  if (numeros.length === 14) {
    return `${numeros.slice(0, 2)}.${numeros.slice(2, 5)}.${numeros.slice(5, 8)}/${numeros.slice(8, 12)}-${numeros.slice(12)}`;
  }
  return valor;
}

export function gerarNumeroProposta(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const aleatorio = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, "0");
  return `PROP-${ano}${mes}-${aleatorio}`;
}

export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function obterMesAno(data: string): string {
  const d = new Date(data);
  return `${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function diasRestantes(dataFim: string): number {
  const fim = new Date(dataFim);
  const agora = new Date();
  const diff = fim.getTime() - agora.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
