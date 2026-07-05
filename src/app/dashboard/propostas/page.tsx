"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda, gerarNumeroOrcamento } from "@/utils";
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
  FileText,
  Pencil,
  Trash2,
  Send,
  Eye,
  Copy,
  Download,
  Calendar,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface ItemProposta {
  id?: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  total: number;
}

interface Cliente {
  id: string;
  nome: string;
}

interface Proposta {
  id: string;
  numero_proposta: string;
  cliente_id: string | null;
  validade: string;
  status: string;
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  condicoes_gerais: string | null;
  observacoes: string | null;
  criado_em: string;
  cliente?: { nome: string } | null;
  itens_proposta?: ItemProposta[];
}

type FormState = {
  cliente_id: string;
  validade: string;
  desconto: number;
  frete: number;
  condicoes_gerais: string;
  observacoes: string;
};

const emptyForm: FormState = {
  cliente_id: "",
  validade: "",
  desconto: 0,
  frete: 0,
  condicoes_gerais: "",
  observacoes: "",
};

const statusOptions = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "enviada", label: "Enviada" },
  { value: "aceita", label: "Aceita" },
  { value: "recusada", label: "Recusada" },
  { value: "expirada", label: "Expirada" },
];

const statusBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  rascunho: "secondary",
  enviada: "outline",
  aceita: "default",
  recusada: "destructive",
  expirada: "secondary",
};

const statusLabel: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

