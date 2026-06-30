"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PWAUpdater from "@/components/pwa-updater";
import InstallBanner from "@/components/install-banner";
import type { Usuario, Negocio } from "@/types/database";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/clientes", label: "Clientes", icon: "👥" },
  { href: "/servicos", label: "Serviços", icon: "🔧" },
  { href: "/receitas", label: "Receitas", icon: "💰" },
  { href: "/despesas", label: "Despesas", icon: "📤" },
  { href: "/fluxo-caixa", label: "Fluxo de Caixa", icon: "🏦" },
  { href: "/propostas", label: "Propostas", icon: "📄" },
  { href: "/relatorios", label: "Relatórios", icon: "📈" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const supabase = createClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarDados() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: negocioData } = await supabase
        .from("negocios")
        .select("*")
        .eq("usuario_id", user.id)
        .single();

      setUsuario(usuarioData);
      setNegocio(negocioData);
      setCarregando(false);
    }

    carregarDados();
  }, [supabase, router]);

  async function handleSair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-card shadow-lg transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          menuAberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b px-4">
            <Link href="/dashboard" className="text-2xl font-bold text-primary">
              LUCRIO
            </Link>
            <button
              onClick={() => setMenuAberto(false)}
              className="lg:hidden"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMenuAberto(false)}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="border-t p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                {usuario?.nome?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {usuario?.nome || "Usuário"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {negocio?.nome || "Meu Negócio"}
                </p>
              </div>
            </div>
            <button
              onClick={handleSair}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <span>🚪</span>
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <button
            onClick={() => setMenuAberto(true)}
            className="lg:hidden"
          >
            <span className="text-xl">☰</span>
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            <Link
              href="/configuracoes"
              className="flex h-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              <span>⚙️</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <PWAUpdater />
      <InstallBanner />
    </div>
  );
}
