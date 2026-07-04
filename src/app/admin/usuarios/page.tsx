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
      const detalhe = await obterUsuario(usuario.id);
      setUsuarioDetail(detalhe);
    } catch {
      setUsuarioDetail(usuario);
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
        className="rounded-lg border"
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
        if (!open) setUsuarioDetail(null);
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
                  {getStatusBadge(getStatus(usuarioDetail))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Total Clientes
                  </div>
                  <p className="mt-1 text-xl font-bold">
                    {usuarioDetail._count?.clientes ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Total Receitas
                  </div>
                  <p className="mt-1 text-xl font-bold">
                    {usuarioDetail._count?.receitas ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" />
                    Total Despesas
                  </div>
                  <p className="mt-1 text-xl font-bold">
                    {usuarioDetail._count?.despesas ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Membro desde
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {formatarData(usuarioDetail.criado_em)}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Informacoes da Assinatura</h4>
                {usuarioDetail.plano ? (
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{usuarioDetail.plano.nome}</span>
                      <Badge variant="secondary">{formatarMoeda(usuarioDetail.plano.preco_mensal)}/mes</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Clientes: {usuarioDetail.plano.limite_clientes}</p>
                      <p>Receitas: {usuarioDetail.plano.limite_receitas}</p>
                      <p>Despesas: {usuarioDetail.plano.limite_despesas}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano ativo
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Informacoes de Acesso</h4>
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

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Acoes</h4>
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
              {salvando ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