export default function PropostasPage() {
  const supabase = createClient();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [propostaEditando, setPropostaEditando] = useState<Proposta | null>(null);
  const [propostaVisualizando, setPropostaVisualizando] = useState<Proposta | null>(null);
  const [propostaDeletando, setPropostaDeletando] = useState<Proposta | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [itens, setItens] = useState<ItemProposta[]>([
    { descricao: "", quantidade: 1, valor_unitario: 0, total: 0 },
  ]);

  const scrollToInput = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [supabase]);

  async function carregarDados() {
    try {
      setCarregando(true);
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

      const [propostasRes, clientesRes] = await Promise.all([
        supabase
          .from("propostas")
          .select("*, cliente:clientes(nome), itens_proposta(*)")
          .eq("negocio_id", negocio.id)
          .order("criado_em", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome")
          .eq("negocio_id", negocio.id)
          .order("nome"),
      ]);

      setPropostas(propostasRes.data || []);
      setClientes(clientesRes.data || []);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }

  const propostasFiltradas = useMemo(() => {
    return propostas.filter((p) => {
      const buscaMatch =
        p.numero_proposta.toLowerCase().includes(busca.toLowerCase()) ||
        (p.cliente?.nome || "").toLowerCase().includes(busca.toLowerCase());
      const statusMatch = filtroStatus === "todos" || p.status === filtroStatus;
      return buscaMatch && statusMatch;
    });
  }, [propostas, busca, filtroStatus]);

  function abrirDialogNova() {
    setPropostaEditando(null);
    setForm(emptyForm);
    setItens([{ descricao: "", quantidade: 1, valor_unitario: 0, total: 0 }]);
    setDialogAberto(true);
  }

  function abrirDialogEditar(proposta: Proposta) {
    setPropostaEditando(proposta);
    setForm({
      cliente_id: proposta.cliente_id || "",
      validade: proposta.validade,
      desconto: proposta.desconto,
      frete: proposta.frete,
      condicoes_gerais: proposta.condicoes_gerais || "",
      observacoes: proposta.observacoes || "",
    });
    setItens(
      proposta.itens_proposta && proposta.itens_proposta.length > 0
        ? proposta.itens_proposta.map((item) => ({
            id: item.id,
            descricao: item.descricao,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            total: item.total,
          }))
        : [{ descricao: "", quantidade: 1, valor_unitario: 0, total: 0 }]
    );
    setDialogAberto(true);
  }

  function fecharDialog() {
    setDialogAberto(false);
    setPropostaEditando(null);
    setForm(emptyForm);
    setItens([{ descricao: "", quantidade: 1, valor_unitario: 0, total: 0 }]);
  }

  function atualizarItem(index: number, campo: keyof ItemProposta, valor: string | number) {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], [campo]: valor };
    if (campo === "quantidade" || campo === "valor_unitario") {
      novosItens[index].total =
        novosItens[index].quantidade * novosItens[index].valor_unitario;
    }
    setItens(novosItens);
  }

  function adicionarItem() {
    setItens([...itens, { descricao: "", quantidade: 1, valor_unitario: 0, total: 0 }]);
  }

  function removerItem(index: number) {
    if (itens.length > 1) {
      setItens(itens.filter((_, i) => i !== index));
    }
  }

  const subtotal = itens.reduce((acc, item) => acc + item.total, 0);
  const total = subtotal - form.desconto + form.frete;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      setSalvando(false);
      return;
    }

    const { data: negocio } = await supabase
      .from("negocios")
      .select("id")
      .eq("usuario_id", user.id)
      .single();

    if (!negocio) {
      toast.error("Negócio não encontrado.");
      setSalvando(false);
      return;
    }

    const payload = {
      negocio_id: negocio.id,
      cliente_id: form.cliente_id || null,
      validade: form.validade || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      subtotal,
      desconto: form.desconto,
      frete: form.frete,
      total,
      condicoes_gerais: form.condicoes_gerais || null,
      observacoes: form.observacoes || null,
    };

    if (propostaEditando) {
      const { error } = await supabase
        .from("propostas")
        .update(payload)
        .eq("id", propostaEditando.id);

      if (error) {
        toast.error("Erro ao atualizar orcamento.");
        setSalvando(false);
        return;
      }

      if (propostaEditando.itens_proposta && propostaEditando.itens_proposta.length > 0) {
        await supabase
          .from("itens_proposta")
          .delete()
          .eq("proposta_id", propostaEditando.id);
      }

      const itensParaInserir = itens
        .filter((item) => item.descricao)
        .map((item) => ({
          proposta_id: propostaEditando.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          total: item.total,
        }));

      if (itensParaInserir.length > 0) {
        await supabase.from("itens_proposta").insert(itensParaInserir);
      }

      toast.success("Orcamento atualizado com sucesso!");
    } else {
      const { data: proposta, error } = await supabase
        .from("propostas")
        .insert({
          ...payload,
          numero_proposta: gerarNumeroOrcamento(),
          status: "rascunho",
        })
        .select()
        .single();

      if (error) {
        toast.error("Erro ao criar orcamento.");
        setSalvando(false);
        return;
      }

      const itensParaInserir = itens
        .filter((item) => item.descricao)
        .map((item) => ({
          proposta_id: proposta.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          total: item.total,
        }));

      if (itensParaInserir.length > 0) {
        await supabase.from("itens_proposta").insert(itensParaInserir);
      }

      toast.success("Orcamento criado com sucesso!");
    }

    fecharDialog();
    setSalvando(false);
    carregarDados();
  }

  async function excluirProposta() {
    if (!propostaDeletando) return;
    try {
      await supabase.from("itens_proposta").delete().eq("proposta_id", propostaDeletando.id);

      const { error } = await supabase.from("propostas").delete().eq("id", propostaDeletando.id);

      if (error) {
        toast.error("Erro ao excluir orcamento.");
        return;
      }

      toast.success("Orcamento excluido com sucesso!");
      setPropostaDeletando(null);
      carregarDados();
    } catch {
      toast.error("Erro ao excluir orcamento.");
    }
  }

  async function enviarProposta(proposta: Proposta) {
    try {
      const { error } = await supabase
        .from("propostas")
        .update({ status: "enviada" })
        .eq("id", proposta.id);

      if (error) {
        toast.error("Erro ao enviar orcamento.");
        return;
      }

      toast.success("Orcamento enviado com sucesso!");
      carregarDados();
    } catch {
      toast.error("Erro ao enviar orcamento.");
    }
  }

  async function duplicarProposta(proposta: Proposta) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: negocio } = await supabase
        .from("negocios")
        .select("id")
        .eq("usuario_id", user.id)
        .single();

      if (!negocio) return;

      const { data: novaProposta, error } = await supabase
        .from("propostas")
        .insert({
          negocio_id: negocio.id,
          cliente_id: proposta.cliente_id,
          numero_proposta: gerarNumeroOrcamento(),
          validade: proposta.validade,
          status: "rascunho",
          subtotal: proposta.subtotal,
          desconto: proposta.desconto,
          frete: proposta.frete,
          total: proposta.total,
          condicoes_gerais: proposta.condicoes_gerais,
          observacoes: proposta.observacoes,
        })
        .select()
        .single();

      if (error) {
        toast.error("Erro ao duplicar orcamento.");
        return;
      }

      if (proposta.itens_proposta && proposta.itens_proposta.length > 0) {
        const novosItens = proposta.itens_proposta.map((item) => ({
          proposta_id: novaProposta.id,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          total: item.total,
        }));
        await supabase.from("itens_proposta").insert(novosItens);
      }

      toast.success("Orcamento duplicado com sucesso!");
      carregarDados();
    } catch {
      toast.error("Erro ao duplicar orcamento.");
    }
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orcamentos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus {propostas.length} orcamento{propostas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={abrirDialogNova} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Orcamento
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : propostasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-semibold">
              Nenhum orcamento encontrado
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {busca || filtroStatus !== "todos"
                ? "Tente buscar com outros termos ou filtros."
                : "Crie seu primeiro orcamento."}
            </p>
            {!busca && filtroStatus === "todos" && (
              <Button onClick={abrirDialogNova} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Orcamento
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
                    <TableHead>Numero</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {propostasFiltradas.map((proposta) => (
                      <motion.tr
                        key={proposta.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{proposta.numero_proposta}</span>
                          </div>
                        </TableCell>
                        <TableCell>{proposta.cliente?.nome || "Sem cliente"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Intl.DateTimeFormat("pt-BR").format(new Date(proposta.validade))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatarMoeda(proposta.total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant[proposta.status] || "secondary"}>
                            {statusLabel[proposta.status] || proposta.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPropostaVisualizando(proposta)}
                              title="Visualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {proposta.status === "rascunho" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => abrirDialogEditar(proposta)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {proposta.status === "rascunho" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => enviarProposta(proposta)}
                                title="Enviar"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => duplicarProposta(proposta)}
                              title="Duplicar"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <AlertDialog
                              open={propostaDeletando?.id === proposta.id}
                              onOpenChange={(open) => {
                                if (!open) setPropostaDeletando(null);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setPropostaDeletando(proposta)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir orcamento</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir o orcamento{" "}
                                    <strong>{proposta.numero_proposta}</strong>? Esta acao nao
                                    pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={excluirProposta}
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
              {propostasFiltradas.map((proposta) => (
                <motion.div
                  key={proposta.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">
                              {proposta.numero_proposta}
                            </CardTitle>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {proposta.cliente?.nome || "Sem cliente"}
                          </p>
                        </div>
                        <Badge
                          variant={statusBadgeVariant[proposta.status] || "secondary"}
                          className="text-xs"
                        >
                          {statusLabel[proposta.status] || proposta.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          Valido ate{" "}
                          {new Intl.DateTimeFormat("pt-BR").format(
                            new Date(proposta.validade)
                          )}
                        </div>
                        <span className="font-bold">{formatarMoeda(proposta.total)}</span>
                      </div>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => setPropostaVisualizando(proposta)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {proposta.status === "rascunho" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => abrirDialogEditar(proposta)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {proposta.status === "rascunho" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-blue-600 hover:text-blue-700"
                            onClick={() => enviarProposta(proposta)}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => duplicarProposta(proposta)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog
                          open={propostaDeletando?.id === proposta.id}
                          onOpenChange={(open) => {
                            if (!open) setPropostaDeletando(null);
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 text-destructive hover:text-destructive"
                              onClick={() => setPropostaDeletando(proposta)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir orcamento</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o orcamento{" "}
                                <strong>{proposta.numero_proposta}</strong>? Esta acao nao pode
                                ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={excluirProposta}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {propostaEditando ? "Editar Orcamento" : "Novo Orcamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <Select
                  value={form.cliente_id}
                  onValueChange={(v) => setForm({ ...form, cliente_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={form.validade}
                  onChange={(e) => setForm({ ...form, validade: e.target.value })}
                  onFocus={scrollToInput}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={adicionarItem}
                  className="gap-1 text-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar item
                </Button>
              </div>
              <div className="space-y-2">
                {itens.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Descricao"
                        value={item.descricao}
                        onChange={(e) => atualizarItem(index, "descricao", e.target.value)}
                        onFocus={scrollToInput}
                        className="flex-1 min-w-0"
                      />
                      {itens.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removerItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Qtd"
                        value={item.quantidade}
                        onChange={(e) =>
                          atualizarItem(index, "quantidade", parseInt(e.target.value) || 0)
                        }
                        onFocus={scrollToInput}
                        className="w-20"
                        min={0}
                      />
                      <Input
                        type="number"
                        placeholder="Valor unitario"
                        value={item.valor_unitario || ""}
                        onChange={(e) =>
                          atualizarItem(
                            index,
                            "valor_unitario",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        onFocus={scrollToInput}
                        className="w-28"
                        min={0}
                        step={0.01}
                      />
                      <span className="flex items-center whitespace-nowrap text-sm text-muted-foreground">
                        {formatarMoeda(item.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  value={form.desconto || ""}
                  onChange={(e) =>
                    setForm({ ...form, desconto: parseFloat(e.target.value) || 0 })
                  }
                  onFocus={scrollToInput}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="space-y-2">
                <Label>Frete (R$)</Label>
                <Input
                  type="number"
                  value={form.frete || ""}
                  onChange={(e) =>
                    setForm({ ...form, frete: parseFloat(e.target.value) || 0 })
                  }
                  onFocus={scrollToInput}
                  min={0}
                  step={0.01}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Condicoes Gerais</Label>
              <Textarea
                value={form.condicoes_gerais}
                onChange={(e) =>
                  setForm({ ...form, condicoes_gerais: e.target.value })
                }
                onFocus={scrollToInput}
                placeholder="Prazo de pagamento, garantia, etc."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) =>
                  setForm({ ...form, observacoes: e.target.value })
                }
                onFocus={scrollToInput}
                placeholder="Observacoes internas..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Total do Orcamento
              </div>
              <span className="text-xl font-bold">
                {formatarMoeda(total)}
              </span>
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
                  : propostaEditando
                    ? "Salvar Alteracoes"
                    : "Criar Orcamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!propostaVisualizando}
        onOpenChange={(open) => {
          if (!open) setPropostaVisualizando(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {propostaVisualizando?.numero_proposta}
            </DialogTitle>
          </DialogHeader>
          {propostaVisualizando && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">
                    {propostaVisualizando.cliente?.nome || "Sem cliente"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      statusBadgeVariant[propostaVisualizando.status] || "secondary"
                    }
                  >
                    {statusLabel[propostaVisualizando.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Validade</p>
                  <p className="font-medium">
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(propostaVisualizando.validade)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(propostaVisualizando.criado_em)
                    )}
                  </p>
                </div>
              </div>

              {propostaVisualizando.itens_proposta &&
                propostaVisualizando.itens_proposta.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Itens</p>
                    <div className="space-y-1.5">
                      {propostaVisualizando.itens_proposta.map((item, i) => (
                        <div
                          key={item.id || i}
                          className="flex items-center justify-between rounded-md border p-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{item.descricao}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantidade} x {formatarMoeda(item.valor_unitario)}
                            </p>
                          </div>
                          <span className="ml-4 font-semibold">
                            {formatarMoeda(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {propostaVisualizando.condicoes_gerais && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Condicoes Gerais
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {propostaVisualizando.condicoes_gerais}
                  </p>
                </div>
              )}

              {propostaVisualizando.observacoes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Observacoes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {propostaVisualizando.observacoes}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatarMoeda(propostaVisualizando.subtotal)}</span>
                </div>
                {propostaVisualizando.desconto > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Desconto</span>
                    <span>- {formatarMoeda(propostaVisualizando.desconto)}</span>
                  </div>
                )}
                {propostaVisualizando.frete > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span>+ {formatarMoeda(propostaVisualizando.frete)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5 text-base font-bold">
                  <span>Total</span>
                  <span>{formatarMoeda(propostaVisualizando.total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPropostaVisualizando(null)}>
                  Fechar
                </Button>
                {propostaVisualizando.status === "rascunho" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPropostaVisualizando(null);
                        abrirDialogEditar(propostaVisualizando);
                      }}
                      className="gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      onClick={() => {
                        setPropostaVisualizando(null);
                        enviarProposta(propostaVisualizando);
                      }}
                      className="gap-2"
                    >
                      <Send className="h-4 w-4" />
                      Enviar
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
