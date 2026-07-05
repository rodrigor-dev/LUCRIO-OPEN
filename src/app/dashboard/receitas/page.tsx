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
  ChevronRight,
  CheckCheck,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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

function parseMoedaParaNumero(valor: string): number {
  const limpo = valor.replace(/[^\d,]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function formatarInputMoeda(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, "");
  if (apenasNumeros.length === 0) return "";
  const centavos = apenasNumeros.padStart(3, "0");
  const inteiros = centavos.slice(0, -2);
  const decimal = centavos.slice(-2);
  const inteirosFormatados = inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${inteirosFormatados},${decimal}`;
}

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
    const numero = parseMoedaParaNumero(formatado);
    setForm({ ...form, valor: numero > 0 ? String(numero) : "" });
  }

  function handleValorBlur() {
    const numero = parseMoedaParaNumero(valorFormatado);
    if (numero > 0) {
      setValorFormatado(formatarMoeda(numero).replace("R$", "R$"));
    }
  }

  function setValorInicial(valor: number) {
    if (valor > 0) {
      const formatado = formatarMoeda(valor);
      setValorFormatado(formatado);
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

      const valorNum = parseMoedaParaNumero(valorFormatado);
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

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3 md:py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight md:text-xl">
              Receitas
            </h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Fluxo de caixa entradas
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                className="hidden md:flex h-9 px-3 text-xs"
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Selecionar
              </Button>
            )}
            {!modoSelecao && (
              <Button
                onClick={abrirNovo}
                size="sm"
                className="hidden md:flex bg-emerald-600 hover:bg-emerald-700 h-9 px-3 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Novo
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {carregando ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border bg-card p-4"
                >
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4">
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
            {/* KPI Cards - 2x2 Grid */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="rounded-2xl border bg-card p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 md:h-3.5 md:w-3.5" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground md:text-xs">
                    Recebido
                  </span>
                </div>
                <p className="text-base font-bold text-emerald-600 md:text-lg">
                  {formatarMoeda(kpis.recebido)}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                    <Clock className="h-3 w-3 text-blue-600 md:h-3.5 md:w-3.5" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground md:text-xs">
                    A receber
                  </span>
                </div>
                <p className="text-base font-bold text-blue-600 md:text-lg">
                  {formatarMoeda(kpis.aReceber)}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-3 w-3 text-red-600 md:h-3.5 md:w-3.5" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground md:text-xs">
                    Atrasado
                  </span>
                </div>
                <p className="text-base font-bold text-red-600 md:text-lg">
                  {formatarMoeda(kpis.atrasado)}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                    <DollarSign className="h-3 w-3 text-muted-foreground md:h-3.5 md:w-3.5" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground md:text-xs">
                    Total do mês
                  </span>
                </div>
                <p className="text-base font-bold md:text-lg">
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
                  className="h-11 w-full rounded-xl border bg-card pl-10 pr-10 text-sm"
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

            {/* Filter Pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-3 -mx-4 overflow-x-auto px-4"
            >
              <div className="flex gap-2 pb-2" style={{ minWidth: "max-content" }}>
                <button
                  onClick={() => handleFiltraStatus("todos")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtroStatus === "todos" && !filtroPeriodo
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Todos
                  <span className="opacity-70">({contadores.todos})</span>
                </button>

                <button
                  onClick={() => handleFiltraStatus("pago")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtroStatus === "pago"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Pagos
                  <span className="opacity-70">({contadores.pagos})</span>
                </button>

                <button
                  onClick={() => handleFiltraStatus("pendente")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtroStatus === "pendente"
                      ? "border-yellow-500 bg-yellow-500 text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Pendentes
                  <span className="opacity-70">({contadores.pendentes})</span>
                </button>

                <button
                  onClick={() => handleFiltraStatus("atrasado")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtroStatus === "atrasado"
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Atrasados
                  <span className="opacity-70">({contadores.atrasados})</span>
                </button>

                <div className="w-px shrink-0 self-stretch bg-border" />

                <button
                  onClick={() => handleFiltraPeriodo("este_mes")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtroPeriodo === "este_mes"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Este mês
                </button>

                <button
                  onClick={() => handleFiltraPeriodo("proximo_mes")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtroPeriodo === "proximo_mes"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Próximo mês
                </button>

                <button
                  onClick={() => handleFiltraPeriodo("ultimos_30_dias")}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    filtroPeriodo === "ultimos_30_dias"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Últimos 30 dias
                </button>
              </div>
            </motion.div>

            {/* Desktop Bulk Selection Header */}
            {receitasFiltradas.length > 0 && modoSelecao && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-2 flex items-center justify-between py-2"
              >
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
                <span className="text-xs text-muted-foreground">
                  {receitasFiltradas.length} resultado(s)
                </span>
              </motion.div>
            )}

            {receitasFiltradas.length > 0 && !modoSelecao && (
              <div className="mt-3 flex items-center justify-end">
                <span className="text-xs text-muted-foreground">
                  {receitasFiltradas.length} resultado(s)
                </span>
              </div>
            )}

            {/* Desktop Table (md+) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-2 hidden md:block"
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
                  <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                          {modoSelecao && <th className="w-10 px-3 py-2.5" />}
                          <th className="px-3 py-2.5">Descrição</th>
                          <th className="px-3 py-2.5">Cliente</th>
                          <th className="px-3 py-2.5">Data</th>
                          <th className="px-3 py-2.5">Vencimento</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">Valor</th>
                          <th className="w-10 px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
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
                              className={`cursor-pointer border-b transition-colors hover:bg-muted/30 ${
                                selecionadas.has(receita.id)
                                  ? "bg-emerald-50/50"
                                  : ""
                              } ${index % 2 === 0 ? "" : "bg-muted/20"}`}
                            >
                              {modoSelecao && (
                                <td className="px-3 py-3">
                                  <Checkbox
                                    checked={selecionadas.has(receita.id)}
                                    onCheckedChange={() =>
                                      toggleSelecao(receita.id)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </td>
                              )}
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[receita.status]}`}
                                  />
                                  <span className="font-medium">
                                    {receita.descricao}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {receita.cliente?.nome || "-"}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {formatarData(receita.data)}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {receita.data_vencimento
                                  ? formatarData(receita.data_vencimento)
                                  : "-"}
                              </td>
                              <td className="px-3 py-3">
                                {statusBadge(receita.status)}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <span
                                  className={`font-bold ${VALUE_COLORS[receita.status]}`}
                                >
                                  {formatarMoeda(receita.valor)}
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
                </>
              )}
            </motion.div>

            {/* Mobile Cards (< md) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-2 space-y-2 md:hidden"
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
                        onClick={() => abrirDrawer(receita)}
                        className={`flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors ${
                          selecionadas.has(receita.id)
                            ? "border-emerald-500 bg-emerald-50/50"
                            : ""
                        }`}
                      >
                        {modoSelecao && (
                          <Checkbox
                            checked={selecionadas.has(receita.id)}
                            onCheckedChange={() => toggleSelecao(receita.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-5 w-5 shrink-0"
                          />
                        )}

                        <div
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_COLORS[receita.status] || STATUS_DOT_COLORS.pendente}`}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {receita.descricao}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {receita.cliente?.nome && (
                              <span className="truncate">
                                {receita.cliente.nome}
                              </span>
                            )}
                            {!receita.cliente?.nome && (
                              <span>{formatarData(receita.data)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
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

      {/* Mobile FAB */}
      {!carregando && !modoSelecao && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.3 }}
          className="fixed bottom-6 right-4 z-40 md:hidden"
        >
          <Button
            onClick={abrirNovo}
            className="h-14 w-14 rounded-full bg-emerald-600 p-0 shadow-lg hover:bg-emerald-700 active:scale-95 transition-transform"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </motion.div>
      )}

      {/* Mobile Bottom Bulk Action Bar */}
      <AnimatePresence>
        {selecionadas.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                {selecionadas.size} selecionada(s)
              </span>
              <button
                onClick={cancelarModoSelecao}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={handleMarcarPagoMassa}
                disabled={processandoMassa}
              >
                <CheckCheck className="mr-1 h-4 w-4" />
                Pago
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800"
                onClick={handleMarcarPendenteMassa}
                disabled={processandoMassa}
              >
                <Clock className="mr-1 h-4 w-4" />
                Pendente
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
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

      {/* Desktop Bottom Bulk Bar */}
      <AnimatePresence>
        {selecionadas.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 hidden border-t bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 md:block"
          >
            <div className="mx-auto flex max-w-5xl items-center gap-4">
              <span className="text-sm font-medium">
                {selecionadas.size} selecionada(s)
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={handleMarcarPagoMassa}
                  disabled={processandoMassa}
                >
                  <CheckCheck className="mr-1 h-4 w-4" />
                  Marcar Pago
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800"
                  onClick={handleMarcarPendenteMassa}
                  disabled={processandoMassa}
                >
                  <Clock className="mr-1 h-4 w-4" />
                  Pendente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={handleExcluirMassa}
                  disabled={processandoMassa}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    {statusBadge(receitaSelecionada.status)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
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
                className="h-11 w-full text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valor" className="text-xs md:text-sm">
                  Valor (R$) *
                </Label>
                <Input
                  ref={valorInputRef}
                  id="valor"
                  type="text"
                  inputMode="decimal"
                  value={valorFormatado}
                  onChange={handleValorChange}
                  onBlur={handleValorBlur}
                  onFocus={(e) => {
                    const num = parseMoedaParaNumero(e.target.value);
                    if (num > 0) {
                      setValorFormatado(String(num).replace(".", ","));
                    }
                  }}
                  placeholder="R$ 0,00"
                  required
                  className="h-11 w-full text-sm"
                />
              </div>
              <div className="space-y-2">
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
                  className="h-11 w-full text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
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
                  className="h-11 w-full text-sm"
                />
              </div>
              <div className="space-y-2">
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
                  className="h-11 w-full text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Forma de Pagamento</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(value) =>
                    setForm({ ...form, forma_pagamento: value })
                  }
                >
                  <SelectTrigger className="h-11 w-full text-sm">
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
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm({ ...form, status: value })
                  }
                >
                  <SelectTrigger className="h-11 w-full text-sm">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs md:text-sm">Cliente</Label>
                <Select
                  value={form.cliente_id}
                  onValueChange={(value) =>
                    setForm({ ...form, cliente_id: value })
                  }
                >
                  <SelectTrigger className="h-11 w-full text-sm">
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
                <Label className="text-xs md:text-sm">Recorrência</Label>
                <Select
                  value={form.recorrencia_tipo}
                  onValueChange={(value) =>
                    setForm({ ...form, recorrencia_tipo: value as RecorrenciaTipo })
                  }
                >
                  <SelectTrigger className="h-11 w-full text-sm">
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

            <div className="space-y-2">
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
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
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
        <AlertDialogContent>
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
