"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ScrollText,
  Search,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
  User,
  Activity,
  Calendar,
  Globe,
  ArrowRight,
  X,
  Loader2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { motion } from "framer-motion";
import { formatarDataHora } from "@/utils";
import { listarAuditoria } from "@/services/admin.service";
import type { Auditoria } from "@/types/admin";

const ACAO_CORES: Record<string, string> = {
  login: "bg-emerald-100 text-emerald-700",
  criou: "bg-blue-100 text-blue-700",
  criado: "bg-blue-100 text-blue-700",
  atualizou: "bg-amber-100 text-amber-700",
  atualizado: "bg-amber-100 text-amber-700",
  editou: "bg-amber-100 text-amber-700",
  excluiu: "bg-rose-100 text-rose-700",
  deletou: "bg-rose-100 text-rose-700",
  config: "bg-violet-100 text-violet-700",
};

function getAcaoColor(acao: string) {
  const lower = acao.toLowerCase();
  for (const [key, color] of Object.entries(ACAO_CORES)) {
    if (lower.includes(key)) return color;
  }
  return "bg-gray-100 text-gray-700";
}

function DiffView({
  antes,
  depois,
}: {
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}) {
  const chaves = new Set([
    ...Object.keys(antes || {}),
    ...Object.keys(depois || {}),
  ]);

  if (chaves.size === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Nenhum dado detalhado disponivel
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs font-mono">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
        <span>Campo</span>
        <span>Antes</span>
        <span>Depois</span>
      </div>
      {Array.from(chaves).map((chave) => {
        const valAntes = antes?.[chave];
        const valDepois = depois?.[chave];
        const mudou =
          JSON.stringify(valAntes) !== JSON.stringify(valDepois);

        return (
          <div
            key={chave}
            className={`grid grid-cols-[1fr_1fr_1fr] gap-2 py-1 border-t border-border/50 ${
              mudou ? "bg-amber-50/50" : ""
            }`}
          >
            <span className="font-medium text-foreground truncate">
              {chave}
            </span>
            <span
              className={`truncate ${
                mudou ? "text-rose-600 line-through" : "text-muted-foreground"
              }`}
            >
              {valAntes !== undefined && valAntes !== null
                ? typeof valAntes === "object"
                  ? JSON.stringify(valAntes)
                  : String(valAntes)
                : "-"}
            </span>
            <span
              className={`truncate ${
                mudou ? "text-emerald-600 font-medium" : "text-muted-foreground"
              }`}
            >
              {valDepois !== undefined && valDepois !== null
                ? typeof valDepois === "object"
                  ? JSON.stringify(valDepois)
                  : String(valDepois)
                : "-"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [filtroEntidade, setFiltroEntidade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const filtros: Parameters<typeof listarAuditoria>[0] = {};
      if (filtroAcao) filtros.acao = filtroAcao;
      const data = await listarAuditoria(filtros);
      setLogs(data);
    } catch {
      console.error("Erro ao carregar auditoria");
    } finally {
      setCarregando(false);
    }
  }, [filtroAcao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (autoRefresh) {
      intervaloRef.current = setInterval(carregar, 30000);
    } else if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
    }
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, [autoRefresh, carregar]);

  const toggleExpandir = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const logsFiltrados = logs.filter((log) => {
    const matchBusca =
      !busca ||
      log.acao.toLowerCase().includes(busca.toLowerCase()) ||
      log.usuario_email?.toLowerCase().includes(busca.toLowerCase()) ||
      log.entidade?.toLowerCase().includes(busca.toLowerCase());

    const matchEntidade =
      !filtroEntidade || log.entidade === filtroEntidade;

    let matchData = true;
    if (dataInicio) {
      matchData = matchData && log.criado_em >= dataInicio;
    }
    if (dataFim) {
      matchData = matchData && log.criado_em <= dataFim + "T23:59:59";
    }

    return matchBusca && matchEntidade && matchData;
  });

  const entidadesUnicas = Array.from(new Set(logs.map((l) => l.entidade).filter(Boolean)));

  const handleExportar = () => {
    const csv = [
      ["Data", "Usuario", "Acao", "Entidade", "IP", "Detalhes"].join(","),
      ...logsFiltrados.map((log) =>
        [
          log.criado_em,
          log.usuario_email || "N/A",
          log.acao,
          log.entidade || "N/A",
          log.ip_address || "N/A",
          log.dados_depois ? JSON.stringify(log.dados_depois).replace(/,/g, ";") : "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (carregando && logs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[500px] w-full" />
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
          <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-muted-foreground">
            Registro de todas as acoes realizadas no sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              Auto-refresh
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Filtros</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={filtroAcao}
                onValueChange={setFiltroAcao}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de acao" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="criou">Criou</SelectItem>
                  <SelectItem value="atualizou">Atualizou</SelectItem>
                  <SelectItem value="excluiu">Excluiu</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filtroEntidade}
                onValueChange={setFiltroEntidade}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {entidadesUnicas.map((e) => (
                    <SelectItem key={e!} value={e!}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                placeholder="Data inicio"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
              <Input
                type="date"
                placeholder="Data fim"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            {(busca || filtroAcao || filtroEntidade || dataInicio || dataFim) && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setBusca("");
                  setFiltroAcao("");
                  setFiltroEntidade("");
                  setDataInicio("");
                  setDataFim("");
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Registro de Auditoria
                </CardTitle>
                <CardDescription>
                  {logsFiltrados.length} registro(s) encontrado(s)
                </CardDescription>
              </div>
              {autoRefresh && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Atualizando...
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {logsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ScrollText className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhum registro encontrado
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {logsFiltrados.map((log) => {
                  const expandido = expandidos.has(log.id);
                  const temDados = log.dados_antes || log.dados_depois;

                  return (
                    <div key={log.id}>
                      <div
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                          expandido ? "bg-muted/30" : ""
                        }`}
                        onClick={() => temDados && toggleExpandir(log.id)}
                      >
                        {temDados ? (
                          expandido ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )
                        ) : (
                          <div className="w-4 shrink-0" />
                        )}

                        <div className="shrink-0 rounded-full bg-muted p-2">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`${getAcaoColor(log.acao)} text-[10px]`}
                            >
                              {log.acao}
                            </Badge>
                            {log.entidade && (
                              <span className="text-xs text-muted-foreground">
                                {log.entidade}
                                {log.entidade_id && (
                                  <span className="text-muted-foreground/50">
                                    {" "}
                                    #{log.entidade_id.slice(0, 8)}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[200px]">
                              {log.usuario_email || "Sistema"}
                            </span>
                            {log.ip_address && (
                              <>
                                <span className="text-muted-foreground/30">
                                  &bull;
                                </span>
                                <Globe className="h-3 w-3" />
                                <span>{log.ip_address}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-[11px] text-muted-foreground">
                            {formatarDataHora(log.criado_em)}
                          </p>
                        </div>
                      </div>

                      {temDados && expandido && (
                        <div className="ml-11 mb-2 p-3">
                          <DiffView
                            antes={log.dados_antes}
                            depois={log.dados_depois}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
