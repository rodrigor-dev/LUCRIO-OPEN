"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Eye,
  MoreHorizontal,
  ArrowRightLeft,
  CalendarClock,
  Ban,
  RotateCcw,
  Download,
  Receipt,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FlaskConical,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listarAssinaturas,
  atualizarAssinatura,
  listarPlanos,
} from "@/services/admin.service";
import { formatarData, formatarMoeda } from "@/utils";
import type { PlanoAdmin } from "@/types/admin";

interface Assinatura {
  id: string;
  usuario_id: string;
  plano_id: string;
  status: string;
  valor: number | null;
  inicio_periodo: string | null;
  fim_periodo: string | null;
  trial_termina: string | null;
  criado_em: string;
  usuario?: { id: string; nome: string; email: string; avatar_url: string | null };
  plano?: PlanoAdmin;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  ativo: { label: "Ativa", variant: "default", color: "bg-green-500" },
  trial: { label: "Trial", variant: "secondary", color: "bg-amber-500" },
  cancelado: { label: "Cancelada", variant: "destructive", color: "bg-red-500" },
  expirado: { label: "Expirada", variant: "outline", color: "bg-gray-500" },
  inadimplente: { label: "Inadimplente", variant: "destructive", color: "bg-red-600" },
};

const TAB_STATUS: Record<string, string | undefined> = {
  todas: undefined,
  ativas: "ativo",
  trials: "trial",
  canceladas: "cancelado",
  inadimplentes: "inadimplente",
};

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function exportarCSV(assinaturas: Assinatura[]) {
  const headers = ["Usuario", "Email", "Plano", "Status", "Valor", "Inicio", "Fim"];
  const rows = assinaturas.map((a) => [
    a.usuario?.nome || "",
    a.usuario?.email || "",
    a.plano?.nome || "",
    a.status,
    a.valor?.toFixed(2) || "0",
    a.inicio_periodo ? formatarData(a.inicio_periodo) : "",
    a.fim_periodo ? formatarData(a.fim_periodo) : "",
  ]);

  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `assinaturas_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminAssinaturasPage() {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [planos, setPlanos] = useState<PlanoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("todas");
  const [busca, setBusca] = useState("");
  const [detail, setDetail] = useState<Assinatura | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [changePlanDialog, setChangePlanDialog] = useState<Assinatura | null>(null);
  const [novoPlanoId, setNovoPlanoId] = useState("");
  const [extendDialog, setExtendDialog] = useState<Assinatura | null>(null);
  const [diasExtensao, setDiasExtensao] = useState(30);
  const [processando, setProcessando] = useState(false);

  const carregarDados = useCallback(async (status?: string) => {
    setCarregando(true);
    try {
      const [data, planosData] = await Promise.all([
        listarAssinaturas(status ? { status } : undefined),
        listarPlanos(),
      ]);
      setAssinaturas(data as Assinatura[]);
      setPlanos(planosData);
    } catch {
      toast.error("Erro ao carregar assinaturas");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados(TAB_STATUS[abaAtiva]);
  }, [abaAtiva, carregarDados]);

  const assinaturasFiltradas = assinaturas.filter((a) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      a.usuario?.nome?.toLowerCase().includes(termo) ||
      a.usuario?.email?.toLowerCase().includes(termo) ||
      a.plano?.nome?.toLowerCase().includes(termo)
    );
  });

  const handleMudarPlano = async () => {
    if (!changePlanDialog || !novoPlanoId) return;
    setProcessando(true);
    try {
      await atualizarAssinatura(changePlanDialog.id, { plano_id: novoPlanoId });
      toast.success("Plano alterado com sucesso");
      setChangePlanDialog(null);
      setNovoPlanoId("");
      await carregarDados(TAB_STATUS[abaAtiva]);
    } catch {
      toast.error("Erro ao alterar plano");
    } finally {
      setProcessando(false);
    }
  };

  const handleEstenderPeriodo = async () => {
    if (!extendDialog) return;
    setProcessando(true);
    try {
      const fimAtual = extendDialog.fim_periodo
        ? new Date(extendDialog.fim_periodo)
        : new Date();
      fimAtual.setDate(fimAtual.getDate() + diasExtensao);
      await atualizarAssinatura(extendDialog.id, {
        fim_periodo: fimAtual.toISOString(),
        status: "ativo",
      });
      toast.success("Periodo estendido com sucesso");
      setExtendDialog(null);
      await carregarDados(TAB_STATUS[abaAtiva]);
    } catch {
      toast.error("Erro ao estender periodo");
    } finally {
      setProcessando(false);
    }
  };

  const handleCancelar = async (assinatura: Assinatura) => {
    setProcessando(true);
    try {
      await atualizarAssinatura(assinatura.id, { status: "cancelado" });
      toast.success("Assinatura cancelada");
      setSheetOpen(false);
      setDetail(null);
      await carregarDados(TAB_STATUS[abaAtiva]);
    } catch {
      toast.error("Erro ao cancelar assinatura");
    } finally {
      setProcessando(false);
    }
  };

  const handleReativar = async (assinatura: Assinatura) => {
    setProcessando(true);
    try {
      await atualizarAssinatura(assinatura.id, { status: "ativo" });
      toast.success("Assinatura reativada");
      setSheetOpen(false);
      setDetail(null);
      await carregarDados(TAB_STATUS[abaAtiva]);
    } catch {
      toast.error("Erro ao reativar assinatura");
    } finally {
      setProcessando(false);
    }
  };

  const openDetail = (assinatura: Assinatura) => {
    setDetail(assinatura);
    setSheetOpen(true);
  };

  const totalAssinaturas = assinaturasFiltradas.length;
  const totalAtivas = assinaturasFiltradas.filter((a) => a.status === "ativo").length;
  const totalMRR = assinaturasFiltradas
    .filter((a) => a.status === "ativo")
    .reduce((acc, a) => acc + (a.valor || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assinaturas</h1>
          <p className="text-muted-foreground">
            Gerencie todas as assinaturas dos usuarios
          </p>
        </div>
        <Button variant="outline" onClick={() => exportarCSV(assinaturasFiltradas)}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border p-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            Total Assinaturas
          </div>
          <p className="mt-1 text-2xl font-bold">{totalAssinaturas}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border p-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Ativas
          </div>
          <p className="mt-1 text-2xl font-bold">{totalAtivas}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border p-4"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4 text-green-600" />
            MRR Filtrado
          </div>
          <p className="mt-1 text-2xl font-bold">{formatarMoeda(totalMRR)}</p>
        </motion.div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="ativas">Ativas</TabsTrigger>
            <TabsTrigger value="trials">Trials</TabsTrigger>
            <TabsTrigger value="canceladas">Canceladas</TabsTrigger>
            <TabsTrigger value="inadimplentes">Inadimplentes</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario ou plano..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableSkeleton />
            ) : assinaturasFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FlaskConical className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma assinatura encontrada
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {assinaturasFiltradas.map((assinatura, idx) => {
                  const statusConfig = STATUS_CONFIG[assinatura.status] || STATUS_CONFIG.ativo;
                  return (
                    <motion.tr
                      key={assinatura.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(assinatura)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={assinatura.usuario?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(assinatura.usuario?.nome || "U")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {assinatura.usuario?.nome || "Desconhecido"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assinatura.usuario?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {assinatura.plano?.nome || "Sem plano"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="gap-1">
                          <div className={`h-1.5 w-1.5 rounded-full ${statusConfig.color}`} />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {assinatura.valor ? formatarMoeda(assinatura.valor) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assinatura.inicio_periodo
                          ? formatarData(assinatura.inicio_periodo)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {assinatura.fim_periodo
                          ? formatarData(assinatura.fim_periodo)
                          : "-"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(assinatura)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setChangePlanDialog(assinatura);
                                setNovoPlanoId(assinatura.plano_id || "");
                              }}
                            >
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Mudar plano
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setExtendDialog(assinatura)}
                            >
                              <CalendarClock className="mr-2 h-4 w-4" />
                              Estender periodo
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {assinatura.status === "cancelado" ? (
                              <DropdownMenuItem onClick={() => handleReativar(assinatura)}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleCancelar(assinatura)}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </motion.div>

      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setDetail(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Assinatura</SheetTitle>
            <SheetDescription>Informacoes completas da assinatura</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={detail.usuario?.avatar_url || undefined} />
                  <AvatarFallback>
                    {getInitials(detail.usuario?.nome || "U")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{detail.usuario?.nome}</h3>
                  <p className="text-sm text-muted-foreground">{detail.usuario?.email}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={(STATUS_CONFIG[detail.status] || STATUS_CONFIG.ativo).variant} className="mt-1">
                    {(STATUS_CONFIG[detail.status] || STATUS_CONFIG.ativo).label}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="mt-1 text-lg font-bold">
                    {detail.valor ? formatarMoeda(detail.valor) : "-"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Plano</h4>
                {detail.plano ? (
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{detail.plano.nome}</span>
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: detail.plano.cor }}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Mensal: {formatarMoeda(detail.plano.preco_mensal)}</p>
                      <p>Anual: {formatarMoeda(detail.plano.preco_anual)}</p>
                      <p>
                        Limites: {detail.plano.limite_clientes} clientes /{" "}
                        {detail.plano.limite_receitas} receitas
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum plano associado</p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Periodo</h4>
                <div className="rounded-lg border divide-y text-sm">
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">Inicio</span>
                    <span>{detail.inicio_periodo ? formatarData(detail.inicio_periodo) : "-"}</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">Fim</span>
                    <span>{detail.fim_periodo ? formatarData(detail.fim_periodo) : "-"}</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">Trial termina</span>
                    <span>{detail.trial_termina ? formatarData(detail.trial_termina) : "-"}</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">Criada em</span>
                    <span>{formatarData(detail.criado_em)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Acoes</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setChangePlanDialog(detail);
                      setNovoPlanoId(detail.plano_id || "");
                      setSheetOpen(false);
                    }}
                  >
                    <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                    Mudar Plano
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExtendDialog(detail);
                      setSheetOpen(false);
                    }}
                  >
                    <CalendarClock className="mr-2 h-3.5 w-3.5" />
                    Estender
                  </Button>
                  {detail.status === "cancelado" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReativar(detail)}
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Reativar
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancelar(detail)}
                    >
                      <Ban className="mr-2 h-3.5 w-3.5" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!changePlanDialog} onOpenChange={(open) => { if (!open) setChangePlanDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mudar Plano</DialogTitle>
            <DialogDescription>
              Altere o plano de <strong>{changePlanDialog?.usuario?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo Plano</label>
              <Select value={novoPlanoId} onValueChange={setNovoPlanoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {planos.filter((p) => p.is_ativo).map((plano) => (
                    <SelectItem key={plano.id} value={plano.id}>
                      {plano.nome} - {formatarMoeda(plano.preco_mensal)}/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleMudarPlano} disabled={!novoPlanoId || processando}>
              {processando ? "Alterando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!extendDialog} onOpenChange={(open) => { if (!open) setExtendDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estender Periodo</DialogTitle>
            <DialogDescription>
              Adicione dias ao periodo de <strong>{extendDialog?.usuario?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias para adicionar</label>
              <Input
                type="number"
                min="1"
                value={diasExtensao}
                onChange={(e) => setDiasExtensao(parseInt(e.target.value) || 30)}
              />
            </div>
            {extendDialog?.fim_periodo && (
              <p className="text-sm text-muted-foreground">
                Novo fim:{" "}
                <strong>
                  {formatarData(
                    new Date(
                      new Date(extendDialog.fim_periodo).getTime() +
                        diasExtensao * 86400000
                    ).toISOString()
                  )}
                </strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEstenderPeriodo} disabled={processando}>
              {processando ? "Estendendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
