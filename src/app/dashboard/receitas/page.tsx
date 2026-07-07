"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/pagination";
import { FORMAS_PAGAMENTO, STATUS_LABELS, RECORRENCIA_OPCOES } from "@/lib/constants";
import type { Receita as ReceitaDB } from "@/types/database";
import {
  formatarMoeda,
  formatarData,
  formatarInputMoeda,
  parseMoeda,
  toastComDesfazer,
} from "@/utils";
import {
  atualizarStatusVencidos,
  marcarComoPago,
  desmarcarPago,
  alterarStatusEmMassa,
  excluirEmMassa,
} from "@/services/status.service";
import { InputMoeda } from "@/components/ui/input-moeda";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Plus,
  TrendingUp,
  DollarSign,
  Pencil,
  Trash2,
  Copy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  CheckCheck,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FinanceiroKpiCard } from "@/components/financeiro";
import { FinanceiroStatusBadge, STATUS_DOT_COLORS, VALUE_COLORS } from "@/components/financeiro";
import { FinanceiroFilterBar, FinanceiroSearch } from "@/components/financeiro";
import { FinanceiroEmptyState } from "@/components/financeiro";
import { FinanceiroBulkBar, FinanceiroBulkBarDesktop } from "@/components/financeiro";
import { FinanceiroSelectionHeader } from "@/components/financeiro";

type Receita = ReceitaDB & {
  cliente?: { nome: string } | null;
};

type RecorrenciaTipo = "" | "mensal" | "semanal" | "quinzenal" | "anual";

const FORM_DEFAULTS = {
  descricao: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  data_vencimento: "",
  data_pagamento: "",
  status: "pendente" as string,
  forma_pagamento: "pix",
  cliente_id: "",
  recorrencia_tipo: "" as RecorrenciaTipo,
  observacoes: "",
};

