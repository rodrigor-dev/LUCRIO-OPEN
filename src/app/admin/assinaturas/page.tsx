"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Eye,
  MoreHorizontal,
  CalendarClock,
  Ban,
  RotateCcw,
  Download,
  Receipt,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Crown,
  Gift,
  Key,
  Shield,
  Loader2,
  FlaskConical,
  AlertTriangle,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listarUsuariosAssinaturas,
  liberarAcesso,
  acessoSistematico,
  estenderTrial,
  tornarAdmin,
  atualizarAssinatura,
  listarPlanos,
} from "@/services/admin.service";
import { formatarData, formatarDataHora, formatarMoeda } from "@/utils";
import type { PlanoAdmin } from "@/types/admin";

interface UsuarioAssinatura {
  usuario_id: string;
  usuario_nome: string;
  usuario_email: string;
  usuario_avatar: string | null;
  usuario_criado_em: string;
  is_admin: boolean;
  is_ativo: boolean;
  assinatura_id: string | null;
  plano_id: string | null;
  plano_nome: string | null;
  plano_preco: number | null;
  status: string | null;
  inicio_periodo: string | null;
  fim_periodo: string | null;
  trial_termina: string | null;
  criado_em: string | null;
}

type TipoFiltro = "todos" | "ativo" | "trial" | "sem_acesso" | "admin" | "vitalicio";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; color: string }> = {
  ativo: { label: "PRO Ativo", variant: "default", icon: CheckCircle2, color: "bg-green-500" },
  trial: { label: "Trial", variant: "secondary", icon: Clock, color: "bg-amber-500" },
  cancelado: { label: "Cancelado", variant: "destructive", icon: XCircle, color: "bg-red-500" },
  expirado: { label: "Expirado", variant: "outline", icon: AlertTriangle, color: "bg-gray-500" },
  sem_acesso: { label: "Sem Acesso", variant: "outline", icon: FlaskConical, color: "bg-gray-400" },
  vitalicio: { label: "Vitalicio", variant: "default", icon: Crown, color: "bg-purple-500" },
};

