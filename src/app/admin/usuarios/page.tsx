"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Ban,
  Trash2,
  UserCheck,
  UserX,
  ShieldCheck,
  Shield,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Receipt,
  FolderOpen,
  Download,
  Crown,
  Gift,
  Key,
  Calendar,
  Loader2,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listarUsuarios,
  obterUsuario,
  atualizarUsuario,
  bloquearUsuario,
  desbloquearUsuario,
  suspenderUsuario,
  reativarUsuario,
  excluirUsuario,
  liberarAcesso,
  acessoSistematico,
  estenderTrial,
  tornarAdmin,
  obterAssinaturaUsuario,
} from "@/services/admin.service";
import { formatarData, formatarDataHora, formatarMoeda } from "@/utils";
import type { UsuarioAdmin, PlanoAdmin } from "@/types/admin";
import { listarPlanos } from "@/services/admin.service";

const ITENS_POR_PAGINA = 10;

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  ativo: { label: "Ativo", variant: "default", icon: CheckCircle2 },
  inativo: { label: "Inativo", variant: "secondary", icon: XCircle },
  bloqueado: { label: "Bloqueado", variant: "destructive", icon: Ban },
  suspenso: { label: "Suspenso", variant: "outline", icon: AlertTriangle },
};

function getStatus(usuario: UsuarioAdmin): string {
  if (usuario.is_bloqueado) return "bloqueado";
  if (usuario.is_suspendido) return "suspenso";
  if (!usuario.is_ativo) return "inativo";
  return "ativo";
}

