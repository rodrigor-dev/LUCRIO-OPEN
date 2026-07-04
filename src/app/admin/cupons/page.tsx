"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Ticket,
  Percent,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  Gift,
  Calendar,
  Users,
  Repeat,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listarCupons,
  criarCupom,
  atualizarCupom,
  excluirCupom,
  listarPlanos,
} from "@/services/admin.service";
import { formatarData } from "@/utils";
import type { Cupom, PlanoAdmin } from "@/types/admin";

interface CupomForm {
  codigo: string;
  descricao: string;
  tipo_desconto: "fixo" | "porcentagem";
  valor_desconto: number;
  plano_permitido_id: string;
  max_utilizacoes: number;
  data_inicio: string;
  data_fim: string;
  dias_gratis: number;
  meses_gratis: number;
  is_vitalicio: boolean;
  uso_unico: boolean;
  is_ativo: boolean;
  apenas_novos: boolean;
  apenas_antigos: boolean;
}

const formVazio: CupomForm = {
  codigo: "",
  descricao: "",
  tipo_desconto: "porcentagem",
  valor_desconto: 0,
  plano_permitido_id: "",
  max_utilizacoes: 0,
  data_inicio: "",
  data_fim: "",
  dias_gratis: 0,
  meses_gratis: 0,
  is_vitalicio: false,
  uso_unico: false,
  is_ativo: true,
  apenas_novos: false,
  apenas_antigos: false,
};

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function AdminCuponsPage() {
  const [cupons, setCupons] = useState<(Cupom & { plano: PlanoAdmin | null })[]>([]);
  const [planos, setPlanos] = useState<PlanoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<Cupom | null>(null);
  const [form, setForm] = useState<CupomForm>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Cupom | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [cuponsData, planosData] = await Promise.all([
        listarCupons(),
        listarPlanos(),
      ]);
      setCupons(cuponsData);
      setPlanos(planosData);
    } catch {
      toast.error("Erro ao carregar cupons");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const cuponsFiltrados = cupons.filter((c) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      c.codigo.toLowerCase().includes(termo) ||
      c.descricao?.toLowerCase().includes(termo) ||
      c.plano?.nome?.toLowerCase().includes(termo)
    );
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio);
    setDialogAberto(true);
  };

  const abrirEditar = (cupom: Cupom) => {
    setEditando(cupom);
    setForm({
      codigo: cupom.codigo,
      descricao: cupom.descricao || "",
      tipo_desconto: cupom.tipo_desconto,
      valor_desconto: cupom.valor_desconto,
      plano_permitido_id: cupom.plano_permitido_id || "",
      max_utilizacoes: cupom.max_utilizacoes || 0,
      data_inicio: cupom.data_inicio ? cupom.data_inicio.split("T")[0] : "",
      data_fim: cupom.data_fim ? cupom.data_fim.split("T")[0] : "",
      dias_gratis: cupom.dias_gratis || 0,
      meses_gratis: cupom.meses_gratis || 0,
      is_vitalicio: cupom.is_vitalicio,
      uso_unico: cupom.uso_unico,
      is_ativo: cupom.is_ativo,
      apenas_novos: cupom.apenas_novos,
      apenas_antigos: cupom.apenas_antigos,
    });
    setDialogAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.codigo.trim()) {
      toast.error("Codigo e obrigatorio");
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        ...form,
        codigo: form.codigo.toUpperCase().trim(),
        plano_permitido_id: form.plano_permitido_id || null,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || null,
        restringir_email: editando?.restringir_email || [],
        restringir_dominio: editando?.restringir_dominio || [],
        restringir_usuario_id: editando?.restringir_usuario_id || [],
        primeiro_pagamento_gratis: editando?.primeiro_pagamento_gratis || false,
      };

      if (editando) {
        await atualizarCupom(editando.id, dados);
        toast.success("Cupom atualizado com sucesso");
      } else {
        await criarCupom(dados as Omit<Cupom, "id" | "criado_em" | "atualizado_em" | "utilizacoes">);
        toast.success("Cupom criado com sucesso");
      }
      setDialogAberto(false);
      await carregarDados();
    } catch {
      toast.error("Erro ao salvar cupom");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!deleteDialog) return;
    setExcluindo(true);
    try {
      await excluirCupom(deleteDialog.id);
      toast.success("Cupom excluido com sucesso");
      setDeleteDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao excluir cupom");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cupons</h1>
          <p className="text-muted-foreground">
            Gerencie cupons de desconto e promocoes
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cupom
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border p-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ticket className="h-4 w-4" />
            Total Cupons
          </div>
          <p className="mt-1 text-2xl font-bold">{cupons.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border p-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Ativos
          </div>
          <p className="mt-1 text-2xl font-bold">
            {cupons.filter((c) => c.is_ativo).length}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border p-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Repeat className="h-4 w-4 text-blue-500" />
            Total Utilizacoes
          </div>
          <p className="mt-1 text-2xl font-bold">
            {cupons.reduce((acc, c) => acc + (c.utilizacoes || 0), 0)}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border p-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gift className="h-4 w-4 text-purple-500" />
            Com Gratis
          </div>
          <p className="mt-1 text-2xl font-bold">
            {cupons.filter((c) => c.dias_gratis > 0 || c.meses_gratis > 0).length}
          </p>
        </motion.div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por codigo ou descricao..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codigo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Utilizacoes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableSkeleton />
            ) : cuponsFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Ticket className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum cupom encontrado
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {cuponsFiltrados.map((cupom, idx) => (
                  <motion.tr
                    key={cupom.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-muted/50"
                  >
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {cupom.codigo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {cupom.tipo_desconto === "porcentagem" ? (
                          <Percent className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <DollarSign className="h-3.5 w-3.5 text-green-500" />
                        )}
                        <span className="text-sm capitalize">
                          {cupom.tipo_desconto}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {cupom.tipo_desconto === "porcentagem"
                        ? `${cupom.valor_desconto}%`
                        : `R$ ${cupom.valor_desconto.toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {cupom.utilizacoes || 0}
                        </Badge>
                        {cupom.max_utilizacoes > 0 && (
                          <span className="text-xs text-muted-foreground">
                            / {cupom.max_utilizacoes}
                          </span>
                        )}
                        {cupom.max_utilizacoes === 0 && (
                          <span className="text-xs text-muted-foreground">
                            / infinito
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cupom.is_ativo ? "default" : "secondary"}>
                        {cupom.is_ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cupom.data_fim ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatarData(cupom.data_fim)}
                        </div>
                      ) : cupom.is_vitalicio ? (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Vitalicio
                        </span>
                      ) : (
                        "Sem prazo"
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirEditar(cupom)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog(cupom)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </motion.div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize as informacoes do cupom"
                : "Preencha os dados para criar um cupom"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Codigo *</label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                  placeholder="EX: DESCONTO20"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Plano Permitido</label>
                <Select
                  value={form.plano_permitido_id}
                  onValueChange={(v) => setForm(f => ({ ...f, plano_permitido_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os planos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os planos</SelectItem>
                    {planos.map((plano) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descricao</label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descricao do cupom..."
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Desconto</label>
                <Select
                  value={form.tipo_desconto}
                  onValueChange={(v: "fixo" | "porcentagem") =>
                    setForm(f => ({ ...f, tipo_desconto: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="porcentagem">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Valor do Desconto *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_desconto || ""}
                  onChange={(e) =>
                    setForm(f => ({
                      ...f,
                      valor_desconto: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Utilizacoes</label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_utilizacoes || ""}
                  onChange={(e) =>
                    setForm(f => ({
                      ...f,
                      max_utilizacoes: parseInt(e.target.value) || 0,
                    }))
                  }
                  placeholder="0 = ilimitado"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Periodo de Validade</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Inicio</label>
                  <Input
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Fim</label>
                  <Input
                    type="date"
                    value={form.data_fim}
                    onChange={(e) => setForm(f => ({ ...f, data_fim: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Periodo Gratis</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dias Gratis</label>
                  <Input
                    type="number"
                    min="0"
                    value={form.dias_gratis || ""}
                    onChange={(e) =>
                      setForm(f => ({
                        ...f,
                        dias_gratis: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meses Gratis</label>
                  <Input
                    type="number"
                    min="0"
                    value={form.meses_gratis || ""}
                    onChange={(e) =>
                      setForm(f => ({
                        ...f,
                        meses_gratis: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Configuracoes</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Apenas Novos</label>
                    <p className="text-xs text-muted-foreground">
                      Apenas para novos usuarios
                    </p>
                  </div>
                  <Switch
                    checked={form.apenas_novos}
                    onCheckedChange={(v) => setForm(f => ({ ...f, apenas_novos: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Apenas Antigos</label>
                    <p className="text-xs text-muted-foreground">
                      Apenas para usuarios existentes
                    </p>
                  </div>
                  <Switch
                    checked={form.apenas_antigos}
                    onCheckedChange={(v) => setForm(f => ({ ...f, apenas_antigos: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Vitalicio</label>
                    <p className="text-xs text-muted-foreground">
                      Sem prazo de validade
                    </p>
                  </div>
                  <Switch
                    checked={form.is_vitalicio}
                    onCheckedChange={(v) => setForm(f => ({ ...f, is_vitalicio: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Uso Unico</label>
                    <p className="text-xs text-muted-foreground">
                      Cada usuario pode usar apenas uma vez
                    </p>
                  </div>
                  <Switch
                    checked={form.uso_unico}
                    onCheckedChange={(v) => setForm(f => ({ ...f, uso_unico: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_ativo}
                onCheckedChange={(v) => setForm(f => ({ ...f, is_ativo: v }))}
              />
              <label className="text-sm font-medium">Cupom Ativo</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editando ? (
                "Atualizar"
              ) : (
                "Criar Cupom"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Cupom</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cupom{" "}
              <strong>{deleteDialog?.codigo}</strong>? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindo}>
              {excluindo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