function getUsuarioStatus(u: UsuarioAssinatura): string {
  if (u.status === "ativo" && u.fim_periodo) {
    const fim = new Date(u.fim_periodo);
    if (fim.getFullYear() > 2090) return "vitalicio";
    return "ativo";
  }
  if (u.status === "trial") return "trial";
  if (u.status === "cancelado") return "cancelado";
  return "sem_acesso";
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
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
  return nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function AdminAssinaturasPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAssinatura[]>([]);
  const [planos, setPlanos] = useState<PlanoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<TipoFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [detail, setDetail] = useState<UsuarioAssinatura | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [processando, setProcessando] = useState(false);

  const [acessoDialog, setAcessoDialog] = useState<UsuarioAssinatura | null>(null);
  const [acessoDias, setAcessoDias] = useState(30);
  const [vitalicioDialog, setVitalicioDialog] = useState<UsuarioAssinatura | null>(null);
  const [trialDialog, setTrialDialog] = useState<UsuarioAssinatura | null>(null);
  const [trialDias, setTrialDias] = useState(7);
  const [extendDialog, setExtendDialog] = useState<UsuarioAssinatura | null>(null);
  const [diasExtensao, setDiasExtensao] = useState(30);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [data, planosData] = await Promise.all([
        listarUsuariosAssinaturas(),
        listarPlanos(),
      ]);
      setUsuarios(data);
      setPlanos(planosData);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const usuariosFiltrados = usuarios.filter((u) => {
    const status = getUsuarioStatus(u);
    let matchFiltro = true;
    if (filtro === "ativo") matchFiltro = status === "ativo";
    else if (filtro === "trial") matchFiltro = status === "trial";
    else if (filtro === "sem_acesso") matchFiltro = status === "sem_acesso";
    else if (filtro === "admin") matchFiltro = u.is_admin;
    else if (filtro === "vitalicio") matchFiltro = status === "vitalicio";

    const matchBusca = !busca ||
      u.usuario_nome?.toLowerCase().includes(busca.toLowerCase()) ||
      u.usuario_email?.toLowerCase().includes(busca.toLowerCase());

    return matchFiltro && matchBusca;
  });

  const contagem = (tipo: TipoFiltro) => {
    if (tipo === "todos") return usuarios.length;
    if (tipo === "sem_acesso") return usuarios.filter((u) => getUsuarioStatus(u) === "sem_acesso").length;
    if (tipo === "admin") return usuarios.filter((u) => u.is_admin).length;
    if (tipo === "vitalicio") return usuarios.filter((u) => getUsuarioStatus(u) === "vitalicio").length;
    return usuarios.filter((u) => getUsuarioStatus(u) === tipo).length;
  };

  const totalAtivos = usuarios.filter((u) => ["ativo", "vitalicio"].includes(getUsuarioStatus(u))).length;
  const totalTrials = usuarios.filter((u) => getUsuarioStatus(u) === "trial").length;
  const totalMRR = usuarios
    .filter((u) => getUsuarioStatus(u) === "ativo")
    .reduce((acc, u) => acc + (u.plano_preco || 0), 0);

  const handleConcederAcesso = async () => {
    if (!acessoDialog) return;
    setProcessando(true);
    try {
      await liberarAcesso(acessoDialog.usuario_id, acessoDias);
      toast.success(`Acesso concedido por ${acessoDias} dias`);
      setAcessoDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao conceder acesso");
    } finally {
      setProcessando(false);
    }
  };

  const handleAcessoVitalicio = async () => {
    if (!vitalicioDialog) return;
    setProcessando(true);
    try {
      await acessoSistematico(vitalicioDialog.usuario_id);
      toast.success("Acesso vitalicio concedido");
      setVitalicioDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao conceder acesso vitalicio");
    } finally {
      setProcessando(false);
    }
  };

  const handleEstenderTrial = async () => {
    if (!trialDialog) return;
    setProcessando(true);
    try {
      await estenderTrial(trialDialog.usuario_id, trialDias);
      toast.success(`Trial estendido em ${trialDias} dias`);
      setTrialDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao estender trial");
    } finally {
      setProcessando(false);
    }
  };

  const handleEstenderPeriodo = async () => {
    if (!extendDialog?.assinatura_id) return;
    setProcessando(true);
    try {
      const fimAtual = extendDialog.fim_periodo ? new Date(extendDialog.fim_periodo) : new Date();
      fimAtual.setDate(fimAtual.getDate() + diasExtensao);
      await atualizarAssinatura(extendDialog.assinatura_id, {
        fim_periodo: fimAtual.toISOString(),
        status: "ativo",
      });
      toast.success("Periodo estendido com sucesso");
      setExtendDialog(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao estender periodo");
    } finally {
      setProcessando(false);
    }
  };

  const handleCancelar = async (u: UsuarioAssinatura) => {
    if (!u.assinatura_id) return;
    setProcessando(true);
    try {
      await atualizarAssinatura(u.assinatura_id, { status: "cancelado" });
      toast.success("Assinatura cancelada");
      setSheetOpen(false);
      setDetail(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao cancelar");
    } finally {
      setProcessando(false);
    }
  };

  const handleReativar = async (u: UsuarioAssinatura) => {
    if (!u.assinatura_id) return;
    setProcessando(true);
    try {
      await atualizarAssinatura(u.assinatura_id, { status: "ativo" });
      toast.success("Assinatura reativada");
      setSheetOpen(false);
      setDetail(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao reativar");
    } finally {
      setProcessando(false);
    }
  };

  const handleTornarAdmin = async (u: UsuarioAssinatura) => {
    try {
      await tornarAdmin(u.usuario_id, !u.is_admin);
      toast.success(u.is_admin ? "Admin removido" : "Admin concedido");
      await carregarDados();
    } catch {
      toast.error("Erro ao alterar admin");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assinaturas</h1>
          <p className="text-muted-foreground">
            Gerencie acesso e assinaturas dos usuarios
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Ativos / Vitalicios
          </div>
          <p className="mt-1 text-2xl font-bold">{totalAtivos}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-amber-500" />
            Em Trial
          </div>
          <p className="mt-1 text-2xl font-bold">{totalTrials}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4 text-green-600" />
            MRR
          </div>
          <p className="mt-1 text-2xl font-bold">{formatarMoeda(totalMRR)}</p>
        </motion.div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as TipoFiltro)}>
          <TabsList className="flex w-full overflow-x-auto">
            {([
              { value: "todos", label: "Todos" },
              { value: "ativo", label: "Ativos" },
              { value: "trial", label: "Trials" },
              { value: "vitalicio", label: "Vitalicios" },
              { value: "sem_acesso", label: "Sem Acesso" },
              { value: "admin", label: "Admins" },
            ] as const).map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="whitespace-nowrap">
                {tab.label}
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{contagem(tab.value)}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar usuario..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Valido Ate</TableHead>
              <TableHead>Trial Termina</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? <TableSkeleton /> : usuariosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhum usuario encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {usuariosFiltrados.map((u, idx) => {
                  const status = getUsuarioStatus(u);
                  const conf = STATUS_CONFIG[status] || STATUS_CONFIG.sem_acesso;
                  const StatusIcon = conf.icon;
                  return (
                    <motion.tr
                      key={u.usuario_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setDetail(u); setSheetOpen(true); }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={u.usuario_avatar || undefined} />
                            <AvatarFallback className="text-xs">{getInitials(u.usuario_nome || "U")}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm">{u.usuario_nome || "Sem nome"}</p>
                              {u.is_admin && <Crown className="h-3 w-3 text-amber-500" />}
                            </div>
                            <p className="text-xs text-muted-foreground">{u.usuario_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={conf.variant} className="gap-1">
                          <div className={`h-1.5 w-1.5 rounded-full ${conf.color}`} />
                          {conf.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{u.plano_nome || "-"}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.fim_periodo ? formatarData(u.fim_periodo) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.trial_termina ? formatarData(u.trial_termina) : "-"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setDetail(u); setSheetOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" /> Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {status === "sem_acesso" && (
                              <DropdownMenuItem onClick={() => setAcessoDialog(u)}>
                                <Key className="mr-2 h-4 w-4" /> Conceder Acesso
                              </DropdownMenuItem>
                            )}
                            {status === "trial" && (
                              <DropdownMenuItem onClick={() => setTrialDialog(u)}>
                                <Gift className="mr-2 h-4 w-4" /> Estender Trial
                              </DropdownMenuItem>
                            )}
                            {status === "ativo" && (
                              <DropdownMenuItem onClick={() => setExtendDialog(u)}>
                                <CalendarClock className="mr-2 h-4 w-4" /> Estender Periodo
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setVitalicioDialog(u)}>
                              <Crown className="mr-2 h-4 w-4" /> Acesso Vitalicio
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleTornarAdmin(u)}>
                              <Shield className="mr-2 h-4 w-4" /> {u.is_admin ? "Remover Admin" : "Tornar Admin"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.assinatura_id && (status === "ativo" || status === "vitalicio") && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleCancelar(u)}>
                                <Ban className="mr-2 h-4 w-4" /> Cancelar Acesso
                              </DropdownMenuItem>
                            )}
                            {u.assinatura_id && status === "cancelado" && (
                              <DropdownMenuItem onClick={() => handleReativar(u)}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Reativar
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

      {/* Sheet detalhes */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setDetail(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Usuario</SheetTitle>
            <SheetDescription>Informacoes e gerenciamento de acesso</SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={detail.usuario_avatar || undefined} />
                  <AvatarFallback>{getInitials(detail.usuario_nome || "U")}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{detail.usuario_nome || "Sem nome"}</h3>
                    {detail.is_admin && <Badge variant="default" className="gap-1"><Crown className="h-3 w-3" /> Admin</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{detail.usuario_email}</p>
                  <p className="text-xs text-muted-foreground">Membro desde {formatarData(detail.usuario_criado_em)}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={STATUS_CONFIG[getUsuarioStatus(detail)]?.variant || "outline"} className="mt-1 gap-1">
                    {(() => { const s = STATUS_CONFIG[getUsuarioStatus(detail)]; const I = s?.icon; return I ? <I className="h-3 w-3" /> : null; })()}
                    {STATUS_CONFIG[getUsuarioStatus(detail)]?.label || "Desconhecido"}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <p className="mt-1 text-sm font-medium">{detail.plano_nome || "Nenhum"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valido Ate</p>
                  <p className="mt-1 text-sm font-medium">{detail.fim_periodo ? formatarData(detail.fim_periodo) : "-"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Trial Termina</p>
                  <p className="mt-1 text-sm font-medium">{detail.trial_termina ? formatarData(detail.trial_termina) : "-"}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Gerenciar Acesso</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setAcessoDialog(detail)}>
                    <Key className="mr-2 h-3.5 w-3.5" /> Conceder Acesso
                  </Button>
                  <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setVitalicioDialog(detail)}>
                    <Crown className="mr-2 h-3.5 w-3.5" /> Vitalicio
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setTrialDialog(detail)}>
                    <Gift className="mr-2 h-3.5 w-3.5" /> Estender Trial
                  </Button>
                  {detail.assinatura_id && (
                    <Button variant="outline" size="sm" onClick={() => setExtendDialog(detail)}>
                      <CalendarClock className="mr-2 h-3.5 w-3.5" /> Estender Periodo
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleTornarAdmin(detail)}>
                    <Shield className="mr-2 h-3.5 w-3.5" /> {detail.is_admin ? "Remover Admin" : "Tornar Admin"}
                  </Button>
                  {detail.assinatura_id && getUsuarioStatus(detail) !== "cancelado" && (
                    <Button variant="destructive" size="sm" onClick={() => handleCancelar(detail)}>
                      <Ban className="mr-2 h-3.5 w-3.5" /> Cancelar
                    </Button>
                  )}
                  {detail.assinatura_id && getUsuarioStatus(detail) === "cancelado" && (
                    <Button variant="outline" size="sm" onClick={() => handleReativar(detail)}>
                      <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reativar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog Conceder Acesso */}
      <Dialog open={!!acessoDialog} onOpenChange={(open) => { if (!open) setAcessoDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="h-5 w-5 text-emerald-600" /> Conceder Acesso</DialogTitle>
            <DialogDescription>Conceder acesso PRO para <strong>{acessoDialog?.usuario_nome}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias de acesso</label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90].map((d) => (
                  <Button key={d} variant={acessoDias === d ? "default" : "outline"} size="sm" onClick={() => setAcessoDias(d)}>{d}d</Button>
                ))}
              </div>
              <Input type="number" min="1" max="3650" value={acessoDias} onChange={(e) => setAcessoDias(parseInt(e.target.value) || 30)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcessoDialog(null)}>Cancelar</Button>
            <Button onClick={handleConcederAcesso} disabled={processando} className="bg-emerald-600 hover:bg-emerald-700">
              {processando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concedendo...</> : <><Key className="mr-2 h-4 w-4" /> Conceder</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Vitalicio */}
      <Dialog open={!!vitalicioDialog} onOpenChange={(open) => { if (!open) setVitalicioDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" /> Acesso Vitalicio</DialogTitle>
            <DialogDescription>Conceder acesso vitalicio para <strong>{vitalicioDialog?.usuario_nome}</strong>?</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            O usuario tera acesso ilimitado ao plano PRO para sempre.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVitalicioDialog(null)}>Cancelar</Button>
            <Button onClick={handleAcessoVitalicio} disabled={processando} className="bg-amber-600 hover:bg-amber-700">
              {processando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concedendo...</> : <><Crown className="mr-2 h-4 w-4" /> Conceder Vitalicio</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Estender Trial */}
      <Dialog open={!!trialDialog} onOpenChange={(open) => { if (!open) setTrialDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-purple-600" /> Estender Trial</DialogTitle>
            <DialogDescription>Estender trial de <strong>{trialDialog?.usuario_nome}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias adicionais</label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((d) => (
                  <Button key={d} variant={trialDias === d ? "default" : "outline"} size="sm" onClick={() => setTrialDias(d)}>+{d}d</Button>
                ))}
              </div>
              <Input type="number" min="1" max="90" value={trialDias} onChange={(e) => setTrialDias(parseInt(e.target.value) || 7)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialDialog(null)}>Cancelar</Button>
            <Button onClick={handleEstenderTrial} disabled={processando} className="bg-purple-600 hover:bg-purple-700">
              {processando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estendendo...</> : <><Gift className="mr-2 h-4 w-4" /> Estender</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Estender Periodo */}
      <Dialog open={!!extendDialog} onOpenChange={(open) => { if (!open) setExtendDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Estender Periodo</DialogTitle>
            <DialogDescription>Adicionar dias ao acesso de <strong>{extendDialog?.usuario_nome}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias para adicionar</label>
              <Input type="number" min="1" value={diasExtensao} onChange={(e) => setDiasExtensao(parseInt(e.target.value) || 30)} />
            </div>
            {extendDialog?.fim_periodo && (
              <p className="text-sm text-muted-foreground">
                Novo fim: <strong>{formatarData(new Date(new Date(extendDialog.fim_periodo).getTime() + diasExtensao * 86400000).toISOString())}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialog(null)}>Cancelar</Button>
            <Button onClick={handleEstenderPeriodo} disabled={processando}>
              {processando ? "Estendendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