function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.ativo;
  return (
    <Badge variant={config.variant} className="gap-1">
      <config.icon className="h-3 w-3" />
      {config.label}
    </Badge>
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

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="w-12">
            <Skeleton className="h-4 w-4" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPlano, setFiltroPlano] = useState("todos");
  const [planos, setPlanos] = useState<PlanoAdmin[]>([]);
  const [pagina, setPagina] = useState(1);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [usuarioDetail, setUsuarioDetail] = useState<UsuarioAdmin | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<UsuarioAdmin | null>(null);
  const [editDialog, setEditDialog] = useState<UsuarioAdmin | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", telefone: "" });
  const [salvando, setSalvando] = useState(false);
  const [acessoDialog, setAcessoDialog] = useState<UsuarioAdmin | null>(null);
  const [acessoDias, setAcessoDias] = useState(30);
  const [vitalicioDialog, setVitalicioDialog] = useState<UsuarioAdmin | null>(null);
  const [trialDialog, setTrialDialog] = useState<UsuarioAdmin | null>(null);
  const [trialDias, setTrialDias] = useState(7);
  const [assinaturaInfo, setAssinaturaInfo] = useState<Record<string, unknown> | null>(null);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [usuariosData, planosData] = await Promise.all([
        listarUsuarios(busca || undefined, {
          plano: filtroPlano !== "todos" ? filtroPlano : undefined,
          status: filtroStatus !== "todos" ? filtroStatus : undefined,
        }),
        listarPlanos(),
      ]);
      setUsuarios(usuariosData);
      setPlanos(planosData);
    } catch {
      toast.error("Erro ao carregar usuarios");
    } finally {
      setCarregando(false);
    }
  }, [busca, filtroStatus, filtroPlano]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    setPagina(1);
    setSelecionados(new Set());
  }, [busca, filtroStatus, filtroPlano]);

  const usuariosFiltrados = usuarios;
  const totalPaginas = Math.ceil(usuariosFiltrados.length / ITENS_POR_PAGINA);
  const usuariosPagina = usuariosFiltrados.slice(
    (pagina - 1) * ITENS_POR_PAGINA,
    pagina * ITENS_POR_PAGINA
  );

  const toggleSelectAll = () => {
    if (selecionados.size === usuariosPagina.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(usuariosPagina.map((u) => u.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionados(novo);
  };

  const openDetail = async (usuario: UsuarioAdmin) => {
    setSheetOpen(true);
    try {
      const [detalhe, assinatura] = await Promise.all([
        obterUsuario(usuario.id),
        obterAssinaturaUsuario(usuario.id),
      ]);
      setUsuarioDetail(detalhe);
      setAssinaturaInfo(assinatura);
    } catch (err) {
      console.error("[AdminUsuarios] Erro ao carregar detalhes:", err);
      setUsuarioDetail(usuario);
      setAssinaturaInfo(null);
    }
  };

  const handleBloquear = async (usuario: UsuarioAdmin) => {
    try {
      if (usuario.is_bloqueado) {
        await desbloquearUsuario(usuario.id);
        toast.success("Usuario desbloqueado com sucesso");
      } else {
        await bloquearUsuario(usuario.id);
        toast.success("Usuario bloqueado com sucesso");
      }
      await carregarDados();
      if (usuarioDetail?.id === usuario.id) {
        const atualizado = await obterUsuario(usuario.id);
        setUsuarioDetail(atualizado);
      }
    } catch {
      toast.error("Erro ao alterar status do usuario");
    }
  };

  const handleSuspender = async (usuario: UsuarioAdmin) => {
    try {
      if (usuario.is_suspendido) {
        await reativarUsuario(usuario.id);
        toast.success("Usuario reativado com sucesso");
      } else {
        await suspenderUsuario(usuario.id);
        toast.success("Usuario suspenso com sucesso");
      }
      await carregarDados();
      if (usuarioDetail?.id === usuario.id) {
        const atualizado = await obterUsuario(usuario.id);
        setUsuarioDetail(atualizado);
      }
    } catch {
      toast.error("Erro ao alterar status do usuario");
    }
  };

  const handleExcluir = async () => {
    if (!deleteDialog) return;
    setSalvando(true);
    try {
      await excluirUsuario(deleteDialog.id);
      toast.success("Usuario excluido com sucesso");
      setDeleteDialog(null);
      setSheetOpen(false);
      setUsuarioDetail(null);
      await carregarDados();
    } catch {
      toast.error("Erro ao excluir usuario");
    } finally {
      setSalvando(false);
    }
  };

  const handleConcederAcesso = async () => {
    if (!acessoDialog) return;
    setSalvando(true);
    try {
      await liberarAcesso(acessoDialog.id, acessoDias);
      toast.success(`Acesso concedido por ${acessoDias} dias`);
      setAcessoDialog(null);
      await carregarDados();
      if (usuarioDetail?.id === acessoDialog.id) {
        const atualizado = await obterUsuario(acessoDialog.id);
        setUsuarioDetail(atualizado);
        const assinatura = await obterAssinaturaUsuario(acessoDialog.id);
        setAssinaturaInfo(assinatura);
      }
    } catch {
      toast.error("Erro ao conceder acesso");
    } finally {
      setSalvando(false);
    }
  };

  const handleAcessoVitalicio = async () => {
    if (!vitalicioDialog) return;
    setSalvando(true);
    try {
      await acessoSistematico(vitalicioDialog.id);
      toast.success("Acesso vitalicio concedido com sucesso");
      setVitalicioDialog(null);
      await carregarDados();
      if (usuarioDetail?.id === vitalicioDialog.id) {
        const atualizado = await obterUsuario(vitalicioDialog.id);
        setUsuarioDetail(atualizado);
        const assinatura = await obterAssinaturaUsuario(vitalicioDialog.id);
        setAssinaturaInfo(assinatura);
      }
    } catch {
      toast.error("Erro ao conceder acesso vitalicio");
    } finally {
      setSalvando(false);
    }
  };

  const handleEstenderTrial = async () => {
    if (!trialDialog) return;
    setSalvando(true);
    try {
      await estenderTrial(trialDialog.id, trialDias);
      toast.success(`Trial estendido em ${trialDias} dias`);
      setTrialDialog(null);
      await carregarDados();
      if (usuarioDetail?.id === trialDialog.id) {
        const atualizado = await obterUsuario(trialDialog.id);
        setUsuarioDetail(atualizado);
        const assinatura = await obterAssinaturaUsuario(trialDialog.id);
        setAssinaturaInfo(assinatura);
      }
    } catch {
      toast.error("Erro ao estender trial");
    } finally {
      setSalvando(false);
    }
  };

  const handleTornarAdmin = async (usuario: UsuarioAdmin) => {
    try {
      await tornarAdmin(usuario.id, !usuario.is_admin);
      toast.success(usuario.is_admin ? "Admin removido com sucesso" : "Admin concedido com sucesso");
      await carregarDados();
      if (usuarioDetail?.id === usuario.id) {
        const atualizado = await obterUsuario(usuario.id);
        setUsuarioDetail(atualizado);
      }
    } catch {
      toast.error("Erro ao alterar admin");
    }
  };

  const handleEditar = async () => {
    if (!editDialog) return;
    setSalvando(true);
    try {
      await atualizarUsuario(editDialog.id, editForm);
      toast.success("Usuario atualizado com sucesso");
      setEditDialog(null);
      await carregarDados();
      if (usuarioDetail?.id === editDialog.id) {
        const atualizado = await obterUsuario(editDialog.id);
        setUsuarioDetail(atualizado);
      }
    } catch {
      toast.error("Erro ao atualizar usuario");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <p className="text-muted-foreground">
          Gerencie todos os usuarios do sistema
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroPlano} onValueChange={setFiltroPlano}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Planos</SelectItem>
              {planos.map((plano) => (
                <SelectItem key={plano.id} value={plano.id}>
                  {plano.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selecionados.size > 0 && (
            <Badge variant="secondary">{selecionados.size} selecionados</Badge>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-x-auto rounded-lg border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    usuariosPagina.length > 0 &&
                    selecionados.size === usuariosPagina.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  Usuario
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ultimo Login</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableSkeleton />
            ) : usuariosPagina.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum usuario encontrado
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence>
                {usuariosPagina.map((usuario, idx) => {
                  const status = getStatus(usuario);
                  return (
                    <motion.tr
                      key={usuario.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(usuario)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selecionados.has(usuario.id)}
                          onCheckedChange={() => toggleSelect(usuario.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={usuario.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(usuario.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{usuario.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {usuario.email}
                      </TableCell>
                      <TableCell>
                        {usuario.plano ? (
                          <Badge variant="secondary">{usuario.plano.nome}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sem plano
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {usuario.ultimo_login_em
                          ? formatarDataHora(usuario.ultimo_login_em)
                          : "Nunca"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(usuario)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditDialog(usuario);
                                setEditForm({
                                  nome: usuario.nome,
                                  email: usuario.email,
                                  telefone: usuario.telefone || "",
                                });
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleBloquear(usuario)}>
                              {usuario.is_bloqueado ? (
                                <>
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  Desbloquear
                                </>
                              ) : (
                                <>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Bloquear
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSuspender(usuario)}>
                              {usuario.is_suspendido ? (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reativar
                                </>
                              ) : (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Suspender
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteDialog(usuario)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
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

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {pagina} de {totalPaginas} ({usuariosFiltrados.length} usuarios)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina === 1}
              onClick={() => setPagina(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
              let num: number;
              if (totalPaginas <= 5) {
                num = i + 1;
              } else if (pagina <= 3) {
                num = i + 1;
              } else if (pagina >= totalPaginas - 2) {
                num = totalPaginas - 4 + i;
              } else {
                num = pagina - 2 + i;
              }
              return (
                <Button
                  key={num}
                  variant={num === pagina ? "default" : "outline"}
                  size="sm"
                  className="w-9"
                  onClick={() => setPagina(num)}
                >
                  {num}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={pagina === totalPaginas}
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={(open) => {
        setSheetOpen(open);
        if (!open) { setUsuarioDetail(null); setAssinaturaInfo(null); }
      }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Usuario</SheetTitle>
            <SheetDescription>
              Informacoes completas e acoes disponiveis
            </SheetDescription>
          </SheetHeader>
          {usuarioDetail && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={usuarioDetail.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">
                    {getInitials(usuarioDetail.nome)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{usuarioDetail.nome}</h3>
                  <p className="text-sm text-muted-foreground">{usuarioDetail.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(getStatus(usuarioDetail))}
                    {usuarioDetail.is_admin && (
                      <Badge variant="default" className="gap-1">
                        <Crown className="h-3 w-3" /> Admin
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Assinatura</h4>
                {assinaturaInfo ? (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {(assinaturaInfo.plano as Record<string, unknown>)?.nome as string || "Plano PRO"}
                      </span>
                      <Badge variant={
                        assinaturaInfo.status === "ativo" ? "default" :
                        assinaturaInfo.status === "trial" ? "secondary" : "outline"
                      }>
                        {assinaturaInfo.status === "ativo" && "Ativo"}
                        {assinaturaInfo.status === "trial" && "Trial"}
                        {assinaturaInfo.status === "cancelado" && "Cancelado"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {!!assinaturaInfo.status && assinaturaInfo.status === "trial" && !!assinaturaInfo.trial_termina && (
                        <p>Trial termina: <strong>{formatarDataHora(String(assinaturaInfo.trial_termina))}</strong></p>
                      )}
                      {!!assinaturaInfo.fim_periodo && (
                        <p>Valido ate: <strong>{formatarDataHora(String(assinaturaInfo.fim_periodo))}</strong></p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">Nenhuma assinatura encontrada</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Acesso e Permissoes</h4>
                <div className="rounded-lg border divide-y">
                  <div className="flex items-center justify-between p-3 text-sm">
                    <span className="text-muted-foreground">Telefone</span>
                    <span>{usuarioDetail.telefone || "Nao informado"}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 text-sm">
                    <span className="text-muted-foreground">Ultimo Login</span>
                    <span>
                      {usuarioDetail.ultimo_login_em
                        ? formatarDataHora(usuarioDetail.ultimo_login_em)
                        : "Nunca"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 text-sm">
                    <span className="text-muted-foreground">Admin</span>
                    <Badge variant={usuarioDetail.is_admin ? "default" : "secondary"}>
                      {usuarioDetail.is_admin ? "Sim" : "Nao"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Gerenciar Acesso</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setAcessoDialog(usuarioDetail)}
                  >
                    <Key className="mr-2 h-3.5 w-3.5" />
                    Conceder Acesso
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => setVitalicioDialog(usuarioDetail)}
                  >
                    <Crown className="mr-2 h-3.5 w-3.5" />
                    Acesso Vitalicio
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTrialDialog(usuarioDetail)}
                  >
                    <Gift className="mr-2 h-3.5 w-3.5" />
                    Estender Trial
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTornarAdmin(usuarioDetail)}
                  >
                    <Shield className="mr-2 h-3.5 w-3.5" />
                    {usuarioDetail.is_admin ? "Remover Admin" : "Tornar Admin"}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Outras Acoes</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditDialog(usuarioDetail);
                      setEditForm({
                        nome: usuarioDetail.nome,
                        email: usuarioDetail.email,
                        telefone: usuarioDetail.telefone || "",
                      });
                      setSheetOpen(false);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBloquear(usuarioDetail)}
                  >
                    {usuarioDetail.is_bloqueado ? (
                      <>
                        <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                        Desbloquear
                      </>
                    ) : (
                      <>
                        <Ban className="mr-2 h-3.5 w-3.5" />
                        Bloquear
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuspender(usuarioDetail)}
                  >
                    {usuarioDetail.is_suspendido ? (
                      <>
                        <UserCheck className="mr-2 h-3.5 w-3.5" />
                        Reativar
                      </>
                    ) : (
                      <>
                        <UserX className="mr-2 h-3.5 w-3.5" />
                        Suspender
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialog(usuarioDetail)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Atualize as informacoes do usuario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={editForm.nome}
                onChange={(e) => setEditForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={editForm.telefone}
                onChange={(e) => setEditForm(f => ({ ...f, telefone: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Usuario</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteDialog?.nome}</strong>?
              Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={salvando}>
              {salvando ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</>
              ) : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!acessoDialog} onOpenChange={(open) => { if (!open) setAcessoDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-emerald-600" />
              Conceder Acesso
            </DialogTitle>
            <DialogDescription>
              Conceder acesso ao sistema para <strong>{acessoDialog?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias de acesso</label>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90].map((d) => (
                  <Button
                    key={d}
                    variant={acessoDias === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAcessoDias(d)}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                max="3650"
                value={acessoDias}
                onChange={(e) => setAcessoDias(parseInt(e.target.value) || 30)}
              />
              <p className="text-xs text-muted-foreground">
                {acessoDias} dias = {acessoDias >= 365 ? `${(acessoDias / 365).toFixed(1)} anos` : `${acessoDias} dias`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcessoDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConcederAcesso} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
              {salvando ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concedendo...</>
              ) : (
                <><Key className="mr-2 h-4 w-4" /> Conceder Acesso</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!vitalicioDialog} onOpenChange={(open) => { if (!open) setVitalicioDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" />
              Acesso Vitalicio
            </DialogTitle>
            <DialogDescription>
              Conceder acesso vitalicio para <strong>{vitalicioDialog?.nome}</strong>?
              Esta acao da acesso permanente ao sistema sem necessidade de pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p>O usuario tera acesso ilimitado ao plano PRO para sempre.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVitalicioDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAcessoVitalicio} disabled={salvando} className="bg-amber-600 hover:bg-amber-700">
              {salvando ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Concedendo...</>
              ) : (
                <><Crown className="mr-2 h-4 w-4" /> Conceder Vitalicio</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!trialDialog} onOpenChange={(open) => { if (!open) setTrialDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600" />
              Estender Trial
            </DialogTitle>
            <DialogDescription>
              Estender o periodo de trial de <strong>{trialDialog?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias adicionais</label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map((d) => (
                  <Button
                    key={d}
                    variant={trialDias === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTrialDias(d)}
                  >
                    +{d}d
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                max="90"
                value={trialDias}
                onChange={(e) => setTrialDias(parseInt(e.target.value) || 7)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEstenderTrial} disabled={salvando} className="bg-purple-600 hover:bg-purple-700">
              {salvando ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estendendo...</>
              ) : (
                <><Gift className="mr-2 h-4 w-4" /> Estender Trial</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
