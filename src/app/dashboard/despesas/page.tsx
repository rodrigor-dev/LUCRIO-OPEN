"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/pagination";
import {
  FORMAS_PAGAMENTO_DESPESA,
  STATUS_LABELS,
} from "@/lib/constants";
import type { Despesa as DespesaDB } from "@/types/database";
import {
  formatarMoeda,
  formatarData,
  formatarInputMoeda,
  parseMoeda,
  toastComDesfazer,
} from "@/utils";
import {
  atualizarStatusVencidos,
  alterarStatusEmMassa,
  excluirEmMassa,
} from "@/services/status.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { InputMoeda } from "@/components/ui/input-moeda";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  TrendingDown,
  TrendingUp,
  Pencil,
  Trash2,
  Filter,
  CreditCard,
  X,
  Check,
  AlertTriangle,
  ChevronRight,
  ArrowDownCircle,
  CheckCheck,
  Clock,
  DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FinanceiroKpiCard } from "@/components/financeiro";
import { FinanceiroStatusBadge, STATUS_DOT_COLORS, VALUE_COLORS } from "@/components/financeiro";
import { FinanceiroFilterBar, FinanceiroSearch } from "@/components/financeiro";
import { FinanceiroEmptyState } from "@/components/financeiro";
import { FinanceiroBulkBar, FinanceiroBulkBarDesktop } from "@/components/financeiro";

type Categoria = {
  id: string;
  nome: string;
  icone: string | null;
  cor: string | null;
  negocio_id: string | null;
  tipo: string;
  is_ativo: boolean;
  criado_em: string;
};

type Despesa = DespesaDB & {
  categoria?: { nome: string; icone: string; cor: string } | null;
};

type FiltroStatus = "todos" | "pago" | "pendente" | "atrasado";

const FORM_DEFAULTS = {
  descricao: "",
  valor: 0,
  data: new Date().toISOString().split("T")[0],
  data_vencimento: "",
  data_pagamento: "",
  status: "pendente",
  forma_pagamento: "pix",
  categoria_id: "",
  fornecedor: "",
  comprovante_url: "",
  observacoes: "",
  cartao_tipo: "avista" as "avista" | "parcelado",
  cartao_parcelas: "12",
  cartao_valor_total: 0,
};

