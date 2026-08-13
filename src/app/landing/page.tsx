import type { Metadata } from "next";
import { LandingContent } from "@/components/landing-content";

export const metadata: Metadata = {
  title: "FATURION - Gestão Financeira para Prestadores de Serviços",
  description:
    "Sistema financeiro completo para autônomos, MEIs e pequenos empresários. Controle receitas, despesas, clientes e propostas comerciais.",
};

/**
 * URL fixa da landing page (faturion.com/landing), pensada pra usar em
 * campanhas de anúncio: sempre mostra a página de marketing, direto,
 * sem checar sessão nem redirecionar pra /login ou /dashboard — mesmo
 * que a pessoa que clicar no anúncio já tenha usado o sistema antes
 * nesse aparelho.
 */
export default function LandingPage() {
  return <LandingContent />;
}