export default function ReceitasPage() {
  const supabase = useSupabase();
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string | null>(null);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Receita | null>(null);
  const [excluindo, setExcluindo] = useState<Receita | null>(null);
  const [excluindoBtn, setExcluindoBtn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [receitaSelecionada, setReceitaSelecionada] = useState<Receita | null>(null);

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [processandoMassa, setProcessandoMassa] = useState(false);
  const [modoSelecao, setModoSelecao] = useState(false);

  const [form, setForm] = useState(FORM_DEFAULTS);
  const [valorFormatado, setValorFormatado] = useState("");
  const valorInputRef = useRef<HTMLInputElement>(null);

  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    setPageItems,
    totalItems,
  } = usePagination<Receita>({ itemsPerPage: 50 });

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

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const receitasFiltradas = useMemo(() => {
    return receitas.filter((r) => {
      const buscaMatch =
        busca === "" ||
        r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        r.cliente?.nome?.toLowerCase().includes(busca.toLowerCase());

      const statusMatch = filtroStatus === "todos" || r.status === filtroStatus;

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

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatado = formatarInputMoeda(raw);
    setValorFormatado(formatado);
    const numero = parseMoeda(formatado);
    setForm({ ...form, valor: numero > 0 ? String(numero) : "" });
  }

  function handleValorBlur() {
    const numero = parseMoeda(valorFormatado);
    if (numero > 0) {
      setValorFormatado(formatarMoeda(numero));
    }
  }

  function setValorInicial(valor: number) {
    if (valor > 0) {
      setValorFormatado(formatarMoeda(valor));
    } else {
      setValorFormatado("");
    }
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

      const valorNum = parseMoeda(valorFormatado);
      if (valorNum <= 0) {
        toast.error("Valor inválido");
        return;
      }

      const payload = {
        descricao: form.descricao,
        valor: valorNum,
        data: form.data,
        data_vencimento: form.data_vencimento || null,
        data_pagamento: form.data_pagamento || null,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        cliente_id:
          form.cliente_id && form.cliente_id !== "none"
            ? form.cliente_id
            : null,
        recorrencia_tipo: form.recorrencia_tipo || null,
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
      setValorFormatado("");
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

        if (insertError) throw insertError;
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

  function toggleSelecao(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) setModoSelecao(false);
      return next;
    });
  }

  function toggleTodasSelecao() {
    if (selecionadas.size === receitasFiltradas.length) {
      setSelecionadas(new Set());
      setModoSelecao(false);
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
      setModoSelecao(false);
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
      setModoSelecao(false);
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
      setModoSelecao(false);
      carregarDados();
    } catch {
      toast.error("Erro ao excluir em massa");
    } finally {
      setProcessandoMassa(false);
    }
  }

  function abrirEdicao(receita: Receita) {
    setEditando(receita);
    setForm({
      descricao: receita.descricao,
      valor: String(receita.valor),
      data: receita.data,
      data_vencimento: receita.data_vencimento || "",
      data_pagamento: receita.data_pagamento || "",
      status: receita.status,
      forma_pagamento: receita.forma_pagamento || "pix",
      cliente_id: receita.cliente_id || "",
      recorrencia_tipo: (receita.recorrencia_tipo as RecorrenciaTipo) || "",
      observacoes: receita.observacoes || "",
    });
    setValorInicial(receita.valor);
    setDrawerAberto(false);
    setDialogAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_DEFAULTS);
    setValorFormatado("");
    setDialogAberto(true);
  }

  function abrirDrawer(receita: Receita) {
    if (modoSelecao) {
      toggleSelecao(receita.id);
      return;
    }
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

  function iniciarModoSelecao() {
    setModoSelecao(true);
  }

  function cancelarModoSelecao() {
    setModoSelecao(false);
    setSelecionadas(new Set());
  }

  return (
    <div className="space-y-4 pb-28 md:pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3 md:py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              Receitas
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Fluxo de caixa entradas
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
            {!modoSelecao && receitasFiltradas.length > 0 && (
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
                Novo
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {carregando ? (
          <div className="space-y-4">
            {/* KPI Skeleton */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-3 sm:p-4">
                    <Skeleton className="mb-2 h-3 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Search Skeleton */}
            <Skeleton className="h-11 w-full" />
            {/* Filter Skeleton */}
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
              ))}
            </div>
            {/* Card Skeleton */}
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16 shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards - 2x2 grid on mobile, 4-col on desktop */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <FinanceiroKpiCard label="Recebido" valor={kpis.recebido} icon={CheckCircle2} iconColor="text-emerald-600" iconBg="bg-emerald-100" valorColor="text-emerald-600" />
              <FinanceiroKpiCard label="A receber" valor={kpis.aReceber} icon={Clock} iconColor="text-blue-600" iconBg="bg-blue-100" valorColor="text-blue-600" />
              <FinanceiroKpiCard label="Atrasado" valor={kpis.atrasado} icon={AlertTriangle} iconColor="text-red-600" iconBg="bg-red-100" valorColor="text-red-600" />
              <FinanceiroKpiCard label="Total do mês" valor={kpis.totalMes} icon={DollarSign} iconColor="text-muted-foreground" iconBg="bg-muted" />
            </motion.div>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mt-4"
            >
              <FinanceiroSearch value={busca} onChange={setBusca} placeholder="Buscar receita..." />
            </motion.div>

            {/* Filter Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-3"
            >
              <FinanceiroFilterBar
                filters={[
                  { label: "Todos", value: "todos", count: contadores.todos },
                  { label: "Pagos", value: "pago", count: contadores.pagos, color: "border-emerald-600 bg-emerald-600 text-white" },
                  { label: "Pendentes", value: "pendente", count: contadores.pendentes, color: "border-yellow-500 bg-yellow-500 text-white" },
                  { label: "Atrasados", value: "atrasado", count: contadores.atrasados, color: "border-red-600 bg-red-600 text-white" },
                  { label: "---", value: "__divider__" },
                  { label: "Este mês", value: "este_mes" },
                  { label: "Próximo mês", value: "proximo_mes" },
                  { label: "Últimos 30 dias", value: "ultimos_30_dias" },
                ]}
                activeValue={filtroPeriodo || filtroStatus}
                onSelect={(value) => {
                  if (value === "__divider__") return;
                  if (["este_mes", "proximo_mes", "ultimos_30_dias"].includes(value)) {
                    handleFiltraPeriodo(value);
                  } else {
                    handleFiltraStatus(value);
                  }
                }}
              />
            </motion.div>

            {/* Bulk Selection Header */}
            <AnimatePresence>
              {receitasFiltradas.length > 0 && modoSelecao && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 overflow-hidden"
                >
                  <FinanceiroSelectionHeader
                    total={receitasFiltradas.length}
                    selected={selecionadas.size}
                    allSelected={selecionadas.size === receitasFiltradas.length}
                    onSelectAll={toggleTodasSelecao}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {receitasFiltradas.length > 0 && !modoSelecao && (
              <div className="mt-3 flex items-center justify-end">
                <span className="text-xs text-muted-foreground">
                  {receitasFiltradas.length} resultado(s)
                </span>
              </div>
            )}

            {/* Empty State */}
            {receitasFiltradas.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4"
              >
                <FinanceiroEmptyState
                  icon={TrendingUp}
                  title="Nenhuma receita encontrada"
                  description="Adicione sua primeira receita"
                  actionLabel="Adicionar Receita"
                  onAction={abrirNovo}
                  hasFilters={!!busca || filtroStatus !== "todos" || !!filtroPeriodo}
                />
              </motion.div>
            ) : (
              <>
                {/* Mobile Cards (< md) */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2 space-y-2 md:hidden"
                >
                  <AnimatePresence mode="popLayout">
                    {paginatedItems.map((receita, index) => (
                      <motion.div
                        key={receita.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => abrirDrawer(receita)}
                        className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                          selecionadas.has(receita.id)
                            ? "border-emerald-500 bg-emerald-50/50"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {modoSelecao && (
                            <Checkbox
                              checked={selecionadas.has(receita.id)}
                              onCheckedChange={() => toggleSelecao(receita.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 h-5 w-5 shrink-0"
                            />
                          )}

                          <div
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_COLORS[receita.status] || STATUS_DOT_COLORS.pendente}`}
                          />

                          <div className="min-w-0 flex-1 gap-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-semibold">
                                {receita.descricao}
                              </p>
                              <span
                                className={`shrink-0 text-sm font-bold ${VALUE_COLORS[receita.status] || ""}`}
                              >
                                {formatarMoeda(receita.valor)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                                {receita.cliente?.nome || "Sem cliente"}
                              </span>
                              <span className="text-muted-foreground/40">•</span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatarData(receita.data)}
                              </span>
                            </div>
                            <div className="mt-1">
                              <FinanceiroStatusBadge status={receita.status} />
                            </div>
                          </div>

                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      onPageChange={goToPage}
                    />
                  )}
                </motion.div>

                {/* Desktop Table (md+) */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-3 hidden md:block"
                >
                  <div className="overflow-x-auto rounded-xl border">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          {modoSelecao && <TableHead className="w-10" />}
                          <TableHead className="w-8" />
                          <TableHead>Descrição</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence mode="popLayout">
                          {paginatedItems.map((receita, index) => (
                            <motion.tr
                              key={receita.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -50 }}
                              transition={{ delay: index * 0.01 }}
                              onClick={() => abrirDrawer(receita)}
                              className={`cursor-pointer transition-colors hover:bg-muted/30 ${
                                selecionadas.has(receita.id) ? "bg-emerald-50/50" : ""
                              } ${index % 2 === 0 ? "" : "bg-muted/20"}`}
                            >
                              {modoSelecao && (
                                <TableCell className="w-10 py-3">
                                  <Checkbox
                                    checked={selecionadas.has(receita.id)}
                                    onCheckedChange={() =>
                                      toggleSelecao(receita.id)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                              )}
                              <TableCell className="w-8 py-3">
                                <div
                                  className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLORS[receita.status]}`}
                                />
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="font-medium">
                                  {receita.descricao}
                                </span>
                              </TableCell>
                              <TableCell className="py-3 text-muted-foreground">
                                {receita.cliente?.nome || "-"}
                              </TableCell>
                              <TableCell className="py-3 text-muted-foreground">
                                {formatarData(receita.data)}
                              </TableCell>
                              <TableCell className="py-3 text-muted-foreground">
                                {receita.data_vencimento
                                  ? formatarData(receita.data_vencimento)
                                  : "-"}
                              </TableCell>
                              <TableCell className="py-3">
                                <FinanceiroStatusBadge status={receita.status} />
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <span
                                  className={`font-bold ${VALUE_COLORS[receita.status]}`}
                                >
                                  {formatarMoeda(receita.valor)}
                                </span>
                              </TableCell>
                              <TableCell className="w-10 py-3">
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      onPageChange={goToPage}
                    />
                  )}
                </motion.div>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile FAB */}
      {!carregando && !modoSelecao && (
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
        count={selecionadas.size}
        onCancel={cancelarModoSelecao}
        onMarkPaid={handleMarcarPagoMassa}
        onMarkPending={handleMarcarPendenteMassa}
        onDelete={handleExcluirMassa}
        processing={processandoMassa}
      />

      {/* Desktop Bottom Bulk Bar */}
      <FinanceiroBulkBarDesktop
        count={selecionadas.size}
        onCancel={cancelarModoSelecao}
        onMarkPaid={handleMarcarPagoMassa}
        onMarkPending={handleMarcarPendenteMassa}
        onDelete={handleExcluirMassa}
        processing={processandoMassa}
      />

      {/* Detail Drawer */}
      <Sheet open={drawerAberto} onOpenChange={setDrawerAberto}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl sm:max-w-none"
        >
          {receitaSelecionada && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="text-left text-base md:text-lg">
                  {receitaSelecionada.descricao}
                </SheetTitle>
                <SheetDescription className="text-left text-xs md:text-sm">
                  {receitaSelecionada.cliente?.nome || "Sem cliente"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${STATUS_DOT_COLORS[receitaSelecionada.status]}`}
                    />
                    <FinanceiroStatusBadge status={receitaSelecionada.status} />
                  </div>
                  <span
                    className={`text-xl font-bold md:text-2xl ${VALUE_COLORS[receitaSelecionada.status]}`}
                  >
                    {formatarMoeda(receitaSelecionada.valor)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                    <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                      Data
                    </p>
                    <p className="text-xs font-medium md:text-sm">
                      {formatarData(receitaSelecionada.data)}
                    </p>
                  </div>

                  {receitaSelecionada.data_vencimento && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Vencimento
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {formatarData(receitaSelecionada.data_vencimento)}
                      </p>
                    </div>
                  )}

                  {receitaSelecionada.data_pagamento && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Data Pgto
                      </p>
                      <p className="text-xs font-medium md:text-sm">
                        {formatarData(receitaSelecionada.data_pagamento)}
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                    <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                      Forma Pgto
                    </p>
                    <p className="text-xs font-medium md:text-sm">
                      {FORMAS_PAGAMENTO[
                        receitaSelecionada.forma_pagamento || ""
                      ] ||
                        receitaSelecionada.forma_pagamento ||
                        "-"}
                    </p>
                  </div>

                  {receitaSelecionada.recorrencia_tipo && (
                    <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                      <p className="mb-0.5 text-[10px] text-muted-foreground md:text-xs">
                        Recorrência
                      </p>
                      <p className="text-xs font-medium capitalize md:text-sm">
                        {receitaSelecionada.recorrencia_tipo}
                      </p>
                    </div>
                  )}
                </div>

                {receitaSelecionada.observacoes && (
                  <div className="rounded-xl bg-muted/50 p-2.5 md:p-3">
                    <p className="mb-1 text-[10px] text-muted-foreground md:text-xs">
                      Observações
                    </p>
                    <p className="text-xs md:text-sm">
                      {receitaSelecionada.observacoes}
                    </p>
                  </div>
                )}

                {receitaSelecionada.status !== "pago" ? (
                  <Button
                    className="h-12 w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleMarcarPago(receitaSelecionada)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Marcar como pago
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="h-12 w-full"
                    onClick={() => handleDesmarcarPago(receitaSelecionada)}
                  >
                    Desmarcar como pago
                  </Button>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex h-auto flex-col gap-1 py-3"
                    onClick={() => abrirEdicao(receitaSelecionada)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="text-xs">Editar</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex h-auto flex-col gap-1 py-3"
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
                    className="flex h-auto flex-col gap-1 border-red-200 py-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => setExcluindo(receitaSelecionada)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">
              {editando ? "Editar Receita" : "Nova Receita"}
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              {editando
                ? "Atualize as informações da receita"
                : "Preencha os dados para adicionar uma nova receita"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs md:text-sm">
                Descrição *
              </Label>
              <Input
                id="descricao"
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Ex: Serviço de instalação"
                required
                className="h-11 w-full min-w-0 text-sm"
              />
            </div>

            {/* Valor + Data */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="valor" className="text-xs md:text-sm">
                  Valor (R$) *
                </Label>
                <InputMoeda
                  id="valor"
                  value={parseMoeda(valorFormatado)}
                  onChange={(val) => {
                    setValorFormatado(val > 0 ? formatarMoeda(val) : "");
                    setForm({ ...form, valor: val > 0 ? String(val) : "" });
                  }}
                  placeholder="R$ 0,00"
                  className="h-11 w-full min-w-0 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data" className="text-xs md:text-sm">
                  Data *
                </Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) =>
                    setForm({ ...form, data: e.target.value })
                  }
                  required
                  className="h-11 w-full min-w-0 text-sm"
                />
              </div>
            </div>

            {/* Vencimento + Pagamento */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="data_vencimento" className="text-xs md:text-sm">
                  Data de Vencimento
                </Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) =>
                    setForm({ ...form, data_vencimento: e.target.value })
                  }
                  className="h-11 w-full min-w-0 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="data_pagamento" className="text-xs md:text-sm">
                  Data de Pagamento
                </Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={form.data_pagamento}
                  onChange={(e) =>
                    setForm({ ...form, data_pagamento: e.target.value })
                  }
                  className="h-11 w-full min-w-0 text-sm"
                />
              </div>
            </div>

            {/* Forma Pgto + Status */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Forma de Pagamento</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(value) =>
                    setForm({ ...form, forma_pagamento: value })
                  }
                >
                  <SelectTrigger className="h-11 w-full min-w-0 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMAS_PAGAMENTO).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm({ ...form, status: value })
                  }
                >
                  <SelectTrigger className="h-11 w-full min-w-0 text-sm">
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

            {/* Cliente + Recorrência */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Cliente</Label>
                <Select
                  value={form.cliente_id}
                  onValueChange={(value) =>
                    setForm({ ...form, cliente_id: value })
                  }
                >
                  <SelectTrigger className="h-11 w-full min-w-0 text-sm">
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
              <div className="space-y-1.5">
                <Label className="text-xs md:text-sm">Recorrência</Label>
                <Select
                  value={form.recorrencia_tipo}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      recorrencia_tipo: value as RecorrenciaTipo,
                    })
                  }
                >
                  <SelectTrigger className="h-11 w-full min-w-0 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {RECORRENCIA_OPCOES.map((opt) => (
                      <SelectItem key={opt.valor} value={opt.valor}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="observacoes" className="text-xs md:text-sm">
                Observações
              </Label>
              <textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                placeholder="Observações adicionais..."
                rows={3}
                className="flex w-full min-w-0 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    ? "Salvar Alterações"
                    : "Adicionar Receita"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!excluindo}
        onOpenChange={(open) => !open && setExcluindo(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Receita</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a receita &quot;
              {excluindo?.descricao}&quot;? Esta ação não pode ser desfeita.
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
    </div>
  );
}
