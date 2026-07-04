"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import {
  FORMAS_PAGAMENTO_DESPESA,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from "@/lib/constants";
import type { Despesa as DespesaDB } from "@/types/database";
import { formatarMoeda, toastComDesfazer } from "@/utils";
import { atualizarStatusVencidos, alterarStatusEmMassa, excluirEmMassa } from "@/services/status.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Pencil,
  Trash2,
  Filter,
  CreditCard,
  X,
  CalendarDays,
  Check,
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

export default function DespesasPage() {
  const supabase = useSupabase();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [excluindo, setExcluindo] = useState<Despesa | null>(null);
  const [excluindoBtn, setExcluindoBtn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [acaoEmMassa, setAcaoEmMassa] = useState<"pagar" | "pendente" | "excluir" | null>(null);

  const [form, setForm] = useState(FORM_DEFAULTS);

  const valorParcelaCalculado = useMemo(() => {
    if (form.forma_pagamento !== "credito" || form.cartao_tipo !== "parcelado") return 0;
    const total = parseFloat(form.cartao_valor_total);
    const parcelas = parseInt(form.cartao_parcelas, 10);
    if (isNaN(total) || isNaN(parcelas) || parcelas <= 0) return 0;
    return total / parcelas;
  }, [form.forma_pagamento, form.cartao_tipo, form.cartao_valor_total, form.cartao_parcelas]);

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
        // ignore status update errors silently
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

      const isCredito = form.forma_pagamento === "credito";
      const isParcelado = isCredito && form.cartao_tipo === "parcelado";

      const basePayload = {
        descricao: form.descricao,
        valor: valorNum,
        data: form.data,
        data_vencimento: form.data_vencimento || null,
        data_pagamento: form.status === "pago" ? (form.data_pagamento || new Date().toISOString().split("T")[0]) : null,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        categoria_id: form.categoria_id && form.categoria_id !== "none" ? form.categoria_id : null,
        fornecedor: form.fornecedor || null,
        comprovante_url: form.comprovante_url || null,
        observacoes: form.observacoes,
        cartao_tipo: isCredito ? form.cartao_tipo : null,
        cartao_parcelas: isCredito && form.cartao_tipo === "parcelado" ? parseInt(form.cartao_parcelas, 10) : null,
        cartao_valor_total: isCredito && form.cartao_tipo === "parcelado" ? parseFloat(form.cartao_valor_total) : null,
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
          const dataVencimentoStr = dataParcela.toISOString().split("T")[0];

          inserts.push({
            ...basePayload,
            valor: valorParcela,
            descricao: `${form.descricao} (${i + 1}/${numParcelas})`,
            data_vencimento: dataVencimentoStr,
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

      setDialogAberto(false);
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

        if (insertError) {
          throw insertError;
        }
      });

      setExcluindo(null);
      carregarDados();
    } catch {
      toast.error("Erro ao excluir despesa");
    } finally {
      setExcluindoBtn(false);
    }
  }

  function abrirEdicao(despesa: Despesa) {
    setEditando(despesa);
    setForm({
      descricao: despesa.descricao,
      valor: String(despesa.valor),
      data: despesa.data,
      data_vencimento: despesa.data_vencimento || "",
      data_pagamento: despesa.data_pagamento || "",
      status: despesa.status,
      forma_pagamento: despesa.forma_pagamento || "pix",
      categoria_id: despesa.categoria_id || "",
      fornecedor: despesa.fornecedor || "",
      comprovante_url: despesa.comprovante_url || "",
      observacoes: despesa.observacoes || "",
      cartao_tipo: despesa.cartao_tipo || "avista",
      cartao_parcelas: String(despesa.cartao_parcelas || 12),
      cartao_valor_total: despesa.cartao_valor_total ? String(despesa.cartao_valor_total) : "",
    });
    setDialogAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_DEFAULTS);
    setDialogAberto(true);
  }

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === despesasFiltradas.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(despesasFiltradas.map((d) => d.id)));
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

  const despesasFiltradas = despesas.filter((d) => {
    const buscaMatch =
      busca === "" ||
      d.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      d.categoria?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      d.fornecedor?.toLowerCase().includes(busca.toLowerCase());

    const categoriaMatch = filtroCategoria === "todas" || d.categoria_id === filtroCategoria;

    const statusMatch = filtroStatus === "todos" || d.status === filtroStatus;

    const hoje = new Date().toISOString().split("T")[0];
    if (filtroStatus === "todos") {
      const isEsteMes = (() => {
        const dMes = new Date(d.data_vencimento || d.data);
        const agora = new Date();
        return dMes.getMonth() === agora.getMonth() && dMes.getFullYear() === agora.getFullYear();
      })();
      if (!busca && filtroCategoria === "todas" && !statusMatch) {
        return isEsteMes && buscaMatch && categoriaMatch;
      }
    }

    return buscaMatch && categoriaMatch && statusMatch;
  });

  const totalFiltrado = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <TrendingDown className="h-6 w-6 text-emerald-600" />
            Despesas
          </h1>
          <p className="text-muted-foreground">Gerencie suas saídas financeiras</p>
        </div>
        <Button onClick={abrirNovo} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          Nova Despesa
        </Button>
      </motion.div>

      {/* Smart Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        {(["todos", "pago", "pendente", "atrasado"] as FiltroStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFiltroStatus(status)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filtroStatus === status
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-muted bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>
              {status === "todos"
                ? "Todos"
                : status === "pago"
                  ? "Pagos"
                  : status === "pendente"
                    ? "Pendentes"
                    : "Atrasados"}
            </span>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                filtroStatus === status
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {contarPorStatus(status)}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Search and Category Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, categoria ou fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
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
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <span className="text-sm font-medium text-emerald-800">
                {selecionados.size} selecionado(s)
              </span>
              <div className="flex flex-wrap gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                  onClick={() => {
                    setAcaoEmMassa("pagar");
                  }}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Marcar como pago
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-yellow-300 bg-white text-yellow-700 hover:bg-yellow-50"
                  onClick={() => {
                    setAcaoEmMassa("pendente");
                  }}
                >
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  Marcar como pendente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 bg-white text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setAcaoEmMassa("excluir");
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Excluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelecionados(new Set())}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {carregando ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="space-y-4 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatarMoeda(totalFiltrado)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {despesasFiltradas.length} despesa(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagas</CardTitle>
                <TrendingDown className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatarMoeda(
                    despesasFiltradas
                      .filter((d) => d.status === "pago")
                      .reduce((acc, d) => acc + d.valor, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {despesasFiltradas.filter((d) => d.status === "pago").length} paga(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <TrendingDown className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatarMoeda(
                    despesasFiltradas
                      .filter((d) => d.status === "pendente" || d.status === "atrasado")
                      .reduce((acc, d) => acc + d.valor, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {despesasFiltradas.filter((d) => d.status === "pendente" || d.status === "atrasado").length} em aberto
                </p>
              </CardContent>
            </Card>
          </div>

          {despesasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingDown className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">Nenhuma despesa encontrada</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  {busca || filtroCategoria !== "todas" || filtroStatus !== "todos"
                    ? "Tente ajustar os filtros de busca"
                    : "Adicione sua primeira despesa para começar"}
                </p>
                {!busca && filtroCategoria === "todas" && filtroStatus === "todos" && (
                  <Button onClick={abrirNovo} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Despesa
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
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
                                despesasFiltradas.length > 0 &&
                                selecionados.size === despesasFiltradas.length
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
                          {despesasFiltradas.map((despesa, index) => (
                            <motion.tr
                              key={despesa.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ delay: index * 0.03 }}
                              className={`border-b transition-colors hover:bg-muted/50 ${
                                selecionados.has(despesa.id) ? "bg-emerald-50/50" : ""
                              }`}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selecionados.has(despesa.id)}
                                  onCheckedChange={() => toggleSelecionado(despesa.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">
                                    {despesa.descricao}
                                    {despesa.parcela_numero && despesa.parcela_total && (
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        ({despesa.parcela_numero}/{despesa.parcela_total})
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground sm:hidden">
                                    {new Intl.DateTimeFormat("pt-BR").format(
                                      new Date(despesa.data_vencimento || despesa.data)
                                    )}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                {despesa.categoria ? (
                                  <Badge
                                    variant="outline"
                                    className="gap-1"
                                    style={{
                                      borderColor: despesa.categoria.cor || undefined,
                                      color: despesa.categoria.cor || undefined,
                                    }}
                                  >
                                    {despesa.categoria.icone && (
                                      <span>{despesa.categoria.icone}</span>
                                    )}
                                    {despesa.categoria.nome}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Sem categoria</span>
                                )}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-muted-foreground">
                                {despesa.fornecedor || "-"}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-red-600">
                                -{formatarMoeda(despesa.valor)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground">
                                {despesa.data_vencimento
                                  ? new Intl.DateTimeFormat("pt-BR").format(new Date(despesa.data_vencimento))
                                  : new Intl.DateTimeFormat("pt-BR").format(new Date(despesa.data))}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-muted-foreground">
                                {FORMAS_PAGAMENTO_DESPESA[despesa.forma_pagamento || ""] ||
                                  despesa.forma_pagamento ||
                                  "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={STATUS_VARIANTS[despesa.status] || "outline"}>
                                  {STATUS_LABELS[despesa.status] || despesa.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11"
                                    onClick={() => abrirEdicao(despesa)}
                                    title="Editar"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 text-destructive hover:text-destructive"
                                    onClick={() => setExcluindo(despesa)}
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
              {/* Mobile Cards */}
              <div className="grid gap-3 md:hidden">
                {despesasFiltradas.map((despesa) => (
                  <motion.div
                    key={despesa.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border bg-card p-4 shadow-sm ${
                      selecionados.has(despesa.id) ? "border-emerald-400 bg-emerald-50/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <Checkbox
                          checked={selecionados.has(despesa.id)}
                          onCheckedChange={() => toggleSelecionado(despesa.id)}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between">
                          <p className="font-medium">
                            {despesa.descricao}
                            {despesa.parcela_numero && despesa.parcela_total && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({despesa.parcela_numero}/{despesa.parcela_total})
                              </span>
                            )}
                          </p>
                          <p className="text-lg font-bold text-red-600">
                            -{formatarMoeda(despesa.valor)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {despesa.fornecedor && (
                            <span className="mr-2">{despesa.fornecedor}</span>
                          )}
                          {new Date(despesa.data_vencimento || despesa.data).toLocaleDateString(
                            "pt-BR"
                          )}
                          {despesa.data_vencimento && (
                            <span className="ml-2">
                              {FORMAS_PAGAMENTO_DESPESA[despesa.forma_pagamento || ""] || ""}
                            </span>
                          )}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={STATUS_VARIANTS[despesa.status as keyof typeof STATUS_VARIANTS]}
                            >
                              {STATUS_LABELS[despesa.status as keyof typeof STATUS_LABELS]}
                            </Badge>
                            {despesa.categoria && (
                              <Badge
                                variant="outline"
                                className="gap-1"
                                style={{
                                  borderColor: despesa.categoria.cor || undefined,
                                  color: despesa.categoria.cor || undefined,
                                }}
                              >
                                {despesa.categoria.icone && (
                                  <span>{despesa.categoria.icone}</span>
                                )}
                                {despesa.categoria.nome}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11"
                              onClick={() => abrirEdicao(despesa)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11"
                              onClick={() => setExcluindo(despesa)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize as informações da despesa"
                : "Preencha os dados para adicionar uma nova despesa"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex: Compra de materiais"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input
                  id="fornecedor"
                  value={form.fornecedor}
                  onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor..."
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
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data">Data de Criação *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_vencimento">Data de Vencimento</Label>
                  <Input
                    id="data_vencimento"
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
                  />
                </div>
                {form.status === "pago" && (
                  <div className="space-y-2">
                    <Label htmlFor="data_pagamento">Data de Pagamento</Label>
                    <Input
                      id="data_pagamento"
                      type="date"
                      value={form.data_pagamento}
                      onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoria_id}
                  onValueChange={(value) => setForm({ ...form, categoria_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select
                    value={form.forma_pagamento}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        forma_pagamento: value,
                        cartao_tipo: value === "credito" ? form.cartao_tipo : "avista",
                      })
                    }
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm({ ...form, status: value })}
                  >
                    <SelectTrigger>
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

              {/* Credit Card Fields */}
              {form.forma_pagamento === "credito" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                    <CreditCard className="h-4 w-4" />
                    Cartão de Crédito
                  </div>
                  <div className="space-y-3">
                    <Label>Tipo</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, cartao_tipo: "avista" })}
                        className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
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
                        className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          form.cartao_tipo === "parcelado"
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                        }`}
                      >
                        Parcelado
                      </button>
                    </div>
                  </div>

                  {form.cartao_tipo === "parcelado" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cartao_parcelas">Número de parcelas</Label>
                          <Input
                            id="cartao_parcelas"
                            type="number"
                            min="2"
                            max="48"
                            value={form.cartao_parcelas}
                            onChange={(e) => setForm({ ...form, cartao_parcelas: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cartao_valor_total">Valor total (R$)</Label>
                          <Input
                            id="cartao_valor_total"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.cartao_valor_total}
                            onChange={(e) => setForm({ ...form, cartao_valor_total: e.target.value })}
                            placeholder="0,00"
                            required
                          />
                        </div>
                      </div>
                      {valorParcelaCalculado > 0 && (
                        <div className="flex items-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-sm text-blue-800">
                          <Check className="h-4 w-4" />
                          {parseInt(form.cartao_parcelas, 10) || 0}x de{" "}
                          {formatarMoeda(valorParcelaCalculado)}
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="comprovante_url">Comprovante URL</Label>
                <Input
                  id="comprovante_url"
                  value={form.comprovante_url}
                  onChange={(e) => setForm({ ...form, comprovante_url: e.target.value })}
                  placeholder="URL do comprovante..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Input
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
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
                  {submitting ? "Salvando..." : editando ? "Salvar Alterações" : "Adicionar Despesa"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a despesa &quot;{excluindo?.descricao}&quot;? Esta ação não
              pode ser desfeita.
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

      {/* Bulk Action Confirmation */}
      <AlertDialog open={!!acaoEmMassa} onOpenChange={(open) => !open && setAcaoEmMassa(null)}>
        <AlertDialogContent>
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
                ? `Tem certeza que deseja excluir ${selecionados.size} despesa(s)? Esta ação não pode ser desfeita.`
                : acaoEmMassa === "pagar"
                  ? `Marcar ${selecionados.size} despesa(s) como paga(s)? A data de pagamento será definida como hoje.`
                  : `Marcar ${selecionados.size} despesa(s) como pendente(s)?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executarAcaoEmMassa}
              className={
                acaoEmMassa === "excluir"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
