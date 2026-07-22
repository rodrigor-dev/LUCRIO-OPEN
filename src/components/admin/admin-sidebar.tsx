"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Tag,
  DollarSign,
  MessageSquare,
  Bell,
  Shield,
  FileText,
  ToggleLeft,
  Settings,
  RefreshCw,
  Database,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Megaphone,
  UserPlus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Usuarios", href: "/admin/usuarios", icon: Users },
  { label: "Planos", href: "/admin/planos", icon: CreditCard },
  { label: "Assinaturas", href: "/admin/assinaturas", icon: Receipt },
  { label: "Cupons", href: "/admin/cupons", icon: Tag },
  { label: "Indicacoes", href: "/admin/indicacoes", icon: UserPlus },
  { label: "Campanhas", href: "/admin/campanhas", icon: Megaphone },
  { label: "Financeiro", href: "/admin/financeiro", icon: DollarSign },
  { label: "Suporte", href: "/admin/suporte", icon: MessageSquare },
  { label: "Avisos", href: "/admin/avisos", icon: Bell },
  { label: "Auditoria", href: "/admin/auditoria", icon: Shield },
  { label: "Logs", href: "/admin/logs", icon: FileText },
  { label: "Feature Flags", href: "/admin/feature-flags", icon: ToggleLeft },
  { label: "Configuracoes", href: "/admin/configuracoes", icon: Settings },
  { label: "Atualizacoes", href: "/admin/atualizacoes", icon: RefreshCw },
  { label: "Backups", href: "/admin/backups", icon: Database },
  { label: "Diagnostico", href: "/admin/debug", icon: ShieldCheck },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  userInitials: string;
}

export default function AdminSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
  userInitials,
}: AdminSidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    onMobileClose?.();
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

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  function renderNavLinks(isCollapsed: boolean, onNavigate?: () => void) {
    return (
      <nav className="flex-1 space-y-0.5 px-2.5 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-sidebar-indicator"
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
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

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-border/50 px-4",
          collapsed && "justify-center"
        )}
      >
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">L</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-foreground">
                FATURION
              </span>
              <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-primary">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      {renderNavLinks(collapsed)}

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden border-t border-border/50 p-2.5 lg:block">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
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
  );

  return (
    <TooltipProvider>
      {/* Desktop Sidebar */}
      <aside
        role="navigation"
        aria-label="Menu administrativo"
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:border-r lg:border-border/50 lg:bg-card/50 lg:backdrop-blur-xl lg:transition-all lg:duration-300",
          collapsed ? "lg:w-[68px]" : "lg:w-[250px]"
        )}
      >
        {sidebarContent}
      </aside>
    </TooltipProvider>
  );
}

export function AdminMobileSidebar({
  mobileOpen,
  onMobileClose,
  userInitials,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
  userInitials: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    onMobileClose();
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

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <motion.aside
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          role="navigation"
          aria-label="Menu administrativo mobile"
          className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card shadow-xl lg:hidden"
        >
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
              <Link
                href="/admin"
                className="flex items-center gap-2.5"
                onClick={onMobileClose}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-sm font-bold text-primary-foreground">
                    L
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold tracking-tight text-foreground">
                    FATURION
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-primary">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </span>
                </div>
              </Link>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </motion.aside>
      )}
    </>
  );
}
