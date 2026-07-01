"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { FORMAS_PAGAMENTO, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";
import type { Servico as ServicoDB } from "@/types/database";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  Wrench,
  Pencil,
  Trash2,
  Filter,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type Servico = ServicoDB & {
  cliente?: { nome: string } | null;
};

const FORM_DEFAULTS = {
  nome: "",
  descricao: "",
  categoria: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  status: "pendente",
  forma_pagamento: "pix",
  cliente_id: "",
  observacoes: "",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pendente: <Clock className="h-3 w-3" />,
  concluido: <CheckCircle className="h-3 w-3" />,
  cancelado: <XCircle className="h-3 w-3" />,
};

export default function ServicosPage() {
  const supabase = useSupabase();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Servico | null>(null);
  const [excluindo, setExcluindo] = useState<Servico | null>(null);
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

      const [servicosRes, clientesRes] = await Promise.all([
        supabase
          .from("servicos")
          .select("*, cliente:clientes(nome)")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome")
          .eq("negocio_id", negocio.id)
          .order("nome"),
      ]);

      if (servicosRes.error) {
        toast.error("Erro ao carregar serviços");
        return;
      }

      setServicos(servicosRes.data || []);
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

      const payload = {
        nome: form.nome,
        descricao: form.descricao,
        categoria: form.categoria,
        valor: parseFloat(form.valor),
        data: form.data,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        cliente_id: form.cliente_id && form.cliente_id !== "none" ? form.cliente_id : null,
        observacoes: form.observacoes,
      };

      if (editando) {
        const { error } = await supabase
          .from("servicos")
          .update(payload)
          .eq("id", editando.id);

        if (error) {
          toast.error("Erro ao atualizar serviço");
          return;
        }

        toast.success("Serviço atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("servicos").insert({
          negocio_id: negocio.id,
          ...payload,
        });

        if (error) {
          toast.error("Erro ao criar serviço");
          return;
        }

        toast.success("Serviço criado com sucesso!");
      }

      setDialogAberto(false);
      setEditando(null);
      setForm(FORM_DEFAULTS);
      carregarDados();
    } catch {
      toast.error("Erro ao salvar serviço");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExcluir() {
    if (!excluindo) return;

    try {
      const { error } = await supabase.from("servicos").delete().eq("id", excluindo.id);

      if (error) {
        toast.error("Erro ao excluir serviço");
        return;
      }

      toast.success("Serviço excluído com sucesso!");
      setExcluindo(null);
      carregarDados();
    } catch {
      toast.error("Erro ao excluir serviço");
    }
  }

  function abrirEdicao(servico: Servico) {
    setEditando(servico);
    setForm({
      nome: servico.nome,
      descricao: servico.descricao || "",
      categoria: servico.categoria || "",
      valor: String(servico.valor),
      data: servico.data,
      status: servico.status,
      forma_pagamento: servico.forma_pagamento || "pix",
      cliente_id: servico.cliente_id || "",
      observacoes: servico.observacoes || "",
    });
    setDialogAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_DEFAULTS);
    setDialogAberto(true);
  }

  const servicosFiltrados = servicos.filter((s) => {
    const buscaMatch =
      busca === "" ||
      s.nome.toLowerCase().includes(busca.toLowerCase()) ||
      s.cliente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.categoria?.toLowerCase().includes(busca.toLowerCase());

    const statusMatch = filtroStatus === "todos" || s.status === filtroStatus;

    return buscaMatch && statusMatch;
  });

  const totalFiltrado = servicosFiltrados.reduce((acc, s) => acc + s.valor, 0);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wrench className="h-6 w-6 text-blue-600" />
            Serviços
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus serviços realizados
          </p>
        </div>
        <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Novo Serviço
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
            placeholder="Buscar por nome, cliente ou categoria..."
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
              <SelectItem value="concluido">Concluído</SelectItem>
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
                <div className="text-2xl font-bold text-blue-600">
                  {formatarMoeda(totalFiltrado)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {servicosFiltrados.length} serviço(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatarMoeda(
                    servicosFiltrados
                      .filter((s) => s.status === "concluido")
                      .reduce((acc, s) => acc + s.valor, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {servicosFiltrados.filter((s) => s.status === "concluido").length} concluído(s)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatarMoeda(
                    servicosFiltrados
                      .filter((s) => s.status === "pendente")
                      .reduce((acc, s) => acc + s.valor, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {servicosFiltrados.filter((s) => s.status === "pendente").length} pendente(s)
                </p>
              </CardContent>
            </Card>
          </div>

          {servicosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wrench className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">Nenhum serviço encontrado</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  {busca || filtroStatus !== "todos"
                    ? "Tente ajustar os filtros de busca"
                    : "Registre seu primeiro serviço para começar"}
                </p>
                {!busca && filtroStatus === "todos" && (
                  <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar Serviço
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {servicosFiltrados.map((servico, index) => (
                          <motion.tr
                            key={servico.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.03 }}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{servico.nome}</p>
                                {servico.descricao && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {servico.descricao}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {servico.cliente?.nome || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {servico.categoria || "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">
                              {formatarMoeda(servico.valor)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Intl.DateTimeFormat("pt-BR").format(new Date(servico.data))}
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANTS[servico.status] || "outline"}>
                                <span className="mr-1 inline-flex items-center gap-0.5">
                                  {STATUS_ICONS[servico.status]}
                                </span>
                                {STATUS_LABELS[servico.status] || servico.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  onClick={() => abrirEdicao(servico)}
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11 text-destructive hover:text-destructive"
                                  onClick={() => setExcluindo(servico)}
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
                </div>

                <div className="grid gap-3 p-4 md:hidden">
                  <AnimatePresence>
                    {servicosFiltrados.map((servico, index) => (
                      <motion.div
                        key={servico.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.04 }}
                        className="rounded-lg border bg-card p-4 shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{servico.nome}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {servico.cliente?.nome || "Sem cliente"}
                            </p>
                          </div>
                          <Badge variant={STATUS_VARIANTS[servico.status] || "outline"} className="ml-2 shrink-0">
                            <span className="mr-1 inline-flex items-center gap-0.5">
                              {STATUS_ICONS[servico.status]}
                            </span>
                            {STATUS_LABELS[servico.status] || servico.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {new Intl.DateTimeFormat("pt-BR").format(new Date(servico.data))}
                          </span>
                          <span className="text-lg font-bold text-emerald-600">
                            {formatarMoeda(servico.valor)}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1 pt-1 border-t">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => abrirEdicao(servico)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-destructive hover:text-destructive"
                            onClick={() => setExcluindo(servico)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize as informações do serviço"
                : "Preencha os dados para registrar um novo serviço"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Serviço *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Instalação elétrica"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descreva o serviço realizado..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ex: Elétrica, Hidráulica, Pintura..."
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
            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={2}
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? "Salvando..." : editando ? "Salvar Alterações" : "Registrar Serviço"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço &quot;{excluindo?.nome}&quot;? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
