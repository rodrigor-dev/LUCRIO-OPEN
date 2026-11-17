/**
 * Máscaras e validações dos dados da empresa (Configurações > Negócio).
 * Funções novas e isoladas: não alteram os formatadores já usados em outras telas.
 */

export const apenasDigitos = (valor: string) => (valor || "").replace(/\D/g, "");

/** Máscara enquanto digita: CPF até 11 dígitos, CNPJ até 14. */
export function mascaraDocumento(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function mascaraTelefone(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCEP(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function cpfValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(d[t])) return false;
  }
  return true;
}

export function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(d.slice(0, 12)) === Number(d[12]) && calc(d.slice(0, 13)) === Number(d[13]);
}

/** Retorna a mensagem de erro, ou null se estiver ok (vazio é permitido). */
export function erroDocumento(valor: string): string | null {
  const d = apenasDigitos(valor);
  if (!d) return null;
  if (d.length === 11) return cpfValido(d) ? null : "CPF inválido. Confira os números.";
  if (d.length === 14) return cnpjValido(d) ? null : "CNPJ inválido. Confira os números.";
  return "Digite os 11 números do CPF ou os 14 do CNPJ.";
}

export function erroEmail(valor: string): string | null {
  const v = (valor || "").trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido.";
}

export function erroTelefone(valor: string): string | null {
  const d = apenasDigitos(valor);
  if (!d) return null;
  return d.length === 10 || d.length === 11 ? null : "Telefone com DDD: 10 ou 11 números.";
}

export interface EnderecoViaCep {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** Busca o endereço pelo CEP (ViaCEP). Retorna null se não encontrar. */
export async function buscarCEP(cep: string): Promise<EnderecoViaCep | null> {
  const d = apenasDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 6000);
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: controle.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.erro) return null;
    return {
      rua: j.logradouro || "",
      bairro: j.bairro || "",
      cidade: j.localidade || "",
      estado: j.uf || "",
    };
  } catch {
    return null;
  }
}

/** Linha de endereço para o orçamento. */
export function enderecoEmLinha(e?: {
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
} | null): string {
  if (!e) return "";
  const ruaNumero = [e.rua, e.numero].filter(Boolean).join(", ");
  const primeira = [ruaNumero, e.complemento].filter(Boolean).join(" - ");
  const cidadeUf = [e.cidade, e.estado].filter(Boolean).join("/");
  const partes = [primeira, e.bairro, cidadeUf, e.cep ? `CEP ${e.cep}` : ""].filter(Boolean);
  return partes.join(" - ");
}
