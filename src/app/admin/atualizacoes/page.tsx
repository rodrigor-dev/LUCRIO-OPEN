"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Zap,
  Bug,
  ShieldCheck,
  Loader2,
  Clock,
  Tag,
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listarAtualizacoes,
  criarAtualizacao,
  excluirAtualizacao,
} from "@/services/admin.service";
import { formatarDataHora } from "@/utils";
import type { Atualizacao } from "@/types/admin";

const TIPO_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  nova_funcionalidade: {
    label: "Nova Funcionalidade",
    color: "text-green-700",
    bg: "bg-green-100 border-green-200",
    icon: Sparkles,
  },
  melhoria: {
    label: "Melhoria",
    color: "text-blue-700",
    bg: "bg-blue-100 border-blue-200",
    icon: Zap,
  },
  correcao: {
    label: "Correcao",
    color: "text-yellow-700",
    bg: "bg-yellow-100 border-yellow-200",
    icon: Bug,
  },
  seguranca: {
    label: "Seguranca",
    color: "text-red-700",
    bg: "bg-red-100 border-red-200",
    icon: ShieldCheck,
  },
};

interface AtualizacaoForm {
  versao: string;
  titulo: string;
  descricao: string;
  tipo: "nova_funcionalidade" | "melhoria" | "correcao" | "seguranca";
  is_visivel: boolean;
}

const defaultForm: AtualizacaoForm = {
  versao: "",
  titulo: "",
  descricao: "",
  tipo: "nova_funcionalidade",
  is_visivel: true,
};

function TimelineSkeleton() {
  return (
    <div className="relative space-y-6 pl-8">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="relative space-y-3">
          <div className="absolute -left-5 top-1 h-4 w-4 rounded-full border-2 border-border bg-background" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function AdminAtualizacoesPage() {
  const [atualizacoes, setAtualizacoes] = useState<Atualizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AtualizacaoForm>(defaultForm);
  const [deleteDialog, setDeleteDialog] = useState<Atualizacao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = useCallback(async () => {
    try {
      const data = await listarAtualizacoes();
      setAtualizacoes(data);
    } catch {
      toast.error("Erro ao carregar atualizacoes");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleCriar = async () => {
    if (!form.versao.trim() || !form.titulo.trim()) {
      toast.error("Versao e titulo sao obrigatorios");
      return;
    }
    setSalvando(true);
    try {
      await criarAtualizacao(form);
      toast.success("Atualizacao criada com sucesso");
      setDialogOpen(false);
      setForm(defaultForm);
      await carregarDados();
    } catch {
      toast.error("Erro ao criar atualizacao");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!deleteDialog) return;
    setSalvando(true);
    try {
      await excluirAtualizacao(deleteDialog.id);
      toast.success("Atualizacao excluida com sucesso");
      setDeleteDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao excluir atualizacao");
    } finally {
      setSalvando(false);
    }
  };

  const agruparPorVersao = (items: Atualizacao[]) => {
    const grouped: Record<string, Atualizacao[]> = {};
    items.forEach((item) => {
      if (!grouped[item.versao]) grouped[item.versao] = [];
      grouped[item.versao].push(item);
    });
    return grouped;
  };

  const versoesAgrupadas = agruparPorVersao(atualizacoes);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atualizacoes</h1>
          <p className="text-muted-foreground">
            Histórico de atualizacoes e changelog do sistema
          </p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Atualizacao
        </Button>
      </div>

      {carregando ? (
        <TimelineSkeleton />
      ) : atualizacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <RefreshCw className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">Nenhuma atualizacao</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece criando a primeira atualizacao do sistema
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative space-y-8 pl-8"
        >
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

          {Object.entries(versoesAgrupadas).map(([versao, items]) => (
            <motion.div key={versao} variants={itemVariants} className="relative">
              <div className="absolute -left-5 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background">
                <Tag className="h-3 w-3 text-primary" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="text-sm px-3 py-1">
                    v{versao}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {items.length} atualizacao{items.length !== 1 ? "es" : ""}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((atualizacao) => {
                    const config =
                      TIPO_CONFIG[atualizacao.tipo] || TIPO_CONFIG.nova_funcionalidade;
                    const TipoIcon = config.icon;
                    return (
                      <motion.div
                        key={atualizacao.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className={`gap-1 ${config.bg} ${config.color} border`}
                              >
                                <TipoIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                              {!atualizacao.is_visivel && (
                                <Badge variant="secondary">Oculto</Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-foreground">
                              {atualizacao.titulo}
                            </h4>
                            {atualizacao.descricao && (
                              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                                {atualizacao.descricao}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatarDataHora(atualizacao.criado_em)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive shrink-0"
                            onClick={() => setDeleteDialog(atualizacao)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Atualizacao</DialogTitle>
            <DialogDescription>
              Registre uma nova atualizacao do sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Versao *</Label>
                <Input
                  placeholder="1.2.0"
                  value={form.versao}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, versao: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      tipo: val as AtualizacaoForm["tipo"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova_funcionalidade">
                      Nova Funcionalidade
                    </SelectItem>
                    <SelectItem value="melhoria">Melhoria</SelectItem>
                    <SelectItem value="correcao">Correcao</SelectItem>
                    <SelectItem value="seguranca">Seguranca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input
                placeholder="Titulo da atualizacao"
                value={form.titulo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titulo: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                placeholder="Detalhes da atualizacao..."
                value={form.descricao}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descricao: e.target.value }))
                }
                className="min-h-[100px]"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Visivel para usuarios</Label>
                <p className="text-xs text-muted-foreground">
                  Aparece no changelog publico
                </p>
              </div>
              <Switch
                checked={form.is_visivel}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, is_visivel: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriar} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
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
            <DialogTitle>Excluir Atualizacao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a atualizacao{" "}
              <strong>{deleteDialog?.titulo}</strong>? Esta acao nao pode ser desfeita.
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
