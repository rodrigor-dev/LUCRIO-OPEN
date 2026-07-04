"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/pagination";
import { FORMAS_PAGAMENTO, STATUS_LABELS } from "@/lib/constants";
import type { Receita as ReceitaDB } from "@/types/database";
import {
  formatarMoeda,
  formatarData,
  toastComDesfazer,
} from "@/utils";
import {
  atualizarStatusVencidos,
  marcarComoPago,
  desmarcarPago,
  alterarStatusEmMassa,
  excluirEmMassa,
} from "@/services/status.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  TrendingUp,
  DollarSign,
  Pencil,
  Trash2,
  Copy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  CheckCheck,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type Receita = ReceitaDB & {
  cliente?: { nome: string } | null;
};

const FORM_DEFAULTS = {
  descricao: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  data_vencimento: "",
  status: "pendente" as string,
  forma_pagamento: "pix",
  cliente_id: "",
  observacoes: "",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  pago: "bg-emerald-500",
  pendente: "bg-yellow-500",
  atrasado: "bg-red-500",
  cancelado: "bg-gray-400",
};

const VALUE_COLORS: Record<string, string> = {
  pago: "text-emerald-600",
  pendente: "text-foreground",
  atrasado: "text-red-600",
  cancelado: "text-muted-foreground",
};

