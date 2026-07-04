"use client";

import { useState, useEffect, useMemo } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { formatarTelefone, formatarCPFCNPJ } from "@/utils";
import type { Cliente, Endereco } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  FileText,
  ChevronDown,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

type FormState = {
  nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
  cpf_cnpj: string;
  endereco: Endereco;
  tipo: "fixo" | "esporadico";
  valor_mensal: string;
  dia_vencimento: string;
  fornecedor: string;
  observacoes: string;
};

const emptyForm: FormState = {
  nome: "",
  telefone: "",
  whatsapp: "",
  email: "",
  cpf_cnpj: "",
  endereco: {},
  tipo: "esporadico",
  valor_mensal: "",
  dia_vencimento: "",
  fornecedor: "",
  observacoes: "",
};

function formatarMoeda(valor: string) {
  const num = parseFloat(valor.replace(/[^\d,]/g, "").replace(",", "."));
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ClientesPage() {
  const supabase = useSupabase();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "fixo" | "esporadico">(
    "todos"
  );
  const [dialogAberto, setDialogAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [clienteDeletando, setClienteDeletando] = useState<Cliente | null>(null);
  const [enderecoAberto, setEnderecoAberto] = useState(false);

  useEffect(() => {
    carregarClientes();
  }, [supabase]);

  async function carregarClientes() {
    setCarregando(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) {
        return;
      }

      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("nome");

      if (error) {
        toast.error("Erro ao carregar clientes.");
        return;
      }

      setClientes(data || []);
    } catch {
      toast.error("Erro ao carregar clientes.");
    } finally {
      setCarregando(false);
    }
  }

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const buscaMatch =
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.email?.toLowerCase().includes(busca.toLowerCase()) ||
        c.telefone?.includes(busca) ||
        c.cpf_cnpj?.includes(busca);
      const tipoMatch = filtroTipo === "todos" || c.tipo === filtroTipo;
      return buscaMatch && tipoMatch;
    });
  }, [clientes, busca, filtroTipo]);

  function abrirDialogNovo() {
    setClienteEditando(null);
    setForm(emptyForm);
    setEnderecoAberto(false);
    setDialogAberto(true);
  }

  function abrirDialogEditar(cliente: Cliente) {
    setClienteEditando(cliente);
    setForm({
      nome: cliente.nome,
      telefone: cliente.telefone || "",
      whatsapp: cliente.whatsapp || "",
      email: cliente.email || "",
      cpf_cnpj: cliente.cpf_cnpj || "",
      endereco: cliente.endereco || {},
      tipo: cliente.tipo,
      valor_mensal: cliente.valor_mensal != null ? String(cliente.valor_mensal) : "",
      dia_vencimento: cliente.dia_vencimento != null ? String(cliente.dia_vencimento) : "",
      fornecedor: cliente.fornecedor || "",
      observacoes: cliente.observacoes || "",
    });
    setEnderecoAberto(false);
    setDialogAberto(true);
  }

  function fecharDialog() {
    setDialogAberto(false);
    setClienteEditando(null);
    setForm(emptyForm);
    setEnderecoAberto(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) {
        toast.error("Negócio não encontrado.");
        return;
      }

      const payload = {
        nome: form.nome,
        telefone: form.telefone || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        cpf_cnpj: form.cpf_cnpj || null,
        endereco: form.endereco,
        tipo: form.tipo,
        valor_mensal: form.tipo === "fixo" && form.valor_mensal ? parseFloat(form.valor_mensal) : null,
        dia_vencimento: form.tipo === "fixo" && form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
        fornecedor: form.fornecedor || null,
        observacoes: form.observacoes || null,
      };

      if (clienteEditando) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", clienteEditando.id);

        if (error) {
          toast.error("Erro ao atualizar cliente.");
          return;
        }

        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clientes").insert({
          negocio_id: negocio.id,
          ...payload,
        });

        if (error) {
          toast.error("Erro ao criar cliente.");
          return;
        }

        toast.success("Cliente criado com sucesso!");
      }

      fecharDialog();
      carregarClientes();
    } catch {
      toast.error("Erro ao salvar cliente.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCliente() {
    if (!clienteDeletando) return;

    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteDeletando.id);

      if (error) {
        toast.error("Erro ao excluir cliente.");
        return;
      }

      toast.success("Cliente excluído com sucesso!");
      carregarClientes();
    } catch {
      toast.error("Erro ao excluir cliente.");
    } finally {
      setClienteDeletando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus {clientes.length} cliente
            {clientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={abrirDialogNovo} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, e-mail ou CPF/CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filtroTipo}
          onValueChange={(v) =>
            setFiltroTipo(v as "todos" | "fixo" | "esporadico")
          }
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="fixo">Fixo</SelectItem>
            <SelectItem value="esporadico">Esporádico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-semibold">
              Nenhum cliente encontrado
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {busca || filtroTipo !== "todos"
                ? "Tente buscar com outros termos ou filtros."
                : "Adicione seu primeiro cliente para começar."}
            </p>
            {!busca && filtroTipo === "todos" && (
              <Button onClick={abrirDialogNovo} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor Mensal</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {clientesFiltrados.map((cliente) => (
                      <motion.tr
                        key={cliente.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {cliente.nome.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {cliente.nome}
                              </p>
                              {cliente.email && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {cliente.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {cliente.telefone
                            ? formatarTelefone(cliente.telefone)
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {cliente.whatsapp
                            ? formatarTelefone(cliente.whatsapp)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cliente.tipo === "fixo" ? "default" : "secondary"
                            }
                          >
                            {cliente.tipo === "fixo" ? "Fixo" : "Esporádico"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {cliente.tipo === "fixo" && cliente.valor_mensal != null
                            ? formatarMoeda(String(cliente.valor_mensal))
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {cliente.tipo === "fixo" && cliente.dia_vencimento != null
                            ? `Dia ${cliente.dia_vencimento}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cliente.is_ativo ? "default" : "destructive"
                            }
                          >
                            {cliente.is_ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirDialogEditar(cliente)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog
                              open={clienteDeletando?.id === cliente.id}
                              onOpenChange={(open) => {
                                if (!open) setClienteDeletando(null);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setClienteDeletando(cliente)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Excluir cliente
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir{" "}
                                    <strong>{cliente.nome}</strong>? Esta ação
                                    não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={excluirCliente}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="grid gap-3 md:hidden">
            <AnimatePresence>
              {clientesFiltrados.map((cliente) => (
                <motion.div
                  key={cliente.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {cliente.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {cliente.nome}
                            </CardTitle>
                            <div className="mt-0.5 flex gap-1.5">
                              <Badge
                                variant={
                                  cliente.tipo === "fixo"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {cliente.tipo === "fixo"
                                  ? "Fixo"
                                  : "Esporádico"}
                              </Badge>
                              <Badge
                                variant={
                                  cliente.is_ativo ? "default" : "destructive"
                                }
                                className="text-xs"
                              >
                                {cliente.is_ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => abrirDialogEditar(cliente)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog
                            open={clienteDeletando?.id === cliente.id}
                            onOpenChange={(open) => {
                              if (!open) setClienteDeletando(null);
                            }}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setClienteDeletando(cliente)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Excluir cliente
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir{" "}
                                  <strong>{cliente.nome}</strong>? Esta ação não
                                  pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={excluirCliente}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 pt-0">
                      {cliente.telefone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {formatarTelefone(cliente.telefone)}
                        </div>
                      )}
                      {cliente.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {cliente.email}
                        </div>
                      )}
                      {cliente.cpf_cnpj && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          {formatarCPFCNPJ(cliente.cpf_cnpj)}
                        </div>
                      )}
                      {cliente.tipo === "fixo" && cliente.valor_mensal != null && (
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatarMoeda(String(cliente.valor_mensal))}
                          {cliente.dia_vencimento != null && (
                            <span className="text-xs text-muted-foreground">
                              · Vence dia {cliente.dia_vencimento}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {clienteEditando ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do cliente *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome do cliente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo do cliente</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value="esporadico"
                    checked={form.tipo === "esporadico"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tipo: e.target.value as "fixo" | "esporadico",
                      })
                    }
                    className="h-4 w-4 border-primary text-primary accent-primary"
                  />
                  <span className="text-sm">Cliente Esporádico</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo"
                    value="fixo"
                    checked={form.tipo === "fixo"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tipo: e.target.value as "fixo" | "esporadico",
                      })
                    }
                    className="h-4 w-4 border-primary text-primary accent-primary"
                  />
                  <span className="text-sm">Cliente Fixo</span>
                </label>
              </div>
            </div>

            {form.tipo === "fixo" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="valor_mensal">Valor Mensal (obrigatório) *</Label>
                  <Input
                    id="valor_mensal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valor_mensal}
                    onChange={(e) =>
                      setForm({ ...form, valor_mensal: e.target.value })
                    }
                    placeholder="0,00"
                    required={form.tipo === "fixo"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dia_vencimento">Dia de vencimento</Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={form.dia_vencimento}
                    onChange={(e) =>
                      setForm({ ...form, dia_vencimento: e.target.value })
                    }
                    placeholder="1 a 31"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={form.telefone}
                  onChange={(e) =>
                    setForm({ ...form, telefone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm({ ...form, whatsapp: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                placeholder="Observações sobre o cliente..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setEnderecoAberto(!enderecoAberto)}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
              >
                Endereço
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    enderecoAberto ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {enderecoAberto && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 rounded-md border p-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="rua">Rua</Label>
                          <Input
                            id="rua"
                            value={form.endereco.rua || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                endereco: { ...form.endereco, rua: e.target.value },
                              })
                            }
                            placeholder="Rua"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="numero">Número</Label>
                          <Input
                            id="numero"
                            value={form.endereco.numero || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                endereco: { ...form.endereco, numero: e.target.value },
                              })
                            }
                            placeholder="Nº"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="complemento">Complemento</Label>
                          <Input
                            id="complemento"
                            value={form.endereco.complemento || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                endereco: { ...form.endereco, complemento: e.target.value },
                              })
                            }
                            placeholder="Apto, Bloco..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bairro">Bairro</Label>
                          <Input
                            id="bairro"
                            value={form.endereco.bairro || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                endereco: { ...form.endereco, bairro: e.target.value },
                              })
                            }
                            placeholder="Bairro"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="cidade">Cidade</Label>
                          <Input
                            id="cidade"
                            value={form.endereco.cidade || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                endereco: { ...form.endereco, cidade: e.target.value },
                              })
                            }
                            placeholder="Cidade"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="estado">Estado</Label>
                          <Input
                            id="estado"
                            value={form.endereco.estado || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                endereco: { ...form.endereco, estado: e.target.value },
                              })
                            }
                            placeholder="UF"
                            maxLength={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cep">CEP</Label>
                          <Input
                            id="cep"
                            value={form.endereco.cep || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                endereco: { ...form.endereco, cep: e.target.value },
                              })
                            }
                            placeholder="00000-000"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={fecharDialog}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando
                  ? "Salvando..."
                  : clienteEditando
                    ? "Salvar"
                    : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
