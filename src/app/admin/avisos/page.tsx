"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Send,
  X,
  Loader2,
  Info,
  AlertTriangle,
  Wrench,
  RefreshCw,
  Bell,
  Mail,
  Monitor,
  Globe,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { motion } from "framer-motion";
import { formatarDataHora } from "@/utils";
import {
  listarAvisos,
  criarAviso,
  atualizarAviso,
  excluirAviso,
} from "@/services/admin.service";
import type { AvisoGlobal } from "@/types/admin";

const TIPO_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  info: {
    label: "Info",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Info,
  },
  aviso: {
    label: "Aviso",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertTriangle,
  },
  manutencao: {
    label: "Manutencao",
    className: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Wrench,
  },
  atualizacao: {
    label: "Atualizacao",
    className: "bg-purple-100 text-purple-700 border-purple-200",
    icon: RefreshCw,
  },
};

const DESTINATARIO_CONFIG: Record<string, string> = {
  todos: "Todos os usuarios",
  plano: "Por plano",
  usuario: "Usuarios especificos",
  novos: "Novos usuarios",
  inativos: "Usuarios inativos",
};

const CANAL_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  push: { label: "Push", icon: Bell },
  email: { label: "Email", icon: Mail },
  interno: { label: "Interno", icon: Monitor },
  todos: { label: "Todos", icon: Globe },
};

interface AvisoForm {
  titulo: string;
  mensagem: string;
  tipo: "info" | "aviso" | "manutencao" | "atualizacao";
  destinatario: "todos" | "plano" | "usuario" | "novos" | "inativos";
  canal: "push" | "email" | "interno" | "todos";
  is_ativo: boolean;
  data_inicio: string;
  data_fim: string;
}

const AVISO_VAZIO: AvisoForm = {
  titulo: "",
  mensagem: "",
  tipo: "info",
  destinatario: "todos",
  canal: "todos",
  is_ativo: true,
  data_inicio: "",
  data_fim: "",
};