export default function ReceitasPage() {
  const supabase = useSupabase();
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string | null>(null);

  // Dialogs
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Receita | null>(null);
  const [excluindo, setExcluindo] = useState<Receita | null>(null);
  const [excluindoBtn, setExcluindoBtn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Drawer
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [receitaSelecionada, setReceitaSelecionada] = useState<Receita | null>(null);

  // Bulk selection
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [processandoMassa, setProcessandoMassa] = useState(false);

  const [form, setForm] = useState(FORM_DEFAULTS);

  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    setPageItems,
    totalItems,
  } = usePagination<Receita>({ itemsPerPage: 50 });

  // ---- Data Loading ----
  const carregarDados = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) return;

      // Update overdue statuses first
      await atualizarStatusVencidos(negocio.id);

      const [receitasRes, clientesRes] = await Promise.all([
        supabase
          .from("receitas")
          .select("*, cliente:clientes(nome)")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome")
          .eq("negocio_id", negocio.id)
          .order("nome"),
      ]);

      if (receitasRes.error) {
        toast.error("Erro ao carregar receitas");
        return;
      }

      setReceitas(receitasRes.data || []);
      setClientes(clientesRes.data || []);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }, [supabase]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ---- Filtering ----
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const receitasFiltradas = useMemo(() => {
    return receitas.filter((r) => {
      // Text search
      const buscaMatch =
        busca === "" ||
        r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        r.cliente?.nome?.toLowerCase().includes(busca.toLowerCase());

      // Status filter
      const statusMatch = filtroStatus === "todos" || r.status === filtroStatus;

      // Period filter
      let periodoMatch = true;
      if (filtroPeriodo) {
        const dataReceita = new Date(r.data);
        if (filtroPeriodo === "este_mes") {
          periodoMatch =
            dataReceita.getMonth() === mesAtual &&
            dataReceita.getFullYear() === anoAtual;
        } else if (filtroPeriodo === "proximo_mes") {
          const proximoMes = mesAtual === 11 ? 0 : mesAtual + 1;
          const proximoAno = mesAtual === 11 ? anoAtual + 1 : anoAtual;
          periodoMatch =
            dataReceita.getMonth() === proximoMes &&
            dataReceita.getFullYear() === proximoAno;
        } else if (filtroPeriodo === "ultimos_30_dias") {
          const trintaDiasAtras = new Date();
          trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
          periodoMatch = dataReceita >= trintaDiasAtras;
        }
      }

      return buscaMatch && statusMatch && periodoMatch;
    });
  }, [receitas, busca, filtroStatus, filtroPeriodo, mesAtual, anoAtual]);

  useEffect(() => {
    setPageItems(receitasFiltradas);
  }, [receitasFiltradas, setPageItems]);

  // ---- KPIs (based on ALL receitas, not filtered) ----
  const kpis = useMemo(() => {
    const receitasMes = receitas.filter((r) => {
      const d = new Date(r.data);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
    });

    const recebido = receitasMes
      .filter((r) => r.status === "pago")
      .reduce((acc, r) => acc + r.valor, 0);
    const aReceber = receitasMes
      .filter((r) => r.status === "pendente")
      .reduce((acc, r) => acc + r.valor, 0);
    const atrasado = receitasMes
      .filter((r) => r.status === "atrasado")
      .reduce((acc, r) => acc + r.valor, 0);
    const totalMes = receitasMes.reduce((acc, r) => acc + r.valor, 0);

    return { recebido, aReceber, atrasado, totalMes };
  }, [receitas, mesAtual, anoAtual]);

  // ---- Filter pill counts ----
  const contadores = useMemo(() => {
    const base = filtroPeriodo
      ? receitas.filter((r) => {
          const dataReceita = new Date(r.data);
          if (filtroPeriodo === "este_mes") {
            return (
              dataReceita.getMonth() === mesAtual &&
              dataReceita.getFullYear() === anoAtual
            );
          }
          if (filtroPeriodo === "proximo_mes") {
            const proximoMes = mesAtual === 11 ? 0 : mesAtual + 1;
            const proximoAno = mesAtual === 11 ? anoAtual + 1 : anoAtual;
            return (
              dataReceita.getMonth() === proximoMes &&
              dataReceita.getFullYear() === proximoAno
            );
          }
          if (filtroPeriodo === "ultimos_30_dias") {
            const trintaDiasAtras = new Date();
            trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
            return dataReceita >= trintaDiasAtras;
          }
          return true;
        })
      : receitas;

    return {
      todos: base.length,
      pagos: base.filter((r) => r.status === "pago").length,
      pendentes: base.filter((r) => r.status === "pendente").length,
      atrasados: base.filter((r) => r.status === "atrasado").length,
    };
  }, [receitas, filtroPeriodo, mesAtual, anoAtual]);

  // ---- CRUD ----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) return;

      const valorNum = parseFloat(form.valor);
      if (isNaN(valorNum) || valorNum <= 0) {
        toast.error("Valor inválido");
        return;
      }

      const payload = {
        descricao: form.descricao,
        valor: valorNum,
        data: form.data,
        data_vencimento: form.data_vencimento || null,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        cliente_id:
          form.cliente_id && form.cliente_id !== "none"
            ? form.cliente_id
            : null,
        observacoes: form.observacoes,
      };

      if (editando) {
        const { error } = await supabase
          .from("receitas")
          .update(payload)
          .eq("id", editando.id);

        if (error) {
          toast.error("Erro ao atualizar receita");
          return;
        }

        toast.success("Receita atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("receitas").insert({
          negocio_id: negocio.id,
          ...payload,
        });

        if (error) {
          toast.error("Erro ao criar receita");
          return;
        }

        toast.success("Receita criada com sucesso!");
      }

      setDialogAberto(false);
      setEditando(null);
      setForm(FORM_DEFAULTS);
      carregarDados();
    } catch {
      toast.error("Erro ao salvar receita");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExcluir() {
    if (!excluindo) return;
    setExcluindoBtn(true);

    try {
      const receitaDeletada = { ...excluindo };

      const { error } = await supabase
        .from("receitas")
        .delete()
        .eq("id", excluindo.id);

      if (error) {
        toast.error("Erro ao excluir receita");
        return;
      }

      toastComDesfazer("Receita excluída com sucesso!", async () => {
        const { error: insertError } = await supabase.from("receitas").insert({
          id: receitaDeletada.id,
          negocio_id: receitaDeletada.negocio_id,
          cliente_id: receitaDeletada.cliente_id,
          servico_id: receitaDeletada.servico_id,
          descricao: receitaDeletada.descricao,
          valor: receitaDeletada.valor,
          data: receitaDeletada.data,
          data_vencimento: receitaDeletada.data_vencimento,
          data_pagamento: receitaDeletada.data_pagamento,
          status: receitaDeletada.status,
          forma_pagamento: receitaDeletada.forma_pagamento,
          comprovante_url: receitaDeletada.comprovante_url,
          recorrencia_tipo: receitaDeletada.recorrencia_tipo,
          recorrencia_id: receitaDeletada.recorrencia_id,
          parcela_numero: receitaDeletada.parcela_numero,
          parcela_total: receitaDeletada.parcela_total,
          grupo_parcela_id: receitaDeletada.grupo_parcela_id,
          observacoes: receitaDeletada.observacoes,
        });

        if (insertError) {
          throw insertError;
        }
      });

      setExcluindo(null);
      setDrawerAberto(false);
      carregarDados();
    } catch {
      toast.error("Erro ao excluir receita");
    } finally {
      setExcluindoBtn(false);
    }
  }

  async function handleDuplicar(receita: Receita) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) return;

      const { error } = await supabase.from("receitas").insert({
        negocio_id: negocio.id,
        descricao: `${receita.descricao} (Cópia)`,
        valor: receita.valor,
        data: new Date().toISOString().split("T")[0],
        data_vencimento: receita.data_vencimento,
        status: "pendente",
        forma_pagamento: receita.forma_pagamento,
        cliente_id: receita.cliente_id,
        observacoes: receita.observacoes,
      });

      if (error) {
        toast.error("Erro ao duplicar receita");
        return;
      }

      toast.success("Receita duplicada com sucesso!");
      carregarDados();
    } catch {
      toast.error("Erro ao duplicar receita");
    }
  }

  async function handleMarcarPago(receita: Receita) {
    try {
      await marcarComoPago("receitas", receita.id);
      toast.success("Receita marcada como paga!");
      carregarDados();
      // Update drawer selection if open
      if (receitaSelecionada?.id === receita.id) {
        setReceitaSelecionada({
          ...receita,
          status: "pago",
          data_pagamento: new Date().toISOString().split("T")[0],
        });
      }
    } catch {
      toast.error("Erro ao marcar como pago");
    }
  }

  async function handleDesmarcarPago(receita: Receita) {
    try {
      await desmarcarPago("receitas", receita.id);
      toast.success("Receita desmarcada como paga");
      carregarDados();
      // Update drawer selection
      const novaData = new Date().toISOString().split("T")[0];
      const novoStatus =
        receita.data_vencimento && receita.data_vencimento < novaData
          ? "atrasado"
          : "pendente";
      if (receitaSelecionada?.id === receita.id) {
        setReceitaSelecionada({
          ...receita,
          status: novoStatus as Receita["status"],
          data_pagamento: undefined,
        });
      }
    } catch {
      toast.error("Erro ao desmarcar pagamento");
    }
  }

  // ---- Bulk Selection ----
  function toggleSelecao(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleTodasSelecao() {
    if (selecionadas.size === receitasFiltradas.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(receitasFiltradas.map((r) => r.id)));
    }
  }

  async function handleMarcarPagoMassa() {
    if (selecionadas.size === 0) return;
    setProcessandoMassa(true);
    try {
      await alterarStatusEmMassa(
        "receitas",
        Array.from(selecionadas),
        "pago"
      );
      toast.success(
        `${selecionadas.size} receita(s) marcada(s) como paga(s)!`
      );
      setSelecionadas(new Set());
      carregarDados();
    } catch {
      toast.error("Erro ao alterar status em massa");
    } finally {
      setProcessandoMassa(false);
    }
  }

  async function handleMarcarPendenteMassa() {
    if (selecionadas.size === 0) return;
    setProcessandoMassa(true);
    try {
      await alterarStatusEmMassa(
        "receitas",
        Array.from(selecionadas),
        "pendente"
      );
      toast.success(
        `${selecionadas.size} receita(s) marcada(s) como pendente(s)!`
      );
      setSelecionadas(new Set());
      carregarDados();
    } catch {
      toast.error("Erro ao alterar status em massa");
    } finally {
      setProcessandoMassa(false);
    }
  }

  async function handleExcluirMassa() {
    if (selecionadas.size === 0) return;
    setProcessandoMassa(true);
    try {
      await excluirEmMassa("receitas", Array.from(selecionadas));
      toast.success(`${selecionadas.size} receita(s) excluída(s) com sucesso!`);
      setSelecionadas(new Set());
      carregarDados();
    } catch {
      toast.error("Erro ao excluir em massa");
    } finally {
      setProcessandoMassa(false);
    }
  }

  // ---- Form helpers ----
  function abrirEdicao(receita: Receita) {
    setEditando(receita);
    setForm({
      descricao: receita.descricao,
      valor: String(receita.valor),
      data: receita.data,
      data_vencimento: receita.data_vencimento || "",
      status: receita.status,
      forma_pagamento: receita.forma_pagamento || "pix",
      cliente_id: receita.cliente_id || "",
      observacoes: receita.observacoes || "",
    });
    setDrawerAberto(false);
    setDialogAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_DEFAULTS);
    setDialogAberto(true);
  }

  function abrirDrawer(receita: Receita) {
    setReceitaSelecionada(receita);
    setDrawerAberto(true);
  }

  function handleFiltraStatus(status: string) {
    setFiltroStatus(status);
    setFiltroPeriodo(null);
  }

  function handleFiltraPeriodo(periodo: string) {
    if (filtroPeriodo === periodo) {
      setFiltroPeriodo(null);
    } else {
      setFiltroPeriodo(periodo);
      setFiltroStatus("todos");
    }
  }

  // ---- Status Badge helper ----
  function statusBadge(status: string) {
    const colors: Record<string, string> = {
      pago: "bg-emerald-100 text-emerald-700 border-emerald-200",
      pendente: "bg-yellow-100 text-yellow-700 border-yellow-200",
      atrasado: "bg-red-100 text-red-700 border-red-200",
      cancelado: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.pendente}`}
      >
        {STATUS_LABELS[status] || status}
      </span>
    );
  }

  // ---- RENDER ----
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Receitas</h1>
            <p className="text-sm text-muted-foreground">
              Fluxo de caixa entradas
            </p>
          </div>
          <Button
            onClick={abrirNovo}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-1 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {carregando ? (
          <div className="space-y-4">
            {/* KPI Skeletons */}
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border bg-card p-4"
                >
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
            {/* List Skeletons */}
            <div className="space-y-3 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-32 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards - 2x2 Grid */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Recebido
                  </span>
                </div>
                <p className="text-lg font-bold text-emerald-600">
                  {formatarMoeda(kpis.recebido)}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    A receber
                  </span>
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {formatarMoeda(kpis.aReceber)}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Atrasado
                  </span>
                </div>
                <p className="text-lg font-bold text-red-600">
                  {formatarMoeda(kpis.atrasado)}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center bg-muted rounded-full">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Total do mês
                  </span>
                </div>
                <p className="text-lg font-bold">
                  {formatarMoeda(kpis.totalMes)}
                </p>
              </div>
            </motion.div>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mt-4"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar receita..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10 bg-card border rounded-xl h-11"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>

            {/* Filter Pills - Horizontal Scroll */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-3 overflow-x-auto"
            >
              <div className="flex gap-2 pb-2" style={{ minWidth: "max-content" }}>
                {/* Status Filters */}
                <button
                  onClick={() => handleFiltraStatus("todos")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroStatus === "todos" && !filtroPeriodo
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  Todos
                  <span className="text-xs opacity-70">({contadores.todos})</span>
                </button>

                <button
                  onClick={() => handleFiltraStatus("pago")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroStatus === "pago"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-card text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  Pagos
                  <span className="text-xs opacity-70">({contadores.pagos})</span>
                </button>

                <button
                  onClick={() => handleFiltraStatus("pendente")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroStatus === "pendente"
                      ? "bg-yellow-500 text-white border-yellow-500"
                      : "bg-card text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  Pendentes
                  <span className="text-xs opacity-70">({contadores.pendentes})</span>
                </button>

                <button
                  onClick={() => handleFiltraStatus("atrasado")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroStatus === "atrasado"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-card text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  Atrasados
                  <span className="text-xs opacity-70">({contadores.atrasados})</span>
                </button>

                {/* Divider */}
                <div className="w-px shrink-0 bg-border self-stretch" />

                {/* Period Filters */}
                <button
                  onClick={() => handleFiltraPeriodo("este_mes")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroPeriodo === "este_mes"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  Este mês
                </button>

                <button
                  onClick={() => handleFiltraPeriodo("proximo_mes")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroPeriodo === "proximo_mes"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  Próximo mês
                </button>

                <button
                  onClick={() => handleFiltraPeriodo("ultimos_30_dias")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filtroPeriodo === "ultimos_30_dias"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted border-border"
                  }`}
                >
                  Últimos 30 dias
                </button>
              </div>
            </motion.div>

            {/* Select All Checkbox */}
            {receitasFiltradas.length > 0 && (
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      selecionadas.size === receitasFiltradas.length &&
                      receitasFiltradas.length > 0
                    }
                    onCheckedChange={toggleTodasSelecao}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selecionadas.size > 0
                      ? `${selecionadas.size} selecionada(s)`
                      : "Selecionar todas"}
                  </span>
                </div>
                {receitasFiltradas.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {receitasFiltradas.length} resultado(s)
                  </span>
                )}
              </div>
            )}

            {/* List */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              {receitasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="mb-1 text-base font-semibold">
                    Nenhuma receita encontrada
                  </h3>
                  <p className="mb-4 text-center text-sm text-muted-foreground">
                    {busca || filtroStatus !== "todos" || filtroPeriodo
                      ? "Tente ajustar os filtros"
                      : "Adicione sua primeira receita"}
                  </p>
                  {!busca && filtroStatus === "todos" && !filtroPeriodo && (
                    <Button
                      onClick={abrirNovo}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Adicionar Receita
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {paginatedItems.map((receita, index) => (
                      <motion.div
                        key={receita.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ delay: index * 0.02 }}
                        className={`flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors ${
                          selecionadas.has(receita.id)
                            ? "border-emerald-500 bg-emerald-50/50"
                            : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={selecionadas.has(receita.id)}
                          onCheckedChange={() => toggleSelecao(receita.id)}
                          onClick={(e) => e.stopPropagation()}
                        />

                        {/* Status Dot */}
                        <div
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_COLORS[receita.status] || STATUS_DOT_COLORS.pendente}`}
                        />

                        {/* Client Name */}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {receita.descricao}
                          </p>
                          {receita.cliente?.nome && (
                            <p className="truncate text-xs text-muted-foreground">
                              {receita.cliente.nome}
                            </p>
                          )}
                        </div>

                        {/* Value + Arrow */}
                        <div
                          className="flex items-center gap-2 shrink-0 cursor-pointer"
                          onClick={() => abrirDrawer(receita)}
                        >
                          <span
                            className={`text-sm font-bold ${VALUE_COLORS[receita.status] || ""}`}
                          >
                            {formatarMoeda(receita.valor)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    onPageChange={goToPage}
                  />
                </>
              )}
            </motion.div>
          </>
        )}
      </div>

      {/* Bottom Bulk Action Bar */}
      <AnimatePresence>
        {selecionadas.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 p-3 shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">
                {selecionadas.size} selecionada(s)
              </span>
              <button
                onClick={() => setSelecionadas(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar seleção
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={handleMarcarPagoMassa}
                disabled={processandoMassa}
              >
                <CheckCheck className="mr-1 h-4 w-4" />
                Pago
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800"
                onClick={handleMarcarPendenteMassa}
                disabled={processandoMassa}
              >
                <Clock className="mr-1 h-4 w-4" />
                Pendente
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={handleExcluirMassa}
                disabled={processandoMassa}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Excluir
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Detail Drawer ---- */}
      <Sheet open={drawerAberto} onOpenChange={setDrawerAberto}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          {receitaSelecionada && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="text-left text-lg">
                  {receitaSelecionada.descricao}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {receitaSelecionada.cliente?.nome || "Sem cliente"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-4">
                {/* Status + Valor */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${STATUS_DOT_COLORS[receitaSelecionada.status]}`}
                    />
                    {statusBadge(receitaSelecionada.status)}
                  </div>
                  <span
                    className={`text-2xl font-bold ${VALUE_COLORS[receitaSelecionada.status]}`}
                  >
                    {formatarMoeda(receitaSelecionada.valor)}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Data
                    </p>
                    <p className="text-sm font-medium">
                      {formatarData(receitaSelecionada.data)}
                    </p>
                  </div>

                  {receitaSelecionada.data_vencimento && (
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Vencimento
                      </p>
                      <p className="text-sm font-medium">
                        {formatarData(receitaSelecionada.data_vencimento)}
                      </p>
                    </div>
                  )}

                  {receitaSelecionada.data_pagamento && (
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Data Pgto
                      </p>
                      <p className="text-sm font-medium">
                        {formatarData(receitaSelecionada.data_pagamento)}
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Forma Pgto
                    </p>
                    <p className="text-sm font-medium">
                      {FORMAS_PAGAMENTO[receitaSelecionada.forma_pagamento || ""] ||
                        receitaSelecionada.forma_pagamento ||
                        "-"}
                    </p>
                  </div>
                </div>

                {/* Observações */}
                {receitaSelecionada.observacoes && (
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      Observações
                    </p>
                    <p className="text-sm">{receitaSelecionada.observacoes}</p>
                  </div>
                )}

                {/* Primary Action */}
                {receitaSelecionada.status !== "pago" ? (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleMarcarPago(receitaSelecionada)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar como pago
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDesmarcarPago(receitaSelecionada)}
                  >
                    Desmarcar como pago
                  </Button>
                )}

                {/* Secondary Actions */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => abrirEdicao(receitaSelecionada)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="text-xs">Editar</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={() => {
                      handleDuplicar(receitaSelecionada);
                      setDrawerAberto(false);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="text-xs">Duplicar</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col gap-1 h-auto py-3 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => {
                      setExcluindo(receitaSelecionada);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="text-xs">Excluir</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ---- Create/Edit Dialog ---- */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar Receita" : "Nova Receita"}
            </DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize as informações da receita"
                : "Preencha os dados para adicionar uma nova receita"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Ex: Serviço de instalação"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor}
                  onChange={(e) =>
                    setForm({ ...form, valor: e.target.value })
                  }
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) =>
                    setForm({ ...form, data: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_vencimento">Data de Vencimento</Label>
              <Input
                id="data_vencimento"
                type="date"
                value={form.data_vencimento}
                onChange={(e) =>
                  setForm({ ...form, data_vencimento: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(value) =>
                    setForm({ ...form, forma_pagamento: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">
                      Transferência
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm({ ...form, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={form.cliente_id}
                onValueChange={(value) =>
                  setForm({ ...form, cliente_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                placeholder="Observações adicionais..."
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting
                  ? "Salvando..."
                  : editando
                    ? "Salvar Alterações"
                    : "Adicionar Receita"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation ---- */}
      <AlertDialog
        open={!!excluindo}
        onOpenChange={(open) => !open && setExcluindo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Receita</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a receita &quot;
              {excluindo?.descricao}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              disabled={excluindoBtn}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindoBtn ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
