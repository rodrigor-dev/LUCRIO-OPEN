interface LogoMarkProps {
  className?: string;
}

/**
 * Marca do FATURION: um "F" geométrico com um destaque em dourado no canto,
 * lembrando um "recibo confirmado" (fatura em dia). Desenhado em SVG puro
 * para ficar nítido em qualquer tamanho, do ícone do app à tela de login.
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4.5" y="3.5" width="3.4" height="17" rx="1.2" fill="currentColor" />
      <rect x="4.5" y="3.5" width="11.5" height="3.4" rx="1.2" fill="currentColor" />
      <rect x="4.5" y="10" width="8.5" height="3.4" rx="1.2" fill="currentColor" />
      <circle cx="18.3" cy="17.7" r="3.2" fill="#F5B942" />
      <path
        d="M16.9 17.7l1 1 1.7-2"
        stroke="#0F172A"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
