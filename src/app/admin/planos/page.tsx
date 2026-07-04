"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Palette,
  Star,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listarPlanos,
  criarPlano,
  atualizarPlano,
  excluirPlano,
} from "@/services/admin.service";
import { formatarMoeda } from "@/utils";
import type { PlanoAdmin } from "@/types/admin";

const PRESET_CORES = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

interface PlanoForm {
  nome: string;
  slug: string;
  descricao: string;
  preco_mensal: number;
  preco_anual: number;
  limite_clientes: number;
  limite_receitas: number;
  limite_despesas: number;
  funcionalidades: string;
  cor: string;
  is_ativo: boolean;
  is_destaque: boolean;
}

const formVazio: PlanoForm = {
  nome: "",
  slug: "",
  descricao: "",
  preco_mensal: 0,
  preco_anual: 0,
  limite_clientes: 0,
  limite_receitas: 0,
  limite_despesas: 0,
  funcionalidades: "",
  cor: "#6366f1",
  is_ativo: true,
  is_destaque: false,
};

function PlanCardSkeleton() {
  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-9" />
      </div>
    </div>
  );
}

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<PlanoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<PlanoAdmin | null>(null);
  const [form, setForm] = useState<PlanoForm>(formVazio);
  const [salvando, setSalvando] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<PlanoAdmin | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarPlanos = async () => {
    setCarregando(true);
    try {
      const data = await listarPlanos();
      setPlanos(data);
    } catch {
      toast.error("Erro ao carregar planos");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarPlanos();
  }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio);
    setDialogAberto(true);
  };

  const abrirEditar = (plano: PlanoAdmin) => {
    setEditando(plano);
    setForm({
      nome: plano.nome,
      slug: plano.slug,
      descricao: plano.descricao || "",
      preco_mensal: plano.preco_mensal,
      preco_anual: plano.preco_anual,
      limite_clientes: plano.limite_clientes,
      limite_receitas: plano.limite_receitas,
      limite_despesas: plano.limite_despesas,
      funcionalidades: Array.isArray(plano.funcionalidades)
        ? plano.funcionalidades.join("\n")
        : "",
      cor: plano.cor || "#6366f1",
      is_ativo: plano.is_ativo,
      is_destaque: plano.is_destaque,
    });
    setDialogAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }
    setSalvando(true);
    try {
      const funcionalidades = form.funcionalidades
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      const dados = {
        ...form,
        slug: form.slug || form.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"),
        funcionalidades,
        ordem: editando?.ordem ?? planos.length,
        limite_armazenamento_mb: editando?.limite_armazenamento_mb ?? 500,
        limite_usuarios: editando?.limite_usuarios ?? 1,
      };

      if (editando) {
        await atualizarPlano(editando.id, dados);
        toast.success("Plano atualizado com sucesso");
      } else {
        await criarPlano(dados);
        toast.success("Plano criado com sucesso");
      }
      setDialogAberto(false);
      await carregarPlanos();
    } catch {
      toast.error("Erro ao salvar plano");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!deleteDialog) return;
    setExcluindo(true);
    try {
      await excluirPlano(deleteDialog.id);
      toast.success("Plano excluido com sucesso");
      setDeleteDialog(null);
      await carregarPlanos();
    } catch {
      toast.error("Erro ao excluir plano");
    } finally {
      setExcluindo(false);
    }
  };

  const moverPlano = async (plano: PlanoAdmin, direcao: "up" | "down") => {
    const idx = planos.findIndex((p) => p.id === plano.id);
    if (idx === -1) return;
    const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
    if (novoIdx < 0 || novoIdx >= planos.length) return;

    const novosPlanos = [...planos];
    [novosPlanos[idx], novosPlanos[novoIdx]] = [novosPlanos[novoIdx], novosPlanos[idx]];

    try {
      await Promise.all(
        novosPlanos.map((p, i) => atualizarPlano(p.id, { ordem: i }))
      );
      setPlanos(novosPlanos.map((p, i) => ({ ...p, ordem: i })));
    } catch {
      toast.error("Erro ao reordenar planos");
      await carregarPlanos();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
          <p className="text-muted-foreground">
            Gerencie os planos de assinatura
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      {carregando ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PlanCardSkeleton key={i} />
          ))}
        </div>
      ) : planos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16"
        >
          <Star className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium">Nenhum plano criado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie o primeiro plano de assinatura
          </p>
          <Button onClick={abrirNovo} className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Criar Plano
          </Button>
        </motion.div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {planos.map((plano, idx) => (
              <motion.div
                key={plano.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className="relative rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md"
              >
                {plano.is_destaque && (
                  <div
                    className="absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-lg"
                    style={{ backgroundColor: plano.cor || "#6366f1" }}
                  >
                    DESTAQUE
                  </div>
                )}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: plano.cor || "#6366f1" }}
                      />
                      <h3 className="text-lg font-bold">{plano.nome}</h3>
                    </div>
                    <Badge variant={plano.is_ativo ? "default" : "secondary"}>
                      {plano.is_ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {formatarMoeda(plano.preco_mensal)}
                    </span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatarMoeda(plano.preco_anual)}/ano (economize{" "}
                    {plano.preco_mensal > 0
                      ? Math.round(
                          ((plano.preco_mensal * 12 - plano.preco_anual) /
                            (plano.preco_mensal * 12)) *
                            100
                        )
                      : 0}
                    %)
                  </p>

                  {plano.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {plano.descricao}
                    </p>
                  )}

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clientes</span>
                      <span className="font-medium">{plano.limite_clientes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receitas</span>
                      <span className="font-medium">{plano.limite_receitas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Despesas</span>
                      <span className="font-medium">{plano.limite_despesas}</span>
                    </div>
                  </div>

                  {plano.funcionalidades && plano.funcionalidades.length > 0 && (
                    <>
                      <Separator />
                      <ul className="space-y-1.5">
                        {(plano.funcionalidades as string[]).slice(0, 5).map(
                          (func, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                              <span>{func}</span>
                            </li>
                          )
                        )}
                        {(plano.funcionalidades as string[]).length > 5 && (
                          <li className="text-xs text-muted-foreground">
                            +{(plano.funcionalidades as string[]).length - 5} mais
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>

                <div className="border-t bg-muted/30 px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === 0}
                      onClick={() => moverPlano(plano, "up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === planos.length - 1}
                      onClick={() => moverPlano(plano, "down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => abrirEditar(plano)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog(plano)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar Plano" : "Novo Plano"}
            </DialogTitle>
            <DialogDescription>
              {editando
                ? "Atualize as informacoes do plano"
                : "Preencha os dados para criar um novo plano"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Profissional"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="gerado-automaticamente"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descricao</label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descricao curta do plano..."
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preco Mensal (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.preco_mensal || ""}
                  onChange={(e) =>
                    setForm(f => ({ ...f, preco_mensal: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Preco Anual (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.preco_anual || ""}
                  onChange={(e) =>
                    setForm(f => ({ ...f, preco_anual: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Limite Clientes</label>
                <Input
                  type="number"
                  min="0"
                  value={form.limite_clientes || ""}
                  onChange={(e) =>
                    setForm(f => ({ ...f, limite_clientes: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Limite Receitas</label>
                <Input
                  type="number"
                  min="0"
                  value={form.limite_receitas || ""}
                  onChange={(e) =>
                    setForm(f => ({ ...f, limite_receitas: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Limite Despesas</label>
                <Input
                  type="number"
                  min="0"
                  value={form.limite_despesas || ""}
                  onChange={(e) =>
                    setForm(f => ({ ...f, limite_despesas: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Funcionalidades (1 por linha)
              </label>
              <Textarea
                value={form.funcionalidades}
                onChange={(e) =>
                  setForm(f => ({ ...f, funcionalidades: e.target.value }))
                }
                placeholder="Relatorios avancados&#10;Suporte prioritario&#10;API access"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Cor do Plano
              </label>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  {PRESET_CORES.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        form.cor === cor ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: cor }}
                      onClick={() => setForm(f => ({ ...f, cor }))}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={form.cor}
                  onChange={(e) => setForm(f => ({ ...f, cor: e.target.value }))}
                  className="h-7 w-10 cursor-pointer p-0"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_ativo}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_ativo: v }))}
                />
                <label className="text-sm font-medium">Ativo</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_destaque}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_destaque: v }))}
                />
                <label className="text-sm font-medium">Destaque</label>
              </div>
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
                "Criar Plano"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Plano</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o plano{" "}
              <strong>{deleteDialog?.nome}</strong>? Usuarios com este plano
              podem ser afetados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleExcluir}
              disabled={excluindo}
            >
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
