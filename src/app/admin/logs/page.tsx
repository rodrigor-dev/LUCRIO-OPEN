"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  RefreshCw,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertTriangle,
  Info,
  AlertCircle,
  Clock,
  Loader2,
  ToggleLeft,
  ToggleRight,
  X,
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  listarLogs,
  limparLogsAntigos,
  contarLogsPorNivel,
} from "@/services/admin.service";
import { formatarDataHora } from "@/utils";
import type { SystemLog } from "@/types/admin";

const NIVEL_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  erro: {
    label: "Erro",
    color: "text-red-700",
    bg: "bg-red-100 border-red-200",
    icon: AlertCircle,
  },
  aviso: {
    label: "Aviso",
    color: "text-yellow-700",
    bg: "bg-yellow-100 border-yellow-200",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    color: "text-blue-700",
    bg: "bg-blue-100 border-blue-200",
    icon: Info,
  },
};

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-64" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-6 w-6" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function formatarTempo(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [counts, setCounts] = useState({ erro: 0, aviso: 0, info: 0 });
  const [clearDialog, setClearDialog] = useState(false);
  const [clearDias, setClearDias] = useState("30");
  const [limpando, setLimpando] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const carregarLogs = useCallback(async () => {
    try {
      const data = await listarLogs({ nivel: filtroNivel !== "todos" ? filtroNivel : undefined, limit: 500 });
      setLogs(data);
      const c = await contarLogsPorNivel();
      setCounts(c);
    } catch {
      toast.error("Erro ao carregar logs");
    } finally {
      setCarregando(false);
    }
  }, [filtroNivel]);

  useEffect(() => {
    carregarLogs();
  }, [carregarLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(carregarLogs, 10000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, carregarLogs]);

  const logsFiltrados = logs.filter((log) => {
    const matchBusca = !busca || log.mensagem.toLowerCase().includes(busca.toLowerCase());
    const logDate = new Date(log.criado_em);
    const matchInicio = !dataInicio || logDate >= new Date(dataInicio);
    const matchFim = !dataFim || logDate <= new Date(dataFim + "T23:59:59");
    return matchBusca && matchInicio && matchFim;
  });

  const handleClearLogs = async () => {
    setLimpando(true);
    try {
      await limparLogsAntigos(Number(clearDias));
      toast.success(`Logs com mais de ${clearDias} dias excluidos`);
      setClearDialog(false);
      await carregarLogs();
    } catch {
      toast.error("Erro ao limpar logs");
    } finally {
      setLimpando(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Nivel", "Mensagem", "Usuario", "Rota", "Status Code", "Tempo (ms)", "Data"];
    const rows = logsFiltrados.map((log) => [
      log.nivel,
      `"${log.mensagem.replace(/"/g, '""')}"`,
      log.usuario_email || "-",
      log.rota || "-",
      log.status_code?.toString() || "-",
      log.tempo_resposta_ms?.toString() || "-",
      formatarDataHora(log.criado_em),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
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
          <h1 className="text-2xl font-bold tracking-tight">Logs do Sistema</h1>
          <p className="text-muted-foreground">Visualize e gerencie os logs do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <ToggleRight className="mr-2 h-4 w-4" />
            ) : (
              <ToggleLeft className="mr-2 h-4 w-4" />
            )}
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setClearDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Antigos
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="destructive" className="gap-1 px-3 py-1">
          <AlertCircle className="h-3 w-3" />
          Erros: {counts.erro}
        </Badge>
        <Badge variant="outline" className="gap-1 border-yellow-300 bg-yellow-50 px-3 py-1 text-yellow-700">
          <AlertTriangle className="h-3 w-3" />
          Avisos: {counts.aviso}
        </Badge>
        <Badge variant="outline" className="gap-1 border-blue-300 bg-blue-50 px-3 py-1 text-blue-700">
          <Info className="h-3 w-3" />
          Info: {counts.info}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar na mensagem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroNivel} onValueChange={setFiltroNivel}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Nivel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
            <SelectItem value="aviso">Aviso</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="w-[160px]"
          placeholder="Data inicio"
        />
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="w-[160px]"
          placeholder="Data fim"
        />
        {(busca || dataInicio || dataFim || filtroNivel !== "todos") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBusca("");
              setDataInicio("");
              setDataFim("");
              setFiltroNivel("todos");
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-x-auto rounded-lg border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nivel</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableSkeleton />
            ) : logsFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhum log encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {logsFiltrados.map((log, idx) => {
                  const config = NIVEL_CONFIG[log.nivel] || NIVEL_CONFIG.info;
                  const isExpanded = expandedRow === log.id;
                  return (
                    <motion.tr
                      key={log.id}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      transition={{ delay: idx * 0.02 }}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 ${config.bg} ${config.color} border`}
                        >
                          <config.icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-medium">
                        {log.mensagem}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.usuario_email || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.metodo_http && (
                          <Badge variant="secondary" className="mr-1 text-[10px]">
                            {log.metodo_http}
                          </Badge>
                        )}
                        <span className="truncate max-w-[120px] inline-block">
                          {log.rota || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.status_code ? (
                          <Badge
                            variant={log.status_code >= 500 ? "destructive" : log.status_code >= 400 ? "outline" : "secondary"}
                          >
                            {log.status_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatarTempo(log.tempo_resposta_ms)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {formatarDataHora(log.criado_em)}
                      </TableCell>
                      <TableCell>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </motion.div>

      <AnimatePresence>
        {expandedRow && (
          logsFiltrados
            .filter((l) => l.id === expandedRow)
            .map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-lg border bg-muted/30"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Detalhes do Log</h4>
                    <Button variant="ghost" size="sm" onClick={() => setExpandedRow(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">Mensagem Completa</p>
                      <p className="mt-1 text-sm">{log.mensagem}</p>
                    </div>
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">IP Address</p>
                      <p className="mt-1 text-sm font-mono">{log.ip_address || "-"}</p>
                    </div>
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">User Agent</p>
                      <p className="mt-1 text-sm truncate" title={log.user_agent || ""}>
                        {log.user_agent || "-"}
                      </p>
                    </div>
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">Rota</p>
                      <p className="mt-1 text-sm font-mono">
                        {log.metodo_http} {log.rota || "-"}
                      </p>
                    </div>
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">Status Code</p>
                      <p className="mt-1 text-sm">{log.status_code || "-"}</p>
                    </div>
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">Tempo Resposta</p>
                      <p className="mt-1 text-sm">{formatarTempo(log.tempo_resposta_ms)}</p>
                    </div>
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">Usuario</p>
                      <p className="mt-1 text-sm">{log.usuario_email || "-"}</p>
                    </div>
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground">Data/Hora</p>
                      <p className="mt-1 text-sm">{formatarDataHora(log.criado_em)}</p>
                    </div>
                  </div>
                  {log.stack_trace && (
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Stack Trace</p>
                      <pre className="text-xs text-red-600 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                        {log.stack_trace}
                      </pre>
                    </div>
                  )}
                  {log.detalhes && Object.keys(log.detalhes).length > 0 && (
                    <div className="rounded-md bg-background p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Detalhes Extras</p>
                      <pre className="text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                        {JSON.stringify(log.detalhes, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
        )}
      </AnimatePresence>

      {!carregando && logsFiltrados.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Exibindo {logsFiltrados.length} de {logs.length} logs
        </p>
      )}

      <Dialog open={clearDialog} onOpenChange={setClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar Logs Antigos</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir logs antigos? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Excluir logs com mais de:</label>
            <Select value={clearDias} onValueChange={setClearDias}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleClearLogs} disabled={limpando}>
              {limpando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
