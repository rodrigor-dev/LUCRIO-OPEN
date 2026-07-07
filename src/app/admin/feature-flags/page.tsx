"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Users,
  FlaskConical,
  CreditCard,
  UserCheck,
  Loader2,
  Search,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  listarFeatureFlags,
  criarFeatureFlag,
  atualizarFeatureFlag,
  excluirFeatureFlag,
} from "@/services/admin.service";
import { formatarDataHora } from "@/utils";
import type { FeatureFlag } from "@/types/admin";

const DESTINATARIO_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  todos: { label: "Todos", icon: Users, color: "text-gray-600" },
  admin: { label: "Admin", icon: Shield, color: "text-red-600" },
  teste: { label: "Teste", icon: FlaskConical, color: "text-purple-600" },
  plano: { label: "Plano", icon: CreditCard, color: "text-blue-600" },
  usuario: { label: "Usuario", icon: UserCheck, color: "text-green-600" },
};

interface FlagForm {
  chave: string;
  descricao: string;
  is_ativo: boolean;
  destinatario: "todos" | "admin" | "teste" | "plano" | "usuario";
  destinatario_ids: string[];
}

const defaultForm: FlagForm = {
  chave: "",
  descricao: "",
  is_ativo: false,
  destinatario: "todos",
  destinatario_ids: [],
};

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-6 w-14 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="flex gap-1"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FlagForm>(defaultForm);
  const [deleteDialog, setDeleteDialog] = useState<FeatureFlag | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [idsInput, setIdsInput] = useState("");

  const carregarDados = useCallback(async () => {
    try {
      const data = await listarFeatureFlags();
      setFlags(data);
    } catch {
      toast.error("Erro ao carregar feature flags");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const flagsFiltradas = flags.filter(
    (f) =>
      f.chave.toLowerCase().includes(busca.toLowerCase()) ||
      (f.descricao && f.descricao.toLowerCase().includes(busca.toLowerCase()))
  );

  const openNovo = () => {
    setEditId(null);
    setForm(defaultForm);
    setIdsInput("");
    setDialogOpen(true);
  };

  const openEditar = (flag: FeatureFlag) => {
    setEditId(flag.id);
    setForm({
      chave: flag.chave,
      descricao: flag.descricao || "",
      is_ativo: flag.is_ativo,
      destinatario: flag.destinatario,
      destinatario_ids: flag.destinatario_ids || [],
    });
    setIdsInput((flag.destinatario_ids || []).join(", "));
    setDialogOpen(true);
  };

  const handleSalvar = async () => {
    if (!form.chave.trim()) {
      toast.error("Chave e obrigatoria");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(form.chave)) {
      toast.error("Chave deve ser slug (letras minusculas, numeros, hifen, underscore)");
      return;
    }

    setSalvando(true);
    try {
      const ids = idsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (editId) {
        await atualizarFeatureFlag(editId, {
          ...form,
          destinatario_ids: ids,
        });
        toast.success("Feature flag atualizada com sucesso");
      } else {
        await criarFeatureFlag({
          ...form,
          destinatario_ids: ids,
        });
        toast.success("Feature flag criada com sucesso");
      }
      setDialogOpen(false);
      await carregarDados();
    } catch {
      toast.error(editId ? "Erro ao atualizar feature flag" : "Erro ao criar feature flag");
    } finally {
      setSalvando(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      await atualizarFeatureFlag(flag.id, { is_ativo: !flag.is_ativo });
      toast.success(`Feature flag ${flag.is_ativo ? "desativada" : "ativada"}`);
      await carregarDados();
    } catch {
      toast.error("Erro ao alterar status da feature flag");
    }
  };

  const handleExcluir = async () => {
    if (!deleteDialog) return;
    setSalvando(true);
    try {
      await excluirFeatureFlag(deleteDialog.id);
      toast.success("Feature flag excluida com sucesso");
      setDeleteDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao excluir feature flag");
    } finally {
      setSalvando(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
          <p className="text-muted-foreground">
            Gerencie funcionalidades do sistema por.FLAG
          </p>
        </div>
        <Button onClick={openNovo}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Feature Flag
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por chave ou descricao..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-x-auto rounded-lg border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-24">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableSkeleton />
            ) : flagsFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ToggleLeft className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma feature flag encontrada
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {flagsFiltradas.map((flag, idx) => {
                  const dest = DESTINATARIO_CONFIG[flag.destinatario] || DESTINATARIO_CONFIG.todos;
                  const DestIcon = dest.icon;
                  return (
                    <motion.tr
                      key={flag.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              flag.is_ativo ? "bg-green-500" : "bg-gray-300"
                            }`}
                          />
                          <code className="text-sm font-mono font-medium">
                            {flag.chave}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {flag.descricao || "-"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={flag.is_ativo}
                          onCheckedChange={() => handleToggle(flag)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <DestIcon className={`h-3 w-3 ${dest.color}`} />
                          {dest.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatarDataHora(flag.criado_em)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditar(flag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteDialog(flag)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </motion.div>

      {!carregando && (
        <p className="text-sm text-muted-foreground text-center">
          {flagsFiltradas.length} feature flag{flagsFiltradas.length !== 1 ? "s" : ""} encontrada{flagsFiltradas.length !== 1 ? "s" : ""}
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar Feature Flag" : "Nova Feature Flag"}
            </DialogTitle>
            <DialogDescription>
              {editId
                ? "Atualize as informacoes da feature flag"
                : "Crie uma nova feature flag para controlar funcionalidades"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Chave *</Label>
              <Input
                placeholder="ex: nova_tela_dashboard"
                value={form.chave}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chave: e.target.value.toLowerCase() }))
                }
                disabled={!!editId}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Slug: apenas minusculas, numeros, hifen e underscore
              </p>
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Input
                placeholder="Descricao opcional da feature flag"
                value={form.descricao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descricao: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Ativar ou desativar esta feature
                </p>
              </div>
              <Switch
                checked={form.is_ativo}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_ativo: checked }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Destinatario</Label>
              <Select
                value={form.destinatario}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    destinatario: val as FlagForm["destinatario"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teste">Teste</SelectItem>
                  <SelectItem value="plano">Plano</SelectItem>
                  <SelectItem value="usuario">Usuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.destinatario === "plano" || form.destinatario === "usuario") && (
              <div className="space-y-2">
                <Label>
                  IDs do Destinatario{" "}
                  {form.destinatario === "plano" ? "(Planos)" : "(Usuarios)"}
                </Label>
                <Input
                  placeholder="UUID1, UUID2, UUID3..."
                  value={idsInput}
                  onChange={(e) => setIdsInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Separados por virgula. Deixe vazio para aplicar a todos.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : editId ? (
                "Atualizar"
              ) : (
                "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Feature Flag</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a feature flag{" "}
              <strong>{deleteDialog?.chave}</strong>? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={salvando}>
              {salvando ? (
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
