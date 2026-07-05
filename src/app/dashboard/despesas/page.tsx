"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { usePagination } from "@/hooks/use-pagination";
import {
  FORMAS_PAGAMENTO_DESPESA,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from "@/lib/constants";
import type { Despesa as DespesaDB } from "@/types/database";
import { formatarMoeda, toastComDesfazer } from "@/utils";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Pencil,
  Trash2,
  Filter,
  CreditCard,
  X,
  CalendarDays,
  Check,
  AlertTriangle,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowDownCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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
  valor: "",
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
  cartao_valor_total: "",
};

function formatarMoedaInput(valor: string): string {
  const apenasNumeros = valor.replace(/[^\d]/g, "");
  if (!apenasNumeros) return "";
  const centavos = parseInt(apenasNumeros, 10);
  const reais = centavos / 100;
  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoeda(valor: string): number {
  const limpo = valor.replace(/[^\d]/g, "");
  if (!limpo) return 0;
  return parseInt(limpo, 10) / 100;
}

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
  const [acaoEmMassa, setAcaoEmMassa] = useState<"pagar" | "pendente" | "excluir" | null>(null);
  const [form, setForm] = useState(FORM_DEFAULTS);
  const valorRef = useRef<HTMLInputElement>(null);

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
    if (form.forma_pagamento !== "credito" || form.cartao_tipo !== "parcelado") return 0;
    const total = parseFloat(form.cartao_valor_total);
    const parcelas = parseInt(form.cartao_parcelas, 10);
    if (isNaN(total) || isNaN(parcelas) || parcelas <= 0) return 0;
    return total / parcelas;
  }, [form.forma_pagamento, form.cartao_tipo, form.cartao_valor_total, form.cartao_parcelas]);

  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      const buscaMatch =
        busca === "" ||
        d.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        d.categoria?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
        d.fornecedor?.toLowerCase().includes(busca.toLowerCase());
      const categoriaMatch = filtroCategoria === "todas" || d.categoria_id === filtroCategoria;
      const statusMatch = filtroStatus === "todos" || d.status === filtroStatus;
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
        const categoriaMatch = filtroCategoria === "todas" || d.categoria_id === filtroCategoria;
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
      const categoriaMatch = filtroCategoria === "todas" || d.categoria_id === filtroCategoria;
      return buscaMatch && categoriaMatch;
    });
    return {
      total: filtered.reduce((a, d) => a + d.valor, 0),
      aPagar: filtered
        .filter((d) => d.status === "pendente" || d.status === "atrasado")
        .reduce((a, d) => a + d.valor, 0),
      pago: filtered.filter((d) => d.status === "pago").reduce((a, d) => a + d.valor, 0),
      atrasado: filtered.filter((d) => d.status === "atrasado").reduce((a, d) => a + d.valor, 0),
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
          .select("id, nome, icone, cor, negocio_id, tipo, is_ativo, criado_em")
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

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const apenasDigitos = raw.replace(/[^\d]/g, "");
    if (!apenasDigitos) {
      setForm({ ...form, valor: "" });
      if (valorRef.current) valorRef.current.value = "";
      return;
    }
    const formatado = formatarMoedaInput(apenasDigitos);
    setForm({ ...form, valor: apenasDigitos });
    if (valorRef.current) valorRef.current.value = `R$ ${formatado}`;
  }

  function handleValorCartaoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const apenasDigitos = raw.replace(/[^\d]/g, "");
    if (!apenasDigitos) {
      setForm({ ...form, cartao_valor_total: "" });
      e.target.value = "";
      return;
    }
    const formatado = formatarMoedaInput(apenasDigitos);
    setForm({ ...form, cartao_valor_total: apenasDigitos });
    e.target.value = `R$ ${formatado}`;
  }

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

      const valorNum = parseMoeda(form.valor);
      if (isNaN(valorNum) || valorNum <= 0) {
        toast.error("Valor inválido");
        return;
      }

      const isCredito = form.forma_pagamento === "credito";
      const isParcelado = isCredito && form.cartao_tipo === "parcelado";

      const basePayload = {
        descricao: form.descricao,
        valor: valorNum,
        data: form.data,
        data_vencimento: form.data_vencimento || null,
        data_pagamento:
          form.status === "pago"
            ? form.data_pagamento || new Date().toISOString().split("T")[0]
            : null,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        categoria_id: form.categoria_id && form.categoria_id !== "none" ? form.categoria_id : null,
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
            ? parseFloat(form.cartao_valor_total)
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
        const valorTotal = parseFloat(form.cartao_valor_total);
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
      const { error } = await supabase.from("despesas").delete().eq("id", excluindo.id);
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
      valor: String(d.valor),
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
      cartao_valor_total: d.cartao_valor_total ? String(d.cartao_valor_total) : "",
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
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === paginatedItems.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(paginatedItems.map((d) => d.id)));
    }
  }

  async function executarAcaoEmMassa() {
    if (selecionados.size === 0 || !acaoEmMassa) return;
    const ids = Array.from(selecionados);
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
    }
  }

  const kpiCards = [
    {
      label: "Total",
      valor: totais.total,
      qtd: totais.totalQtd,
      icon: TrendingDown,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "A Pagar",
      valor: totais.aPagar,
      qtd: totais.aPagarQtd,
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Pago",
      valor: totais.pago,
      qtd: totais.pagoQtd,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Atrasado",
      valor: totais.atrasado,
      qtd: totais.atrasadoQtd,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="min-h-[100dvh] pb-24 md:pb-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between"
      >
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <ArrowDownCircle className="h-5 w-5 text-emerald-600 sm:h-6 sm:w-6" />
            Despesas
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Gerencie suas saídas
          </p>
        </div>
        <Button
          onClick={abrirNovo}
          className="h-11 rounded-full bg-emerald-600 px-4 text-sm hover:bg-emerald-700 sm:rounded-md sm:px-5"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">Nova Despesa</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </motion.div>

      {/* KPI Cards - 2x2 grid on mobile, 4 cols on desktop */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
      >
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${kpi.bg}`}>
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {kpi.label}
                </span>
              </div>
              <p className={`mt-1.5 text-base font-bold ${kpi.color} sm:text-lg`}>
                {formatarMoeda(kpi.valor)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {kpi.qtd} {kpi.qtd === 1 ? "item" : "itens"}
              </p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Smart Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
      >
        {(["todos", "pago", "pendente", "atrasado"] as FiltroStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => setFiltroStatus(st)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
              filtroStatus === st
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-muted bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>
              {st === "todos"
                ? "Todos"
                : st === "pago"
                  ? "Pagos"
                  : st === "pendente"
                    ? "Pendentes"
                    : "Atrasados"}
            </span>
            <span
              className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${
                filtroStatus === st
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {contarPorStatus(st)}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Search + Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-11 pl-10 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="h-11 w-full text-sm sm:w-[200px]">
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
      </motion.div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selecionados.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <span className="text-xs font-medium text-emerald-800">
                {selecionados.size} selecionado(s)
              </span>
              <div className="flex flex-wrap gap-1.5 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-emerald-300 bg-white px-2.5 text-xs text-emerald-700 hover:bg-emerald-100"
                  onClick={() => setAcaoEmMassa("pagar")}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Pago
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-yellow-300 bg-white px-2.5 text-xs text-yellow-700 hover:bg-yellow-50"
                  onClick={() => setAcaoEmMassa("pendente")}
                >
                  <CalendarDays className="mr-1 h-3 w-3" />
                  Pendente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-red-300 bg-white px-2.5 text-xs text-red-700 hover:bg-red-50"
                  onClick={() => setAcaoEmMassa("excluir")}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Excluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 px-0"
                  onClick={() => setSelecionados(new Set())}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Skeleton */}
      {carregando ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="mb-1 h-5 w-20" />
                  <Skeleton className="h-2.5 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : despesasFiltradas.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ArrowDownCircle className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <h3 className="mb-1.5 text-base font-semibold">Nenhuma despesa encontrada</h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                {busca || filtroCategoria !== "todas" || filtroStatus !== "todos"
                  ? "Tente ajustar os filtros"
                  : "Adicione sua primeira despesa"}
              </p>
              {!busca && filtroCategoria === "todas" && filtroStatus === "todos" && (
                <Button onClick={abrirNovo} className="h-11 bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Despesa
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {/* Mobile Cards */}
          <div className="space-y-2 md:hidden">
            {paginatedItems.map((d, index) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card
                  className={`cursor-pointer transition-colors ${
                    selecionados.has(d.id) ? "border-emerald-400 bg-emerald-50/30" : ""
                  }`}
                  onClick={() => abrirDetalhe(d)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
                        style={{
                          backgroundColor: d.categoria?.cor ? `${d.categoria.cor}18` : undefined,
                          color: d.categoria?.cor || undefined,
                        }}
                      >
                        {d.categoria?.icone || <ArrowDownCircle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {d.descricao}
                              {d.parcela_numero && d.parcela_total && (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  ({d.parcela_numero}/{d.parcela_total})
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {d.fornecedor && <span className="mr-1">{d.fornecedor}</span>}
                              {new Date(d.data_vencimento || d.data).toLocaleDateString("pt-BR")}
                              {d.forma_pagamento && (
                                <span className="ml-1">
                                  {FORMAS_PAGAMENTO_DESPESA[d.forma_pagamento] || ""}
                                </span>
                              )}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-red-600">
                            -{formatarMoeda(d.valor)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              d.status === "pago"
                                ? "bg-emerald-500"
                                : d.status === "atrasado"
                                  ? "bg-red-500"
                                  : d.status === "pendente"
                                    ? "bg-amber-500"
                                    : "bg-gray-400"
                            }`}
                          />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {STATUS_LABELS[d.status] || d.status}
                          </span>
                          {d.categoria && (
                            <span
                              className="ml-auto rounded-full border px-1.5 py-0.5 text-[10px]"
                              style={{
                                borderColor: d.categoria.cor || undefined,
                                color: d.categoria.cor || undefined,
                              }}
                            >
                              {d.categoria.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Bulk select checkbox - always visible */}
                    <div className="absolute right-2 top-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelecionado(d.id);
                        }}
                        className="flex h-10 w-10 items-center justify-center"
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
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            paginatedItems.length > 0 &&
                            selecionados.size === paginatedItems.length
                          }
                          onCheckedChange={toggleTodos}
                        />
                      </TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                      <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                      <TableHead className="hidden lg:table-cell">Forma Pgto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {paginatedItems.map((d, index) => (
                        <motion.tr
                          key={d.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ delay: index * 0.02 }}
                          className={`cursor-pointer border-b transition-colors hover:bg-muted/50 ${
                            selecionados.has(d.id) ? "bg-emerald-50/50" : ""
                          }`}
                          onClick={() => abrirDetalhe(d)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selecionados.has(d.id)}
                              onCheckedChange={() => toggleSelecionado(d.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {d.descricao}
                                {d.parcela_numero && d.parcela_total && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({d.parcela_numero}/{d.parcela_total})
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {new Intl.DateTimeFormat("pt-BR").format(
                                  new Date(d.data_vencimento || d.data)
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {d.categoria ? (
                              <Badge
                                variant="outline"
                                className="gap-1"
                                style={{
                                  borderColor: d.categoria.cor || undefined,
                                  color: d.categoria.cor || undefined,
                                }}
                              >
                                {d.categoria.icone && <span>{d.categoria.icone}</span>}
                                {d.categoria.nome}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {d.fornecedor || "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            -{formatarMoeda(d.valor)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {d.data_vencimento
                              ? new Intl.DateTimeFormat("pt-BR").format(
                                  new Date(d.data_vencimento)
                                )
                              : new Intl.DateTimeFormat("pt-BR").format(new Date(d.data))}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {FORMAS_PAGAMENTO_DESPESA[d.forma_pagamento || ""] ||
                              d.forma_pagamento ||
                              "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANTS[d.status] || "outline"}>
                              {STATUS_LABELS[d.status] || d.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => abrirEdicao(d)}
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:text-destructive"
                                onClick={() => setExcluindo(d)}
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between rounded-lg border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {totalItems} itens · Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage <= 1}
                  onClick={prevPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage >= totalPages}
                  onClick={nextPage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Detail Sheet - Mobile Bottom Drawer */}
      <Sheet open={detalheAberto} onOpenChange={setDetalheAberto}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-t-none">
          {despesaDetalhe && (
            <>
              <SheetHeader className="mb-4 pb-0">
                <SheetTitle className="text-left text-base">
                  {despesaDetalhe.descricao}
                </SheetTitle>
                <SheetDescription className="text-left text-xs">
                  Detalhes da despesa
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4">
                {/* Valor em destaque */}
                <div className="flex items-center justify-between rounded-xl bg-red-50 p-4">
                  <div>
                    <p className="text-xs text-red-600/80">Valor</p>
                    <p className="text-2xl font-bold text-red-600">
                      -{formatarMoeda(despesaDetalhe.valor)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={STATUS_VARIANTS[despesaDetalhe.status] || "outline"}>
                      {STATUS_LABELS[despesaDetalhe.status] || despesaDetalhe.status}
                    </Badge>
                    {despesaDetalhe.parcela_numero && despesaDetalhe.parcela_total && (
                      <span className="text-[10px] text-muted-foreground">
                        Parcela {despesaDetalhe.parcela_numero}/{despesaDetalhe.parcela_total}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem
                    label="Data"
                    value={new Date(despesaDetalhe.data).toLocaleDateString("pt-BR")}
                  />
                  {despesaDetalhe.data_vencimento && (
                    <InfoItem
                      label="Vencimento"
                      value={new Date(despesaDetalhe.data_vencimento).toLocaleDateString(
                        "pt-BR"
                      )}
                    />
                  )}
                  {despesaDetalhe.data_pagamento && (
                    <InfoItem
                      label="Pagamento"
                      value={new Date(despesaDetalhe.data_pagamento).toLocaleDateString(
                        "pt-BR"
                      )}
                    />
                  )}
                  {despesaDetalhe.fornecedor && (
                    <InfoItem label="Fornecedor" value={despesaDetalhe.fornecedor} />
                  )}
                  {despesaDetalhe.forma_pagamento && (
                    <InfoItem
                      label="Forma Pgto"
                      value={
                        FORMAS_PAGAMENTO_DESPESA[despesaDetalhe.forma_pagamento] ||
                        despesaDetalhe.forma_pagamento
                      }
                    />
                  )}
                  {despesaDetalhe.categoria && (
                    <InfoItem
                      label="Categoria"
                      value={`${despesaDetalhe.categoria.icone} ${despesaDetalhe.categoria.nome}`}
                    />
                  )}
                  {despesaDetalhe.cartao_tipo && (
                    <InfoItem
                      label="Cartão"
                      value={
                        despesaDetalhe.cartao_tipo === "parcelado"
                          ? `Parcelado (${despesaDetalhe.cartao_parcelas}x)`
                          : "À vista"
                      }
                    />
                  )}
                  {despesaDetalhe.cartao_valor_total && (
                    <InfoItem
                      label="Valor Total Cartão"
                      value={formatarMoeda(despesaDetalhe.cartao_valor_total)}
                    />
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

                {/* Actions */}
                <div className="flex gap-2 pt-2 pb-4">
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
        <DialogContent className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
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
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
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
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                placeholder="Nome do fornecedor"
                className="h-11 text-sm"
              />
            </div>

            {/* Valor + Data Criação */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="valor" className="text-xs">
                  Valor (R$) *
                </Label>
                <Input
                  ref={valorRef}
                  id="valor"
                  type="text"
                  inputMode="decimal"
                  defaultValue={
                    form.valor ? `R$ ${formatarMoedaInput(form.valor)}` : ""
                  }
                  onChange={handleValorChange}
                  placeholder="R$ 0,00"
                  className="h-11 text-sm"
                  required
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
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
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
                      cartao_tipo: v === "credito" ? form.cartao_tipo : "avista",
                    })
                  }
                >
                  <SelectTrigger className="h-11 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMAS_PAGAMENTO_DESPESA).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
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
                    onClick={() => setForm({ ...form, cartao_tipo: "avista" })}
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
                    onClick={() => setForm({ ...form, cartao_tipo: "parcelado" })}
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
                        <Label htmlFor="cartao_parcelas" className="text-xs">
                          Nº Parcelas
                        </Label>
                        <Input
                          id="cartao_parcelas"
                          type="number"
                          min="2"
                          max="48"
                          value={form.cartao_parcelas}
                          onChange={(e) =>
                            setForm({ ...form, cartao_parcelas: e.target.value })
                          }
                          className="h-11 text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cartao_valor_total" className="text-xs">
                          Valor Total (R$)
                        </Label>
                        <Input
                          id="cartao_valor_total"
                          type="text"
                          inputMode="decimal"
                          defaultValue={
                            form.cartao_valor_total
                              ? `R$ ${formatarMoedaInput(form.cartao_valor_total)}`
                              : ""
                          }
                          onChange={handleValorCartaoChange}
                          placeholder="R$ 0,00"
                          className="h-11 text-sm"
                          required
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
                onChange={(e) => setForm({ ...form, comprovante_url: e.target.value })}
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
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
                className="min-h-[60px] text-sm"
                rows={2}
              />
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="h-11 w-full sm:w-auto">
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
              >
                {submitting ? "Salvando..." : editando ? "Salvar" : "Adicionar"}
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
              Tem certeza que deseja excluir &quot;{excluindo?.descricao}&quot;? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
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
      <AlertDialog open={!!acaoEmMassa} onOpenChange={(o) => !o && setAcaoEmMassa(null)}>
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
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executarAcaoEmMassa}
              className={`h-11 ${
                acaoEmMassa === "excluir"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FAB - Mobile only */}
      <div className="fixed bottom-6 right-4 z-40 md:hidden">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          <Button
            onClick={abrirNovo}
            className="h-14 w-14 rounded-full bg-emerald-600 shadow-lg hover:bg-emerald-700 hover:shadow-xl"
            size="icon"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}
