"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Users,
  MoreHorizontal,
  Wrench,
  FileText,
  Wallet,
  BarChart3,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const tabs = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Receitas", icon: TrendingUp, href: "/receitas" },
  { label: "Despesas", icon: TrendingDown, href: "/despesas" },
  { label: "Clientes", icon: Users, href: "/clientes" },
] as const;

const moreItems = [
  { label: "Serviços", icon: Wrench, href: "/dashboard/servicos" },
  { label: "Propostas", icon: FileText, href: "/dashboard/propostas" },
  { label: "Fluxo de Caixa", icon: Wallet, href: "/dashboard/fluxo-caixa" },
  { label: "Relatórios", icon: BarChart3, href: "/dashboard/relatorios" },
  { label: "Configurações", icon: Settings, href: "/dashboard/configuracoes" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const isMoreActive = moreItems.some(
    (item) => pathname?.startsWith(item.href) ?? false
  );

  return (
    <nav aria-label="Navegação mobile" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card pb-safe lg:hidden">
      <div className="flex items-center justify-around px-1">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5"
            >
              <tab.icon
                className="h-5 w-5 transition-colors"
                style={{ color: active ? "#10b981" : undefined }}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className="text-[10px] font-medium leading-none transition-colors"
                style={{ color: active ? "#10b981" : undefined }}
              >
                {tab.label}
              </span>
              {active && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute top-0 h-0.5 w-8 rounded-full"
                  style={{ backgroundColor: "#10b981" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5"
              aria-label="Mais opções"
            >
              <MoreHorizontal
                className="h-5 w-5 transition-colors"
                style={{ color: isMoreActive ? "#10b981" : undefined }}
                strokeWidth={isMoreActive ? 2.5 : 2}
              />
              <span
                className="text-[10px] font-medium leading-none transition-colors"
                style={{ color: isMoreActive ? "#10b981" : undefined }}
              >
                Mais
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-5 gap-2 py-4">
              {moreItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-accent"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: active
                          ? "rgba(16, 185, 129, 0.1)"
                          : undefined,
                      }}
                    >
                      <item.icon
                        className="h-5 w-5"
                        style={{ color: active ? "#10b981" : undefined }}
                      />
                    </div>
                    <span className="text-center text-[10px] font-medium leading-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
