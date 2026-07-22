"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Wrench,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  BarChart3,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Gift,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authService, type UserProfile } from "@/services/auth.service";
import PWAUpdater from "@/components/pwa-updater";
import InstallBanner from "@/components/install-banner";
import BottomNav from "@/components/bottom-nav";
import CommandPalette from "@/components/command-palette";
import { SkipToContent } from "@/components/skip-to-content";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SubscriptionGuard from "@/components/subscription-guard";
import { LogoMark } from "@/components/ui/logo";
import type { Negocio } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/servicos", label: "Serviços", icon: Wrench },
  { href: "/dashboard/receitas", label: "Receitas", icon: TrendingUp },
  { href: "/dashboard/despesas", label: "Despesas", icon: TrendingDown },
  { href: "/dashboard/fluxo-caixa", label: "Fluxo de Caixa", icon: Wallet },
  { href: "/dashboard/propostas", label: "Orçamentos", icon: FileText },
  { href: "/dashboard/calendario", label: "Calendário", icon: Calendar },
  { href: "/dashboard/indicar", label: "Indique e Ganhe", icon: Gift },
  { href: "/dashboard/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [usuario, setUsuario] = useState<UserProfile | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const authUser = await authService.getAuthUser();

        if (!authUser) {
          router.push("/login");
          return;
        }

        localStorage.setItem("faturion_dispositivo_logado", "true");

        const [perfil, negocioData] = await Promise.all([
          authService.getUserProfile(authUser.id),
          supabase
            .from("negocios")
            .select("*")
            .eq("usuario_id", authUser.id)
            .single(),
        ]);

        setUsuario(perfil);
        setNegocio(negocioData.data);
      } catch (err) {
        console.error("[DashboardLayout] Erro ao carregar perfil/negocio:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [supabase, router]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [supabase, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const userInitials = usuario?.nome
    ? usuario.nome
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const isActive = (href: string) =>
    pathname === href || (pathname !== null && pathname.startsWith(href + "/"));

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  function renderNavLinks(collapsed: boolean, onNavigate?: () => void) {
    return (
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-600" />
              )}
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  active
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>
    );
  }

  function renderUserSection(collapsed: boolean, onLogout?: () => void) {
    return (
      <div className={`border-t border-border p-3 ${collapsed ? "px-2" : ""}`}>
        <div
          className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
            collapsed ? "justify-center px-2" : ""
          }`}
        >
          <Avatar className="h-9 w-9 shrink-0 border-2 border-emerald-200 dark:border-emerald-800">
            <AvatarFallback className="bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {usuario?.nome || "Usuário"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {negocio?.nome || "Meu Negócio"}
              </p>
            </div>
          )}
        </div>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onLogout}
              className={`mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 ${
                collapsed ? "justify-center px-2" : ""
              }`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">Sair</TooltipContent>
          )}
        </Tooltip>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <SkipToContent />
      <div className="flex min-h-[100dvh] bg-background">
        {/* Desktop Sidebar */}
        <aside
          role="navigation"
          aria-label="Menu principal"
          className={`hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:border-r lg:border-border lg:bg-card lg:transition-all lg:duration-300 ${
            sidebarCollapsed ? "lg:w-[68px]" : "lg:w-64"
          }`}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div
              className={`flex h-16 items-center border-b border-border px-4 ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
            >
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600">
                  <LogoMark className="h-5 w-5 text-white" />
                </div>
                {!sidebarCollapsed && (
                  <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    FATURION
                  </span>
                )}
              </Link>
            </div>

            {/* Nav */}
            {renderNavLinks(sidebarCollapsed)}

            {/* User + Logout */}
            {renderUserSection(sidebarCollapsed, handleLogout)}

            {/* Collapse Toggle */}
            <div className="hidden lg:flex border-t border-border p-3">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4" />
                    <span>Recolher</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="navigation"
              aria-label="Menu de navegação mobile"
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card shadow-xl lg:hidden"
            >
              <div className="flex h-full flex-col">
                {/* Mobile Logo + Close */}
                <div className="flex h-16 items-center justify-between border-b border-border px-4">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5"
                    onClick={() => setMobileOpen(false)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600">
                      <LogoMark className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                      FATURION
                    </span>
                  </Link>
                  <button
                    onClick={() => setMobileOpen(false)}
                    aria-label="Fechar menu"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Mobile Nav */}
                {renderNavLinks(false, () => setMobileOpen(false))}

                {/* Mobile User + Logout */}
                {renderUserSection(false, handleLogout)}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Area */}
        <div
          className={`flex flex-1 flex-col transition-all duration-300 ${
            sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-64"
          }`}
        >
          {/* Mobile Header */}
          <header role="banner" className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-lg lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu de navegação"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600">
                <LogoMark className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                FATURION
              </span>
            </Link>
            <div className="flex items-center gap-1">
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
                aria-label="Busca global (Ctrl+K)"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Search className="h-5 w-5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Menu do usuário" className="flex h-11 w-11 items-center justify-center rounded-full">
                  <Avatar className="h-8 w-8 border-2 border-emerald-200 dark:border-emerald-800">
                    <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{usuario?.nome || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">
                    {negocio?.nome || "Meu Negócio"}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/configuracoes" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Content */}
          <main
            id="main-content"
            role="main"
            aria-label="Conteúdo principal"
            className="flex-1 p-4 pb-24 pt-4 lg:p-6 lg:pb-6 lg:pt-6"
          >
            <SubscriptionGuard isAdmin={authService.isUserAdmin(usuario)}>{children}</SubscriptionGuard>
          </main>
          <BottomNav />
        </div>

        <PWAUpdater />
        <InstallBanner />
        <CommandPalette />
      </div>
      </TooltipProvider>
    );
}
