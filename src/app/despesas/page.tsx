"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
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
  TrendingDown,
  Pencil,
  Trash2,
  Filter,
  Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Categoria {
  id: string;
  nome: string;
  icone: string;
  cor: string;
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  forma_pagamento: string;
  categoria_id: string | null;
  observacoes: string;
  categoria?: { nome: string; icone: string; cor: string } | null;
  negocio_id: string;
  criado_em: string;
}

const FORM_DEFAULTS = {
  descricao: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  status: "pendente",
  forma_pagamento: "pix",
  categoria_id: "",
  observacoes: "",
};

const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  pix: "PIX",
  transferencia: "Transferência",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  pago: "default",
  cancelado: "destructive",
};

export default function DespesasPage() {
  const supabase = createClient();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Despesa | null>(null);
  const [excluindo, setExcluindo] = useState<Despesa | null>(null);
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

      const [despesasRes, categoriasRes] = await Promise.all([
        supabase
          .from("despesas")
          .select("*, categoria:categorias_despesas(nome, icone, cor)")
          .eq("negocio_id", negocio.id)
          .order("data", { ascending: false }),
        supabase
          .from("categorias_despesas")
          .select("id, nome, icone, cor")
          .or(`negocio_id.eq.${negocio.id},negocio_id.is.null`)
          .order("nome"),
      ]);

      if (despesasRes.error) {
        toast.error("Erro ao carregar despesas");
        return;
      }

      setDespesas(despesasRes.data || []);
      setCategorias(categoriasRes.data || []);
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
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        data: form.data,
        status: form.status,
        forma_pagamento: form.forma_pagamento,
        categoria_id: form.categoria_id && form.categoria_id !== "none" ? form.categoria_id : null,
        observacoes: form.observacoes,
      };

      if (editando) {
        const { error } = await supabase
          .from("despesas")
          .update(payload)
          .eq("id", editando.id);

        if (error) {
          toast.error("Erro ao atualizar despesa");
          return;
        }

        toast.success("Despesa atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("despesas").insert({
          negocio_id: negocio.id,
          ...payload,
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

    try {
      const { error } = await supabase.from("despesas").delete().eq("id", excluindo.id);

      if (error) {
        toast.error("Erro ao excluir despesa");
        return;
      }

      toast.success("Despesa excluída com sucesso!");
      setExcluindo(null);
      carregarDados();
    } catch {
      toast.error("Erro ao excluir despesa");
    }
  }

  function abrirEdicao(despesa: Despesa) {
    setEditando(despesa);
    setForm({
      descricao: despesa.descricao,
      valor: String(despesa.valor),
      data: despesa.data,
      status: despesa.status,
      forma_pagamento: despesa.forma_pagamento || "pix",
      categoria_id: despesa.categoria_id || "",
      observacoes: despesa.observacoes || "",
    });
    setDialogAberto(true);
  }

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_DEFAULTS);
    setDialogAberto(true);
  }

  const despesasFiltradas = despesas.filter((d) => {
    const buscaMatch =
      busca === "" ||
      d.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      d.categoria?.nome?.toLowerCase().includes(busca.toLowerCase());

    const categoriaMatch =
      filtroCategoria === "todas" || d.categoria_id === filtroCategoria;

    return buscaMatch && categoriaMatch;
  });

  const totalFiltrado = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);

  return (
    <div className="space-y-6">
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
          <p className="text-muted-foreground">
            Gerencie suas saídas financeiras
          </p>
        </div>
        <Button onClick={abrirNovo} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          Nova Despesa
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
            placeholder="Buscar por descrição ou categoria..."
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
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
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
                      .filter((d) => d.status === "pendente")
                      .reduce((acc, d) => acc + d.valor, 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {despesasFiltradas.filter((d) => d.status === "pendente").length} pendente(s)
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
                  {busca || filtroCategoria !== "todas"
                    ? "Tente ajustar os filtros de busca"
                    : "Adicione sua primeira despesa para começar"}
                </p>
                {!busca && filtroCategoria === "todas" && (
                  <Button onClick={abrirNovo} className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Despesa
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
                        <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="hidden sm:table-cell">Data</TableHead>
                        <TableHead className="hidden md:table-cell">Forma Pgto</TableHead>
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
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell>
                              <p className="font-medium">{despesa.descricao}</p>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
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
                            <TableCell className="text-right font-semibold text-red-600">
                              -{formatarMoeda(despesa.valor)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {new Intl.DateTimeFormat("pt-BR").format(new Date(despesa.data))}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {FORMAS_PAGAMENTO[despesa.forma_pagamento] || despesa.forma_pagamento}
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
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{despesa.descricao}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(despesa.data).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-red-600">
                      -{formatarMoeda(despesa.valor)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANTS[despesa.status as keyof typeof STATUS_VARIANTS]}>
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
                          {despesa.categoria.icone && <span>{despesa.categoria.icone}</span>}
                          {despesa.categoria.nome}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => abrirEdicao(despesa)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setExcluindo(despesa)}>
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
            <DialogTitle>{editando ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize as informações da despesa"
                : "Preencha os dados para adicionar uma nova despesa"}
            </DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>

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
