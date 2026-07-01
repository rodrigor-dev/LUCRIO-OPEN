"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { FORMAS_PAGAMENTO, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";
import type { Receita as ReceitaDB } from "@/types/database";
import { formatarMoeda } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  DollarSign,
  Pencil,
  Trash2,
  Filter,
  Copy,
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
  status: "pendente",
  forma_pagamento: "pix",
  cliente_id: "",
  observacoes: "",
};

export default function ReceitasPage() {
  const supabase = useSupabase();
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Receita | null>(null);
  const [excluindo, setExcluindo] = useState<Receita | null>(null);
  const [excluindoBtn, setExcluindoBtn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState(FORM_DEFAULTS);

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
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        cliente_id: form.cliente_id && form.cliente_id !== "none" ? form.cliente_id : null,
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
      const { error } = await supabase.from("receitas").delete().eq("id", excluindo.id);

      if (error) {
        toast.error("Erro ao excluir receita");
        return;
      }

      toast.success("Receita excluída com sucesso!");
      setExcluindo(null);
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

  function abrirEdicao(receita: Receita) {
    setEditando(receita);
    setForm({
      descricao: receita.descricao,
      valor: String(receita.valor),
      data: receita.data,
      status: receita.status,
      forma_pagamento: receita.forma_pagamento || "pix",
      cliente_id: receita.cliente_id || "",
      observacoes: receita.observacoes || "",
    });
    setDialogAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_DEFAULTS);
    setDialogAberto(true);
  }

  const receitasFiltradas = receitas.filter((r) => {
    const buscaMatch =
      busca === "" ||
      r.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      r.cliente?.nome?.toLowerCase().includes(busca.toLowerCase());

    const statusMatch = filtroStatus === "todos" || r.status === filtroStatus;

    return buscaMatch && statusMatch;
  });

  const totalFiltrado = receitasFiltradas.reduce((acc, r) => acc + r.valor, 0);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
            Receitas
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas entradas financeiras
          </p>
        </div>
        <Button onClick={abrirNovo} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          Nova Receita
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

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
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
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
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatarMoeda(totalFiltrado)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {receitasFiltradas.length} receita(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagas</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatarMoeda(
                    receitasFiltradas
                      .filter((r) => r.status === "pago")
                      .reduce((acc, r) => acc + r.valor, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {receitasFiltradas.filter((r) => r.status === "pago").length} paga(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <DollarSign className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatarMoeda(
                    receitasFiltradas
                      .filter((r) => r.status === "pendente")
                      .reduce((acc, r) => acc + r.valor, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {receitasFiltradas.filter((r) => r.status === "pendente").length} pendente(s)
                </p>
              </CardContent>
            </Card>
          </div>

          {receitasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">Nenhuma receita encontrada</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  {busca || filtroStatus !== "todos"
                    ? "Tente ajustar os filtros de busca"
                    : "Adicione sua primeira receita para começar"}
                </p>
                {!busca && filtroStatus === "todos" && (
                  <Button onClick={abrirNovo} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Receita
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
            <div className="hidden md:block">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="hidden sm:table-cell">Data</TableHead>
                        <TableHead className="hidden md:table-cell">Forma Pgto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {receitasFiltradas.map((receita, index) => (
                          <motion.tr
                            key={receita.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.03 }}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{receita.descricao}</p>
                                {receita.cliente?.nome && (
                                  <p className="text-xs text-muted-foreground">
                                    {receita.cliente.nome}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">
                              {formatarMoeda(receita.valor)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {new Intl.DateTimeFormat("pt-BR").format(new Date(receita.data))}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {FORMAS_PAGAMENTO[receita.forma_pagamento || ""] || receita.forma_pagamento || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANTS[receita.status] || "outline"}>
                                {STATUS_LABELS[receita.status] || receita.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  onClick={() => handleDuplicar(receita)}
                                  title="Duplicar"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  onClick={() => abrirEdicao(receita)}
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 text-destructive hover:text-destructive"
                                  onClick={() => setExcluindo(receita)}
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
              {receitasFiltradas.map((receita) => (
                <motion.div
                  key={receita.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{receita.descricao}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(receita.data).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-green-600">
                      {formatarMoeda(receita.valor)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant={STATUS_VARIANTS[receita.status as keyof typeof STATUS_VARIANTS]}>
                      {STATUS_LABELS[receita.status as keyof typeof STATUS_LABELS]}
                    </Badge>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => abrirEdicao(receita)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setExcluindo(receita)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            </>
          )}
        </motion.div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Receita" : "Nova Receita"}</DialogTitle>
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
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(value) => setForm({ ...form, forma_pagamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
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
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={form.cliente_id}
                onValueChange={(value) => setForm({ ...form, cliente_id: value })}
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
                {submitting ? "Salvando..." : editando ? "Salvar Alterações" : "Adicionar Receita"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Receita</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a receita &quot;{excluindo?.descricao}&quot;? Esta ação não
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
    </div>
  );
}