export default function AdminAvisosPage() {
  const [avisos, setAvisos] = useState<AvisoGlobal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogPreview, setDialogPreview] = useState(false);
  const [dialogDelete, setDialogDelete] = useState(false);
  const [avisoSel, setAvisoSel] = useState<AvisoGlobal | null>(null);
  const [form, setForm] = useState<AvisoForm>(AVISO_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const data = await listarAvisos();
      setAvisos(data);
    } catch {
      console.error("Erro ao carregar avisos");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setAvisoSel(null);
    setForm(AVISO_VAZIO);
    setDialogAberto(true);
  };

  const abrirEditar = (aviso: AvisoGlobal) => {
    setAvisoSel(aviso);
    setForm({
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      tipo: aviso.tipo,
      destinatario: aviso.destinatario,
      canal: aviso.canal,
      is_ativo: aviso.is_ativo,
      data_inicio: aviso.data_inicio?.split("T")[0] || "",
      data_fim: aviso.data_fim?.split("T")[0] || "",
    });
    setDialogAberto(true);
  };

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      const dados = {
        ...form,
        data_inicio: form.data_inicio
          ? new Date(form.data_inicio).toISOString()
          : null,
        data_fim: form.data_fim
          ? new Date(form.data_fim).toISOString()
          : null,
        destinatario_ids: [],
      };

      if (avisoSel) {
        await atualizarAviso(avisoSel.id, dados);
      } else {
        await criarAviso(dados);
      }

      setDialogAberto(false);
      await carregar();
    } catch {
      console.error("Erro ao salvar aviso");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!avisoSel) return;
    try {
      await excluirAviso(avisoSel.id);
      setDialogDelete(false);
      setAvisoSel(null);
      await carregar();
    } catch {
      console.error("Erro ao excluir aviso");
    }
  };

  const handleToggleAtivo = async (aviso: AvisoGlobal) => {
    try {
      await atualizarAviso(aviso.id, { is_ativo: !aviso.is_ativo });
      await carregar();
    } catch {
      console.error("Erro ao alterar status");
    }
  };

  const tipoConf = (tipo: string) =>
    TIPO_CONFIG[tipo] || TIPO_CONFIG.info;
  const canalConf = (canal: string) =>
    CANAL_CONFIG[canal] || CANAL_CONFIG.todos;

  if (carregando) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avisos</h1>
          <p className="text-muted-foreground">
            Gerencie avisos e comunicados globais do sistema
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Aviso
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Avisos Globais</CardTitle>
                <CardDescription>
                  {avisos.length} aviso(s) cadastrado(s)
                </CardDescription>
              </div>
              <Badge variant="secondary">{avisos.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {avisos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhum aviso cadastrado
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={abrirNovo}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Criar primeiro aviso
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titulo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Destinatario</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {avisos.map((aviso) => {
                      const tc = tipoConf(aviso.tipo);
                      const cc = canalConf(aviso.canal);
                      const TIcon = tc.icon;
                      const CIcon = cc.icon;

                      return (
                        <TableRow key={aviso.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{aviso.titulo}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {aviso.mensagem}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={tc.className}
                            >
                              <TIcon className="mr-1 h-3 w-3" />
                              {tc.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {DESTINATARIO_CONFIG[aviso.destinatario] ||
                              aviso.destinatario}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <CIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              {cc.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={aviso.is_ativo}
                              onCheckedChange={() => handleToggleAtivo(aviso)}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatarDataHora(aviso.criado_em)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setAvisoSel(aviso); setDialogPreview(true); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => abrirEditar(aviso)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setAvisoSel(aviso);
                                  setDialogDelete(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {avisoSel ? "Editar Aviso" : "Novo Aviso"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do aviso para envio
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input
                placeholder="Titulo do aviso"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                placeholder="Conteudo do aviso..."
                value={form.mensagem}
                onChange={(e) =>
                  setForm({ ...form, mensagem: e.target.value })
                }
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      tipo: v as AvisoForm["tipo"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_CONFIG).map(([key, conf]) => (
                      <SelectItem key={key} value={key}>
                        {conf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Destinatario</Label>
                <Select
                  value={form.destinatario}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      destinatario: v as AvisoForm["destinatario"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DESTINATARIO_CONFIG).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Canal de Envio</Label>
              <Select
                value={form.canal}
                onValueChange={(v) =>
                  setForm({ ...form, canal: v as AvisoForm["canal"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CANAL_CONFIG).map(([key, conf]) => (
                    <SelectItem key={key} value={key}>
                      {conf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Inicio (opcional)</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) =>
                    setForm({ ...form, data_inicio: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim (opcional)</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) =>
                    setForm({ ...form, data_fim: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_ativo}
                onCheckedChange={(v) => setForm({ ...form, is_ativo: v })}
              />
              <Label>Ativo imediatamente</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogAberto(false);
                setDialogPreview(true);
              }}
              disabled={!form.titulo || !form.mensagem}
            >
              <Eye className="mr-2 h-4 w-4" />
              Visualizar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={!form.titulo || !form.mensagem || salvando}
            >
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {avisoSel ? "Salvar Alteracoes" : "Criar Aviso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogPreview} onOpenChange={setDialogPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview do Aviso</DialogTitle>
            <DialogDescription>
              Assim o aviso aparecera para os usuarios
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 rounded-full p-2 ${
                  form.tipo === "info"
                    ? "bg-blue-100"
                    : form.tipo === "aviso"
                      ? "bg-amber-100"
                      : form.tipo === "manutencao"
                        ? "bg-orange-100"
                        : "bg-purple-100"
                }`}
              >
                {(() => {
                  const Icon = tipoConf(form.tipo).icon;
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base">
                  {form.titulo || "Titulo do aviso"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                  {form.mensagem || "Conteudo do aviso..."}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className={tipoConf(form.tipo).className}>
                    {tipoConf(form.tipo).label}
                  </Badge>
                  <span>&bull;</span>
                  <span>{DESTINATARIO_CONFIG[form.destinatario]}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPreview(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setDialogPreview(false);
                setDialogAberto(true);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialogDelete} onOpenChange={setDialogDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o aviso &quot;{avisoSel?.titulo}
              &quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
