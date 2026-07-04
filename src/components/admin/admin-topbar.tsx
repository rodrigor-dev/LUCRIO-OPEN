"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Bell,
  LogOut,
  User,
  Settings,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const routeLabels: Record<string, string> = {
  admin: "Dashboard",
  usuarios: "Usuarios",
  planos: "Planos",
  assinaturas: "Assinaturas",
  cupons: "Cupons",
  financeiro: "Financeiro",
  suporte: "Suporte",
  avisos: "Avisos",
  auditoria: "Auditoria",
  logs: "Logs",
  "feature-flags": "Feature Flags",
  configuracoes: "Configuracoes",
  atualizacoes: "Atualizacoes",
  backups: "Backups",
};

interface AdminTopbarProps {
  userInitials: string;
  userName?: string;
  userEmail?: string;
  onMobileMenuToggle?: () => void;
}

export default function AdminTopbar({
  userInitials,
  userName,
  userEmail,
  onMobileMenuToggle,
}: AdminTopbarProps) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    if (!pathname) return [];
    const segments = pathname.split("/").filter(Boolean);
    const items: { label: string; href: string }[] = [];
    let currentPath = "";

    for (const segment of segments) {
      currentPath += `/${segment}`;
      items.push({
        label: routeLabels[segment] || segment,
        href: currentPath,
      });
    }

    return items;
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border/50 bg-card/80 px-4 backdrop-blur-xl lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuToggle}
        aria-label="Abrir menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        <Link
          href="/admin"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Admin
        </Link>
        {breadcrumbs.length > 1 &&
          breadcrumbs.slice(1).map((item) => (
            <span key={item.href} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              <span
                className={
                  item.href === pathname
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }
              >
                {item.label}
              </span>
            </span>
          ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Search trigger */}
        <button
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: true })
            )
          }
          aria-label="Buscar (Ctrl+K)"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <button
          aria-label="Notificacoes"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
            3
          </span>
        </button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Menu do usuario"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
            >
              <Avatar className="h-8 w-8 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none">
                  {userName || "Admin"}
                </p>
                <p className="mt-0.5 text-xs leading-none text-muted-foreground">
                  {userEmail || "admin@lucrio.com"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userName || "Admin"}</p>
              <p className="text-xs text-muted-foreground">
                {userEmail || "admin@lucrio.com"}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard"
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Painel do Usuario
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/admin/configuracoes"
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Configuracoes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                const { createClient } = await import(
                  "@/lib/supabase/client"
                );
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="flex items-center gap-2 text-red-600 focus:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
