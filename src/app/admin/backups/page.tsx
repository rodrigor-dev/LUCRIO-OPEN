"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Download,
  Trash2,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Calendar,
  Save,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listarBackups,
  criarBackup,
  excluirBackup,
} from "@/services/admin.service";
import { formatarDataHora } from "@/utils";
import type { Backup } from "@/types/admin";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; color: string }
> = {
  pendente: {
    label: "Pendente",
    variant: "outline",
    icon: Clock,
    color: "text-yellow-600",
  },
  em_progresso: {
    label: "Em Progresso",
    variant: "secondary",
    icon: RefreshCw,
    color: "text-blue-600",
  },
  concluido: {
    label: "Concluido",
    variant: "default",
    icon: CheckCircle2,
    color: "text-green-600",
  },
  falha: {
    label: "Falha",
    variant: "destructive",
    icon: AlertCircle,
    color: "text-red-600",
  },
};

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell className="flex gap-1"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function AdminBackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Backup | null>(null);
  const [limpando, setLimpando] = useState(false);
  const [intervalo, setIntervalo] = useState("diario");

  const carregarDados = useCallback(async () => {
    try {
      const data = await listarBackups();
      setBackups(data);
    } catch {
      toast.error("Erro ao carregar backups");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleCriarBackup = async () => {
    setCriando(true);
    try {
      await criarBackup();
      toast.success("Backup iniciado com sucesso");
      await carregarDados();
    } catch {
      toast.error("Erro ao iniciar backup");
    } finally {
      setCriando(false);
    }
  };

  const handleExcluir = async () => {
    if (!deleteDialog) return;
    setLimpando(true);
    try {
      await excluirBackup(deleteDialog.id);
      toast.success("Backup excluido com sucesso");
      setDeleteDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao excluir backup");
    } finally {
      setLimpando(false);
    }
  };

  const handleDownload = (backup: Backup) => {
    if (backup.url_download) {
      window.open(backup.url_download, "_blank");
    } else {
      toast.error("Download nao disponivel para este backup");
    }
  };

  const backupsConcluidos = backups.filter((b) => b.status === "concluido").length;
  const ultimoBackup = backups.find((b) => b.status === "concluido");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backups</h1>
          <p className="text-muted-foreground">
            Gerencie backups do sistema
          </p>
        </div>
        <Button onClick={handleCriarBackup} disabled={criando}>
          {criando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Novo Backup
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Backups</p>
                <p className="mt-1 text-2xl font-bold">{backups.length}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Database className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Concluidos</p>
                <p className="mt-1 text-2xl font-bold text-green-600">{backupsConcluidos}</p>
              </div>
              <div className="rounded-lg bg-green-100 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Ultimo Backup</p>
                <p className="mt-1 text-sm font-medium">
                  {ultimoBackup ? formatarDataHora(ultimoBackup.criado_em) : "Nenhum"}
                </p>
              </div>
              <div className="rounded-lg bg-blue-100 p-2.5">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Agendamento
          </CardTitle>
          <CardDescription>
            Configure o intervalo para backups automaticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={intervalo} onValueChange={setIntervalo}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Save className="mr-2 h-4 w-4" />
              Salvar Agendamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-24">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableSkeleton />
            ) : backups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <HardDrive className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum backup encontrado
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {backups.map((backup, idx) => {
                  const statusConfig =
                    STATUS_CONFIG[backup.status] || STATUS_CONFIG.pendente;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <motion.tr
                      key={backup.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">
                            {backup.nome}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatarTamanho(backup.tamanho_bytes)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusConfig.variant}
                          className="gap-1"
                        >
                          <StatusIcon
                            className={`h-3 w-3 ${
                              backup.status === "em_progresso"
                                ? "animate-spin"
                                : ""
                            } ${statusConfig.color}`}
                          />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {backup.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatarDataHora(backup.criado_em)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {backup.status === "concluido" && backup.url_download && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600"
                              onClick={() => handleDownload(backup)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteDialog(backup)}
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

      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Backup</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o backup{" "}
              <strong>{deleteDialog?.nome}</strong>? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={limpando}>
              {limpando ? (
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
