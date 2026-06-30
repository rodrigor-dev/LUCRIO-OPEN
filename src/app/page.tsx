import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8">
          <h1 className="mb-4 text-6xl font-bold text-primary">LUCRIO</h1>
          <p className="text-xl text-muted-foreground">
            Gestão Financeira para Prestadores de Serviços
          </p>
        </div>

        <p className="mb-8 text-lg text-muted-foreground">
          Controle suas receitas, despesas, clientes e propostas comerciais em
          um só lugar. Feito para eletricistas, encanadores, designers,
          fotógrafos e todos os profissionais autônomos.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/cadastro"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Comece Grátis
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Já tenho conta
          </Link>
        </div>

        <div className="mt-16 grid gap-8 text-left sm:grid-cols-3">
          <div className="rounded-lg border p-6">
            <div className="mb-3 text-3xl">💰</div>
            <h3 className="mb-2 font-semibold">Controle Financeiro</h3>
            <p className="text-sm text-muted-foreground">
              Receitas, despesas, fluxo de caixa e relatórios completos.
            </p>
          </div>
          <div className="rounded-lg border p-6">
            <div className="mb-3 text-3xl">👥</div>
            <h3 className="mb-2 font-semibold">Gestão de Clientes</h3>
            <p className="text-sm text-muted-foreground">
              Cadastro completo com clientes fixos e esporádicos.
            </p>
          </div>
          <div className="rounded-lg border p-6">
            <div className="mb-3 text-3xl">📄</div>
            <h3 className="mb-2 font-semibold">Propostas Comerciais</h3>
            <p className="text-sm text-muted-foreground">
              Gere propostas profissionais em PDF e envie por WhatsApp.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
