"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Users,
  TrendingUp,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  id: string;
  name: string;
  description: string;
  type: "cliente" | "receita" | "despesa" | "servico";
  href: string;
}

const typeConfig = {
  cliente: {
    label: "Cliente",
    icon: Users,
    color: "#10b981",
    href: "/clientes",
  },
  receita: {
    label: "Receita",
    icon: TrendingUp,
    color: "#3b82f6",
    href: "/receitas",
  },
  despesa: {
    label: "Despesa",
    icon: TrendingDown,
    color: "#f59e0b",
    href: "/despesas",
  },
  servico: {
    label: "Serviço",
    icon: Wrench,
    color: "#8b5cf6",
    href: "/servicos",
  },
} as const;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  const flatResults = results;

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const controller = new AbortController();
    const supabase = createClient();

    async function search() {
      setLoading(true);
      try {
        const term = `%${query.trim()}%`;
        const limit = 5;

        const [clientesRes, receitasRes, despesasRes, servicosRes] =
          await Promise.all([
            supabase
              .from("clientes")
              .select("id, nome, email")
              .or(`nome.ilike.${term},email.ilike.${term}`)
              .limit(limit)
              .abortSignal(controller.signal),
            supabase
              .from("receitas")
              .select("id, descricao")
              .ilike("descricao", term)
              .limit(limit)
              .abortSignal(controller.signal),
            supabase
              .from("despesas")
              .select("id, descricao")
              .ilike("descricao", term)
              .limit(limit)
              .abortSignal(controller.signal),
            supabase
              .from("servicos")
              .select("id, nome")
              .ilike("nome", term)
              .limit(limit)
              .abortSignal(controller.signal),
          ]);

        if (controller.signal.aborted) return;

        const mapped: SearchResult[] = [];

        if (clientesRes.data) {
          for (const c of clientesRes.data) {
            mapped.push({
              id: c.id,
              name: c.nome,
              description: c.email ?? "",
              type: "cliente",
              href: `/clientes`,
            });
          }
        }
        if (receitasRes.data) {
          for (const r of receitasRes.data) {
            mapped.push({
              id: r.id,
              name: r.descricao,
              description: "Receita",
              type: "receita",
              href: `/receitas`,
            });
          }
        }
        if (despesasRes.data) {
          for (const d of despesasRes.data) {
            mapped.push({
              id: d.id,
              name: d.descricao,
              description: "Despesa",
              type: "despesa",
              href: `/despesas`,
            });
          }
        }
        if (servicosRes.data) {
          for (const s of servicosRes.data) {
            mapped.push({
              id: s.id,
              name: s.nome,
              description: "Serviço",
              type: "servico",
              href: `/servicos`,
            });
          }
        }

        setResults(mapped);
        setSelectedIndex(0);
      } catch (err) {
        console.error("[CommandPalette] Erro na busca:", err);
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    search();
    return () => controller.abort();
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  useEffect(() => {
    if (!open) return;

    function handleNavKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatResults.length - 1 ? prev + 1 : 0
        );
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatResults.length - 1
        );
      }
      if (e.key === "Enter" && flatResults[selectedIndex]) {
        e.preventDefault();
        navigate(flatResults[selectedIndex].href);
      }
    }

    document.addEventListener("keydown", handleNavKey);
    return () => document.removeEventListener("keydown", handleNavKey);
  }, [open, flatResults, selectedIndex]);

  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector("[data-selected=true]");
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-modal="true"
            aria-label="Busca global"
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[15vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar clientes, receitas, despesas, serviços..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar no sistema"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="pointer-events-none hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} role="listbox" aria-label="Resultados da busca" className="max-h-80 overflow-y-auto p-1">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
                </div>
              )}

              {!loading && query.trim() && flatResults.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum resultado
                </div>
              )}

              {!loading &&
                Object.entries(groupedResults).map(([type, items]) => {
                  const config = typeConfig[type as keyof typeof typeConfig];
                  const Icon = config.icon;
                  return (
                    <div key={type} className="mb-1">
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <Icon
                          className="h-3 w-3"
                          style={{ color: config.color }}
                        />
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {config.label}
                        </span>
                      </div>
                      {items.map((item) => {
                        const globalIndex = flatResults.indexOf(item);
                        const selected = globalIndex === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            data-selected={selected}
                            role="option"
                            aria-selected={selected}
                            onClick={() => navigate(item.href)}
                            onMouseEnter={() =>
                              setSelectedIndex(globalIndex)
                            }
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                              selected ? "bg-accent" : "hover:bg-accent/50"
                            }`}
                          >
                            <Icon
                              className="h-4 w-4 shrink-0"
                              style={{ color: config.color }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {item.name}
                              </p>
                              {item.description && item.description !== config.label && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${config.color}15`,
                                color: config.color,
                              }}
                            >
                              {config.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