export default function DespesasPage() {
  const supabase = useSupabase();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [formAberto, setFormAberto] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [despesaDetalhe, setDespesaDetalhe] = useState<Despesa | null>(null);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [excluindo, setExcluindo] = useState<Despesa | null>(null);
  const [excluindoBtn, setExcluindoBtn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [modoSelecao, setModoSelecao] = useState(false);
  const [acaoEmMassa, setAcaoEmMassa] = useState<
    "pagar" | "pendente" | "excluir" | null
  >(null);
  const [processandoMassa, setProcessandoMassa] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULTS);

  const {
    currentPage,
    paginatedItems,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    setPageItems,
    totalItems,
  } = usePagination<Despesa>({ itemsPerPage: 50 });

  const valorParcelaCalculado = useMemo(() => {
    if (form.forma_pagamento !== "credito" || form.cartao_tipo !== "parcelado")
      return 0;
    const total = form.cartao_valor_total;
    const parcelas = parseInt(form.cartao_parcelas, 10);
    if (isNaN(parcelas) || parcelas <= 0) return 0;
    return total / parcelas;
  }, [form.forma_pagamento, form.cartao_tipo, form.cartao_valor_total, form.cartao_parcelas]);

  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      const buscaMatch =
        busca === "" ||
        d.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        d.categoria?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        d.fornecedor?.toLowerCase().includes(busca.toLowerCase());
      const categoriaMatch =
        filtroCategoria === "todas" || d.categoria_id === filtroCategoria;
      const statusMatch =
        filtroStatus === "todos" || d.status === filtroStatus;
      return buscaMatch && categoriaMatch && statusMatch;
    });
  }, [despesas, busca, filtroCategoria, filtroStatus]);

  useEffect(() => {
    setPageItems(despesasFiltradas);
  }, [despesasFiltradas, setPageItems]);

  const contarPorStatus = useCallback(
    (status: FiltroStatus) => {
      const base = despesas.filter((d) => {
        const buscaMatch =
          busca === "" ||
          d.descricao.toLowerCase().includes(busca.toLowerCase()) ||
          d.categoria?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
          d.fornecedor?.toLowerCase().includes(busca.toLowerCase());
        const categoriaMatch =
          filtroCategoria === "todas" || d.categoria_id === filtroCategoria;
        return buscaMatch && categoriaMatch;
      });
      if (status === "todos") return base.length;
      return base.filter((d) => d.status === status).length;
    },
    [despesas, busca, filtroCategoria]
  );

  const totais = useMemo(() => {
    const filtered = despesas.filter((d) => {
      const buscaMatch =
        busca === "" ||
        d.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        d.categoria?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        d.fornecedor?.toLowerCase().includes(busca.toLowerCase());
      const categoriaMatch =
        filtroCategoria === "todas" || d.categoria_id === filtroCategoria;
      return buscaMatch && categoriaMatch;
    });
    return {
      total: filtered.reduce((a, d) => a + d.valor, 0),
      aPagar: filtered
        .filter((d) => d.status === "pendente" || d.status === "atrasado")
        .reduce((a, d) => a + d.valor, 0),
      pago: filtered
        .filter((d) => d.status === "pago")
        .reduce((a, d) => a + d.valor, 0),
      atrasado: filtered
        .filter((d) => d.status === "atrasado")
        .reduce((a, d) => a + d.valor, 0),
      totalQtd: filtered.length,
      pagoQtd: filtered.filter((d) => d.status === "pago").length,
      aPagarQtd: filtered.filter((d) => d.status === "pendente").length,
      atrasadoQtd: filtered.filter((d) => d.status === "atrasado").length,
    };
  }, [despesas, busca, filtroCategoria]);

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

      try {
        await atualizarStatusVencidos(negocio.id);
      } catch {
        /* silent */
      }

      const [despesasRes, categoriasRes] = await Promise.all([
        supabase
          .from("despesas")
          .select("*, categoria:categorias_despesas(nome, icone, cor)")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false }),
        supabase
          .from("categorias_despesas")
          .select(
            "id, nome, icone, cor, negocio_id, tipo, is_ativo, criado_em"
          )
          .or(`negocio_id.eq.${negocio.id},negocio_id.is.null`)
          .order("nome"),
      ]);

      if (despesasRes.error) {
        toast.error("Erro ao carregar despesas");
        return;
      }

      setDespesas(despesasRes.data || []);
      setCategorias((categoriasRes.data || []) as Categoria[]);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }, [supabase]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

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

      if (form.valor <= 0) {
        toast.error("Valor inválido");
        return;
      }

      const isCredito = form.forma_pagamento === "credito";
      const isParcelado = isCredito && form.cartao_tipo === "parcelado";

      const basePayload = {
        descricao: form.descricao,
        valor: form.valor,
        data: form.data,
        data_vencimento: form.data_vencimento || null,
        data_pagamento:
          form.status === "pago"
            ? form.data_pagamento || new Date().toISOString().split("T")[0]
            : null,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        categoria_id:
          form.categoria_id && form.categoria_id !== "none"
            ? form.categoria_id
            : null,
        fornecedor: form.fornecedor || null,
        comprovante_url: form.comprovante_url || null,
        observacoes: form.observacoes,
        cartao_tipo: isCredito ? form.cartao_tipo : null,
        cartao_parcelas:
          isCredito && form.cartao_tipo === "parcelado"
            ? parseInt(form.cartao_parcelas, 10)
            : null,
        cartao_valor_total:
          isCredito && form.cartao_tipo === "parcelado"
            ? form.cartao_valor_total
            : null,
      };

      if (editando) {
        const { error } = await supabase
          .from("despesas")
          .update(basePayload)
          .eq("id", editando.id);
        if (error) {
          toast.error("Erro ao atualizar despesa");
          return;
        }
        toast.success("Despesa atualizada com sucesso!");
      } else if (isParcelado) {
        const numParcelas = parseInt(form.cartao_parcelas, 10);
        const valorTotal = form.cartao_valor_total;
        const valorParcela = valorTotal / numParcelas;
        const grupoId = crypto.randomUUID();
        const dataInicio = new Date(form.data_vencimento || form.data);
        const inserts: Array<Record<string, unknown>> = [];
        for (let i = 0; i < numParcelas; i++) {
          const dataParcela = new Date(dataInicio);
          dataParcela.setMonth(dataParcela.getMonth() + i);
          inserts.push({
            ...basePayload,
            valor: valorParcela,
            descricao: `${form.descricao} (${i + 1}/${numParcelas})`,
            data_vencimento: dataParcela.toISOString().split("T")[0],
            data: form.data,
            parcela_numero: i + 1,
            parcela_total: numParcelas,
            grupo_parcela_id: grupoId,
          });
        }
        const { error } = await supabase
          .from("despesas")
          .insert(inserts.map((p) => ({ negocio_id: negocio.id, ...p })));
        if (error) {
          toast.error("Erro ao criar parcelas");
          return;
        }
        toast.success(`${numParcelas} parcelas criadas com sucesso!`);
      } else {
        const { error } = await supabase.from("despesas").insert({
          negocio_id: negocio.id,
          ...basePayload,
        });
        if (error) {
          toast.error("Erro ao criar despesa");
          return;
        }
        toast.success("Despesa criada com sucesso!");
      }

      setFormAberto(false);
      setEditando(null);
      setForm(FORM_DEFAULTS);
      carregarDados();
    } catch {
      toast.error("Erro ao salvar despesa");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExcluir() {
    if (!excluindo) return;
    setExcluindoBtn(true);
    try {
      const despesaDeletada = { ...excluindo };
      const { error } = await supabase
        .from("despesas")
        .delete()
        .eq("id", excluindo.id);
      if (error) {
        toast.error("Erro ao excluir despesa");
        return;
      }
      toastComDesfazer("Despesa excluída com sucesso!", async () => {
        const { error: insertError } = await supabase.from("despesas").insert({
          id: despesaDeletada.id,
          negocio_id: despesaDeletada.negocio_id,
          categoria_id: despesaDeletada.categoria_id,
          descricao: despesaDeletada.descricao,
          valor: despesaDeletada.valor,
          data: despesaDeletada.data,
          data_vencimento: despesaDeletada.data_vencimento,
          data_pagamento: despesaDeletada.data_pagamento,
          fornecedor: despesaDeletada.fornecedor,
          forma_pagamento: despesaDeletada.forma_pagamento,
          status: despesaDeletada.status,
          observacoes: despesaDeletada.observacoes,
          comprovante_url: despesaDeletada.comprovante_url,
          parcela_numero: despesaDeletada.parcela_numero,
          parcela_total: despesaDeletada.parcela_total,
          grupo_parcela_id: despesaDeletada.grupo_parcela_id,
          cartao_tipo: despesaDeletada.cartao_tipo,
          cartao_parcelas: despesaDeletada.cartao_parcelas,
          cartao_valor_total: despesaDeletada.cartao_valor_total,
        });
        if (insertError) throw insertError;
      });
      setExcluindo(null);
      setDetalheAberto(false);
      carregarDados();
    } catch {
      toast.error("Erro ao excluir despesa");
    } finally {
      setExcluindoBtn(false);
    }
  }

  function abrirEdicao(d: Despesa) {
    setEditando(d);
    setForm({
      descricao: d.descricao,
      valor: d.valor,
      data: d.data,
      data_vencimento: d.data_vencimento || "",
      data_pagamento: d.data_pagamento || "",
      status: d.status,
      forma_pagamento: d.forma_pagamento || "pix",
      categoria_id: d.categoria_id || "",
      fornecedor: d.fornecedor || "",
      comprovante_url: d.comprovante_url || "",
      observacoes: d.observacoes || "",
      cartao_tipo: d.cartao_tipo || "avista",
      cartao_parcelas: String(d.cartao_parcelas || 12),
      cartao_valor_total: d.cartao_valor_total || 0,
    });
    setDetalheAberto(false);
    setFormAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_DEFAULTS);
    setFormAberto(true);
  }

  function abrirDetalhe(d: Despesa) {
    setDespesaDetalhe(d);
    setDetalheAberto(true);
  }

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setModoSelecao(false);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === paginatedItems.length) {
      setSelecionados(new Set());
      setModoSelecao(false);
    } else {
      setSelecionados(new Set(paginatedItems.map((d) => d.id)));
    }
  }

  function iniciarModoSelecao() {
    setModoSelecao(true);
  }

  function cancelarModoSelecao() {
    setModoSelecao(false);
    setSelecionados(new Set());
  }

  async function executarAcaoEmMassa() {
    if (selecionados.size === 0 || !acaoEmMassa) return;
    const ids = Array.from(selecionados);
    setProcessandoMassa(true);
    try {
      if (acaoEmMassa === "excluir") {
        await excluirEmMassa("despesas", ids);
        toast.success(`${ids.length} despesa(s) excluída(s)!`);
      } else {
        const novoStatus = acaoEmMassa === "pagar" ? "pago" : "pendente";
        await alterarStatusEmMassa("despesas", ids, novoStatus);
        toast.success(`${ids.length} despesa(s) atualizada(s)!`);
      }
      setSelecionados(new Set());
      setAcaoEmMassa(null);
      carregarDados();
    } catch {
      toast.error("Erro ao executar ação em massa");
    } finally {
      setProcessandoMassa(false);
    }
  }

  const kpiCards = [
    { label: "Total", valor: totais.total, qtd: totais.totalQtd, icon: TrendingDown, iconColor: "text-emerald-600", iconBg: "bg-emerald-100" },
    { label: "A Pagar", valor: totais.aPagar, qtd: totais.aPagarQtd, icon: AlertTriangle, iconColor: "text-amber-600", iconBg: "bg-amber-100" },
    { label: "Pago", valor: totais.pago, qtd: totais.pagoQtd, icon: TrendingUp, iconColor: "text-blue-600", iconBg: "bg-blue-100" },
    { label: "Atrasado", valor: totais.atrasado, qtd: totais.atrasadoQtd, icon: Clock, iconColor: "text-red-600", iconBg: "bg-red-100" },
  ];

  return (
    <div className="space-y-4 pb-[max(7rem,env(safe-area-inset-bottom)+4rem)] md:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3 md:py-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight md:text-xl">
              <ArrowDownCircle className="h-5 w-5 shrink-0 text-emerald-600 md:h-6 md:w-6" />
              Despesas
            </h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Gerencie suas saídas
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {modoSelecao && (
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelarModoSelecao}
                className="h-9 px-3 text-xs"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Cancelar
              </Button>
            )}
            {!modoSelecao && despesasFiltradas.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={iniciarModoSelecao}
                className="h-9 px-3 text-xs"
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Selecionar
              </Button>
            )}
            {!modoSelecao && (
              <Button
                onClick={abrirNovo}
                size="sm"
                className="hidden h-9 bg-emerald-600 px-3 text-xs hover:bg-emerald-700 md:flex"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Nova Despesa
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Loading Skeleton */}
        {carregando ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-card p-3 sm:p-4">
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="mt-1 h-2.5 w-12" />
                </div>
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-8 w-24 shrink-0 rounded-full"
                />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4"
                >
                  <Skeleton className="h-4 w-4 shrink-0 rounded" />
                  <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-32 flex-1" />
                  <Skeleton className="h-4 w-20 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards - 2x2 grid mobile, 4-col desktop */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {kpiCards.map((kpi) => (
                <FinanceiroKpiCard
                  key={kpi.label}
                  label={kpi.label}
                  valor={kpi.valor}
                  qtd={kpi.qtd}
                  icon={kpi.icon}
                  iconColor={kpi.iconColor}
                  iconBg={kpi.iconBg}
                />
              ))}
            </motion.div>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mt-4"
            >
              <FinanceiroSearch value={busca} onChange={setBusca} placeholder="Buscar despesa..." />
            </motion.div>

            {/* Filter Bar - Status Pills + Category */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-3"
            >
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                <div className="min-w-0 flex-1">
                  <FinanceiroFilterBar
                    filters={[
                      { label: "Todos", value: "todos", count: contarPorStatus("todos") },
                      { label: "Pagos", value: "pago", count: contarPorStatus("pago"), color: "border-emerald-600 bg-emerald-600 text-white" },
                      { label: "Pendentes", value: "pendente", count: contarPorStatus("pendente"), color: "border-yellow-500 bg-yellow-500 text-white" },
                      { label: "Atrasados", value: "atrasado", count: contarPorStatus("atrasado"), color: "border-red-600 bg-red-600 text-white" },
                    ]}
                    activeValue={filtroStatus}
                    onSelect={(v) => setFiltroStatus(v as FiltroStatus)}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select
                    value={filtroCategoria}
                    onValueChange={setFiltroCategoria}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[140px] rounded-full border-border bg-card text-xs">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas categorias</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icone} {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>

            {/* Bulk Action Bar - Desktop only */}
            <FinanceiroBulkBarDesktop
              count={selecionados.size}
              onCancel={() => { setSelecionados(new Set()); setModoSelecao(false); }}
              onMarkPaid={() => setAcaoEmMassa("pagar")}
              onMarkPending={() => setAcaoEmMassa("pendente")}
              onDelete={() => setAcaoEmMassa("excluir")}
              processing={processandoMassa}
            />

            {/* Results count */}
            {despesasFiltradas.length > 0 && (
              <div className="mt-3 flex items-center justify-end">
                <span className="text-xs text-muted-foreground">
                  {despesasFiltradas.length} resultado(s)
                </span>
              </div>
            )}

            {/* Empty State */}
            {despesasFiltradas.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2"
              >
                <FinanceiroEmptyState
                  icon={ArrowDownCircle}
                  title="Nenhuma despesa encontrada"
                  description="Adicione sua primeira despesa"
                  actionLabel="Adicionar Despesa"
                  onAction={abrirNovo}
                  hasFilters={!!busca || filtroCategoria !== "todas" || filtroStatus !== "todos"}
                />
              </motion.div>
            )}

            {/* Desktop Table */}
            {despesasFiltradas.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-2 hidden md:block"
              >
                <div className="overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                        <th className="w-10 px-3 py-2.5">
                          <Checkbox
                            checked={
                              paginatedItems.length > 0 &&
                              selecionados.size === paginatedItems.length
                            }
                            onCheckedChange={toggleTodos}
                          />
                        </th>
                        <th className="px-3 py-2.5">Descrição</th>
                        <th className="hidden lg:table-cell px-3 py-2.5">
                          Categoria
                        </th>
                        <th className="hidden lg:table-cell px-3 py-2.5">
                          Fornecedor
                        </th>
                        <th className="px-3 py-2.5">Vencimento</th>
                        <th className="hidden lg:table-cell px-3 py-2.5">
                          Forma Pgto
                        </th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-right">Valor</th>
                        <th className="w-10 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {paginatedItems.map((d, index) => (
                          <motion.tr
                            key={d.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ delay: index * 0.01 }}
                            onClick={() => abrirDetalhe(d)}
                            className={`cursor-pointer border-b transition-colors hover:bg-muted/30 ${
                              selecionados.has(d.id) ? "bg-emerald-50/50" : ""
                            } ${index % 2 === 0 ? "" : "bg-muted/20"}`}
                          >
                            <td className="px-3 py-3">
                              <Checkbox
                                checked={selecionados.has(d.id)}
                                onCheckedChange={() => toggleSelecionado(d.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[d.status] || STATUS_DOT_COLORS.pendente}`}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {d.descricao}
                                    {d.parcela_numero &&
                                      d.parcela_total && (
                                        <span className="ml-1 text-xs text-muted-foreground">
                                          ({d.parcela_numero}/
                                          {d.parcela_total})
                                        </span>
                                      )}
                                  </p>
                                  <p className="text-xs text-muted-foreground sm:hidden">
                                    {formatarData(
                                      d.data_vencimento || d.data
                                    )}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-3 py-3 lg:table-cell">
                              {d.categoria ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1"
                                  style={{
                                    borderColor: d.categoria.cor || undefined,
                                    color: d.categoria.cor || undefined,
                                  }}
                                >
                                  {d.categoria.icone && (
                                    <span>{d.categoria.icone}</span>
                                  )}
                                  {d.categoria.nome}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="hidden px-3 py-3 text-muted-foreground lg:table-cell">
                              {d.fornecedor || "-"}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {d.data_vencimento
                                ? formatarData(d.data_vencimento)
                                : formatarData(d.data)}
                            </td>
                            <td className="hidden px-3 py-3 text-muted-foreground lg:table-cell">
                              {FORMAS_PAGAMENTO_DESPESA[
                                d.forma_pagamento || ""
                              ] ||
                                d.forma_pagamento ||
                                "-"}
                            </td>
                            <td className="px-3 py-3">
                              <FinanceiroStatusBadge status={d.status} />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span
                                className={`font-bold ${VALUE_COLORS[d.status] || ""}`}
                              >
                                {formatarMoeda(d.valor)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  onPageChange={goToPage}
                />
              </motion.div>
            )}

            {/* Mobile Cards */}
            {despesasFiltradas.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mt-2 space-y-2 md:hidden"
              >
                <AnimatePresence mode="popLayout">
                  {paginatedItems.map((d, index) => (
                    <motion.div
                      key={d.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => abrirDetalhe(d)}
                      className={`rounded-xl border bg-card p-4 transition-colors ${
                        selecionados.has(d.id)
                          ? "border-emerald-500 bg-emerald-50/50"
                          : ""
                      }`}
                    >
                      {/* Row 1: dot + name + value */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_COLORS[d.status] || STATUS_DOT_COLORS.pendente}`}
                        />
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {d.descricao}
                          {d.parcela_numero && d.parcela_total && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ({d.parcela_numero}/{d.parcela_total})
                            </span>
                          )}
                        </p>
                        <span
                          className={`shrink-0 text-sm font-bold ${VALUE_COLORS[d.status] || "text-foreground"}`}
                        >
                          {formatarMoeda(d.valor)}
                        </span>
                      </div>

                      {/* Row 2: date + payment + status */}
                      <div className="mt-1.5 flex items-center gap-2 pl-[18px] text-xs text-muted-foreground">
                        <span>
                          {formatarData(d.data_vencimento || d.data)}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="truncate">
                          {FORMAS_PAGAMENTO_DESPESA[d.forma_pagamento || ""] ||
                            d.forma_pagamento ||
                            "-"}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <FinanceiroStatusBadge status={d.status} />
                      </div>

                      {/* Row 3: category + checkbox */}
                      <div className="mt-2 flex items-center gap-2 pl-[18px]">
                        {d.categoria && (
                          <Badge
                            variant="outline"
                            className="shrink-0 gap-1 text-[10px]"
                            style={{
                              borderColor: d.categoria.cor || undefined,
                              color: d.categoria.cor || undefined,
                            }}
                          >
                            {d.categoria.icone && (
                              <span>{d.categoria.icone}</span>
                            )}
                            {d.categoria.nome}
                          </Badge>
                        )}
                        {!d.categoria && (
                          <span className="text-xs text-muted-foreground">
                            Sem categoria
                          </span>
                        )}
                        {modoSelecao && (
                          <div className="ml-auto flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelecionado(d.id);
                              }}
                              className="flex h-[44px] w-[44px] items-center justify-center"
                            >
                              <div
                                className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                                  selecionados.has(d.id)
                                    ? "border-emerald-600 bg-emerald-600"
                                    : "border-muted-foreground/40 bg-white"
                                }`}
                              >
                                {selecionados.has(d.id) && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                            </button>
                          </div>
                        )}
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
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Mobile FAB */}
      {!carregando && despesasFiltradas.length > 0 && !modoSelecao && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            delay: 0.3,
          }}
          className="fixed bottom-20 right-4 z-40 pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <Button
            onClick={abrirNovo}
            className="h-14 w-14 rounded-full bg-emerald-600 p-0 shadow-lg transition-transform hover:bg-emerald-700 active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </motion.div>
      )}

      {/* Mobile Bottom Bulk Action Bar */}
      <FinanceiroBulkBar
        count={selecionados.size}
        onCancel={cancelarModoSelecao}
        onMarkPaid={() => setAcaoEmMassa("pagar")}
        onMarkPending={() => setAcaoEmMassa("pendente")}
        onDelete={() => setAcaoEmMassa("excluir")}
        processing={processandoMassa}
      />

      {/* Detail Drawer */}
      <Sheet open={detalheAberto} onOpenChange={setDetalheAberto}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl sm:max-w-none"
        >
          {despesaDetalhe && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="text-left text-base md:text-lg">
                  {despesaDetalhe.descricao}
                </SheetTitle>
                <SheetDescription className="text-left text-xs md:text-sm">
                  Detalhes da despesa
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${STATUS_DOT_COLORS[despesaDetalhe.status] || STATUS_DOT_COLORS.pendente}`}
                    />
                    <FinanceiroStatusBadge status={despesaDetalhe.status} />
                  </div>
                  <span
                    className={`text-xl font-bold md:text-2xl ${VALUE_COLORS[despesaDetalhe.status] || "text-foreground"}`}
                  >
                    {formatarMoeda(despesaDetalhe.valor)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                    <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                      Data
                    </p>
                    <p className="text-xs font-medium md:text-sm">
                      {formatarData(despesaDetalhe.data)}
                    </p>
                  </div>
                  {despesaDetalhe.data_vencimento && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Vencimento
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {formatarData(despesaDetalhe.data_vencimento)}
                      </p>
                    </div>
                  )}
                  {despesaDetalhe.data_pagamento && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Pagamento
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {formatarData(despesaDetalhe.data_pagamento)}
                      </p>
                    </div>
                  )}
                  {despesaDetalhe.fornecedor && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Fornecedor
                      </p>
                      <p className="truncate text-xs font-medium md:text-sm">
                        {despesaDetalhe.fornecedor}
                      </p>
                    </div>
                  )}
                  {despesaDetalhe.forma_pagamento && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Forma Pgto
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {FORMAS_PAGAMENTO_DESPESA[
                          despesaDetalhe.forma_pagamento
                        ] || despesaDetalhe.forma_pagamento}
                      </p>
                    </div>
                  )}
                  {despesaDetalhe.categoria && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Categoria
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {despesaDetalhe.categoria.icone}{" "}
                        {despesaDetalhe.categoria.nome}
                      </p>
                    </div>
                  )}
                  {despesaDetalhe.cartao_tipo && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Cartão
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {despesaDetalhe.cartao_tipo === "parcelado"
                          ? `Parcelado (${despesaDetalhe.cartao_parcelas}x)`
                          : "À vista"}
                      </p>
                    </div>
                  )}
                  {despesaDetalhe.cartao_valor_total && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Valor Total Cartão
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {formatarMoeda(despesaDetalhe.cartao_valor_total)}
                      </p>
                    </div>
                  )}
                  {despesaDetalhe.parcela_numero &&
                    despesaDetalhe.parcela_total && (
                      <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                        <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                          Parcela
                        </p>
                        <p className="text-xs font-medium md:text-sm">
                          {despesaDetalhe.parcela_numero}/
                          {despesaDetalhe.parcela_total}
                        </p>
                      </div>
                    )}
                </div>

                {despesaDetalhe.observacoes && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                      Observações
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {despesaDetalhe.observacoes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pb-4 pt-2">
                  <Button
                    variant="outline"
                    className="h-11 flex-1"
                    onClick={() => abrirEdicao(despesaDetalhe)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => {
                      setDespesaDetalhe(null);
                      setExcluindo(despesaDetalhe);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create / Edit Dialog */}
      <Dialog open={formAberto} onOpenChange={setFormAberto}>
        <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar Despesa" : "Nova Despesa"}
            </DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize as informações da despesa"
                : "Preencha os dados para adicionar"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs">
                Descrição *
              </Label>
              <Input
                id="descricao"
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Ex: Compra de materiais"
                className="h-11 text-sm"
                required
              />
            </div>

            {/* Fornecedor */}
            <div className="space-y-1.5">
              <Label htmlFor="fornecedor" className="text-xs">
                Fornecedor
              </Label>
              <Input
                id="fornecedor"
                value={form.fornecedor}
                onChange={(e) =>
                  setForm({ ...form, fornecedor: e.target.value })
                }
                placeholder="Nome do fornecedor"
                className="h-11 text-sm"
              />
            </div>

            {/* Valor + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="valor" className="text-xs">
                  Valor (R$) *
                </Label>
                <InputMoeda
                  id="valor"
                  value={form.valor}
                  onChange={(v) => setForm({ ...form, valor: v })}
                  placeholder="R$ 0,00"
                  className="h-11 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data" className="text-xs">
                  Data *
                </Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) =>
                    setForm({ ...form, data: e.target.value })
                  }
                  className="h-11 text-sm"
                  required
                />
              </div>
            </div>

            {/* Vencimento + Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data_vencimento" className="text-xs">
                  Vencimento
                </Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) =>
                    setForm({ ...form, data_vencimento: e.target.value })
                  }
                  className="h-11 text-sm"
                />
              </div>
              {form.status === "pago" && (
                <div className="space-y-1.5">
                  <Label htmlFor="data_pagamento" className="text-xs">
                    Pagamento
                  </Label>
                  <Input
                    id="data_pagamento"
                    type="date"
                    value={form.data_pagamento}
                    onChange={(e) =>
                      setForm({ ...form, data_pagamento: e.target.value })
                    }
                    className="h-11 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={form.categoria_id}
                onValueChange={(v) => setForm({ ...form, categoria_id: v })}
              >
                <SelectTrigger className="h-11 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icone} {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Forma Pgto + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Forma Pgto</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      forma_pagamento: v,
                      cartao_tipo:
                        v === "credito" ? form.cartao_tipo : "avista",
                    })
                  }
                >
                  <SelectTrigger className="h-11 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMAS_PAGAMENTO_DESPESA).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger className="h-11 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Credit Card Section */}
            {form.forma_pagamento === "credito" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <CreditCard className="h-4 w-4" />
                  Cartão de Crédito
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, cartao_tipo: "avista" })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.cartao_tipo === "avista"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    À Vista
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, cartao_tipo: "parcelado" })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.cartao_tipo === "parcelado"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                    }`}
                  >
                    Parcelado
                  </button>
                </div>

                {form.cartao_tipo === "parcelado" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="cartao_parcelas"
                          className="text-xs"
                        >
                          Nº Parcelas
                        </Label>
                        <Input
                          id="cartao_parcelas"
                          type="number"
                          min="2"
                          max="48"
                          value={form.cartao_parcelas}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              cartao_parcelas: e.target.value,
                            })
                          }
                          className="h-11 text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="cartao_valor_total"
                          className="text-xs"
                        >
                          Valor Total (R$)
                        </Label>
                        <InputMoeda
                          id="cartao_valor_total"
                          value={form.cartao_valor_total}
                          onChange={(v) =>
                            setForm({ ...form, cartao_valor_total: v })
                          }
                          placeholder="R$ 0,00"
                          className="h-11 text-sm"
                        />
                      </div>
                    </div>
                    {valorParcelaCalculado > 0 && (
                      <div className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-800">
                        <Check className="h-4 w-4 shrink-0" />
                        {parseInt(form.cartao_parcelas, 10) || 0}x de{" "}
                        {formatarMoeda(valorParcelaCalculado)}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Comprovante URL */}
            <div className="space-y-1.5">
              <Label htmlFor="comprovante_url" className="text-xs">
                Comprovante URL
              </Label>
              <Input
                id="comprovante_url"
                value={form.comprovante_url}
                onChange={(e) =>
                  setForm({ ...form, comprovante_url: e.target.value })
                }
                placeholder="URL do comprovante"
                className="h-11 text-sm"
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="observacoes" className="text-xs">
                Observações
              </Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                placeholder="Observações adicionais..."
                className="min-h-[60px] text-sm"
                rows={2}
              />
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full sm:w-auto"
                >
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
              >
                {submitting
                  ? "Salvando..."
                  : editando
                    ? "Salvar"
                    : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{excluindo?.descricao}
              &quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              disabled={excluindoBtn}
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindoBtn ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation */}
      <AlertDialog
        open={!!acaoEmMassa}
        onOpenChange={(o) => !o && setAcaoEmMassa(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {acaoEmMassa === "excluir"
                ? "Excluir despesas"
                : acaoEmMassa === "pagar"
                  ? "Marcar como pago"
                  : "Marcar como pendente"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {acaoEmMassa === "excluir"
                ? `Excluir ${selecionados.size} despesa(s)? Não pode ser desfeito.`
                : acaoEmMassa === "pagar"
                  ? `Marcar ${selecionados.size} despesa(s) como paga(s)?`
                  : `Marcar ${selecionados.size} despesa(s) como pendente(s)?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executarAcaoEmMassa}
              disabled={processandoMassa}
              className={`h-11 ${
                acaoEmMassa === "excluir"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {processandoMassa ? "Processando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
