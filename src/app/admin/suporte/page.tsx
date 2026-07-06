"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  User,
  Tag,
  StickyNote,
  Loader2,
  Search,
  RefreshCw,
  CircleDot,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { formatarDataHora } from "@/utils";
import {
  listarTickets,
  obterMensagensTicket,
  atualizarTicket,
  enviarMensagemSuporte,
} from "@/services/admin.service";
import type { TicketSuporte } from "@/types/admin";

const STATUS_TABS = [
  { value: "todos", label: "Todos", icon: MessageSquare },
  { value: "aberto", label: "Abertos", icon: CircleDot },
  { value: "em_andamento", label: "Em Andamento", icon: Clock },
  { value: "respondido", label: "Respondidos", icon: Send },
  { value: "resolvido", label: "Resolvidos", icon: CheckCircle2 },
  { value: "fechado", label: "Fechados", icon: XCircle },
] as const;

type StatusKey = (typeof STATUS_TABS)[number]["value"];

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  aberto: {
    label: "Aberto",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    icon: CircleDot,
  },
  em_andamento: {
    label: "Em Andamento",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  respondido: {
    label: "Respondido",
    className: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Send,
  },
  resolvido: {
    label: "Resolvido",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  fechado: {
    label: "Fechado",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: XCircle,
  },
};

const PRIORIDADE_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  baixa: {
    label: "Baixa",
    className: "bg-sky-100 text-sky-700 border-sky-200",
  },
  normal: {
    label: "Normal",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  alta: {
    label: "Alta",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  urgente: {
    label: "Urgente",
    className: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

export default function AdminSuportePage() {
  const [tickets, setTickets] = useState<TicketSuporte[]>([]);
  const [filtro, setFiltro] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<StatusKey>("todos");
  const [ticketSel, setTicketSel] = useState<TicketSuporte | null>(null);
  const [resposta, setResposta] = useState("");
  const [notasInternas, setNotasInternas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const data = await listarTickets();
      setTickets(data);
    } catch {
      console.error("Erro ao carregar tickets");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [ticketSel?.mensagens?.length]);

  const selecionarTicket = useCallback(async (ticket: TicketSuporte) => {
    setTicketSel(ticket);
    setNotasInternas(ticket.notas_internas || "");
    try {
      const mensagens = await obterMensagensTicket(ticket.id);
      setTicketSel((prev) => prev?.id === ticket.id ? { ...prev, mensagens } : prev);
    } catch {
      console.error("Erro ao carregar mensagens do ticket");
    }
  }, []);

  const ticketsFiltrados = tickets.filter((t) => {
    const matchAba = abaAtiva === "todos" || t.status === abaAtiva;
    const matchBusca =
      !filtro ||
      t.assunto.toLowerCase().includes(filtro.toLowerCase()) ||
      t.usuario?.nome?.toLowerCase().includes(filtro.toLowerCase()) ||
      t.usuario?.email?.toLowerCase().includes(filtro.toLowerCase());
    return matchAba && matchBusca;
  });

  const contagem = (status: string) => {
    if (status === "todos") return tickets.length;
    return tickets.filter((t) => t.status === status).length;
  };

  const handleEnviarResposta = async () => {
    if (!resposta.trim() || !ticketSel) return;
    try {
      setEnviando(true);
      await enviarMensagemSuporte(ticketSel.id, resposta.trim());
      setResposta("");
      const mensagens = await obterMensagensTicket(ticketSel.id);
      setTicketSel((prev) => prev?.id === ticketSel.id ? { ...prev, mensagens } : prev);
    } catch {
      console.error("Erro ao enviar resposta");
    } finally {
      setEnviando(false);
    }
  };

  const handleSalvarNotas = async () => {
    if (!ticketSel) return;
    try {
      await atualizarTicket(ticketSel.id, { notas_internas: notasInternas });
      setTicketSel({ ...ticketSel, notas_internas: notasInternas });
    } catch {
      console.error("Erro ao salvar notas");
    }
  };

  const handleMudarStatus = async (novoStatus: string) => {
    if (!ticketSel) return;
    try {
      await atualizarTicket(ticketSel.id, {
        status: novoStatus as TicketSuporte["status"],
      });
      setTicketSel({
        ...ticketSel,
        status: novoStatus as TicketSuporte["status"],
      });
      await carregar();
    } catch {
      console.error("Erro ao atualizar status");
    }
  };

  if (carregando) {
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

  if (ticketSel) {
    const statusConf = STATUS_CONFIG[ticketSel.status] || STATUS_CONFIG.aberto;
    const StatusIcon = statusConf.icon;

    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTicketSel(null);
              setResposta("");
              setNotasInternas("");
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              {ticketSel.assunto}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {ticketSel.usuario?.nome || "N/A"}
              <span className="text-muted-foreground/50">|</span>
              <Tag className="h-3.5 w-3.5" />
              <Badge variant="outline" className={statusConf.className}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {statusConf.label}
              </Badge>
              <Badge
                variant="outline"
                className={
                  PRIORIDADE_CONFIG[ticketSel.prioridade]?.className || ""
                }
              >
                {PRIORIDADE_CONFIG[ticketSel.prioridade]?.label ||
                  ticketSel.prioridade}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversa</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  ref={scrollRef}
                  className="max-h-[400px] overflow-y-auto space-y-3"
                >
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="rounded-full bg-blue-100 p-1">
                        <User className="h-3 w-3 text-blue-600" />
                      </div>
                      <span className="text-xs font-medium">
                        {ticketSel.usuario?.nome || "Usuario"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatarDataHora(ticketSel.criado_em)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {ticketSel.mensagem}
                    </p>
                  </div>

                  {ticketSel.mensagens?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-3 ${
                        msg.remetente_tipo === "admin"
                          ? "bg-indigo-50 border-indigo-200"
                          : msg.remetente_tipo === "sistema"
                            ? "bg-amber-50 border-amber-200"
                            : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`rounded-full p-1 ${
                            msg.remetente_tipo === "admin"
                              ? "bg-indigo-100"
                              : "bg-gray-100"
                          }`}
                        >
                          {msg.remetente_tipo === "admin" ? (
                            <StickyNote className="h-3 w-3 text-indigo-600" />
                          ) : (
                            <User className="h-3 w-3 text-gray-600" />
                          )}
                        </div>
                        <span className="text-xs font-medium">
                          {msg.remetente_tipo === "admin"
                            ? "Suporte"
                            : msg.remetente_tipo === "sistema"
                              ? "Sistema"
                              : ticketSel.usuario?.nome || "Usuario"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatarDataHora(msg.criado_em)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.mensagem}
                      </p>
                    </div>
                  ))}
                </div>

                {ticketSel.status !== "fechado" && (
                  <div className="mt-4 space-y-2">
                    <Textarea
                      placeholder="Digite sua resposta..."
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleEnviarResposta}
                        disabled={!resposta.trim() || enviando}
                        size="sm"
                      >
                        {enviando ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Enviar Resposta
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acoes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Status
                  </label>
                  <Select
                    value={ticketSel.status}
                    onValueChange={handleMudarStatus}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                        <SelectItem key={key} value={key}>
                          {conf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Prioridade
                  </label>
                  <Badge
                    variant="outline"
                    className={
                      PRIORIDADE_CONFIG[ticketSel.prioridade]?.className
                    }
                  >
                    {PRIORIDADE_CONFIG[ticketSel.prioridade]?.label}
                  </Badge>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Categoria
                  </label>
                  <p className="text-sm">{ticketSel.categoria || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Criado em
                  </label>
                  <p className="text-sm">
                    {formatarDataHora(ticketSel.criado_em)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas Internas</CardTitle>
                <CardDescription>Visiveis apenas para admins</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="Adicione notas internas..."
                  value={notasInternas || ticketSel.notas_internas || ""}
                  onChange={(e) => setNotasInternas(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSalvarNotas}
                  className="w-full"
                >
                  Salvar Notas
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
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
          <h1 className="text-2xl font-bold tracking-tight">Suporte</h1>
          <p className="text-muted-foreground">
            Gerencie tickets de suporte dos usuarios
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </motion.div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por assunto, usuario ou email..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Tabs
        value={abaAtiva}
        onValueChange={(v) => setAbaAtiva(v as StatusKey)}
      >
        <TabsList className="flex w-full overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {contagem(tab.value)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <Card>
              <CardContent className="p-0">
                {ticketsFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum ticket encontrado
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {ticketsFiltrados.map((ticket) => {
                      const stConf =
                        STATUS_CONFIG[ticket.status] || STATUS_CONFIG.aberto;
                      const StIcon = stConf.icon;
                      const prConf =
                        PRIORIDADE_CONFIG[ticket.prioridade] ||
                        PRIORIDADE_CONFIG.normal;

                      return (
                        <motion.div
                          key={ticket.id}
                          className="flex items-center gap-4 p-4 cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => selecionarTicket(ticket)}
                          whileHover={{ x: 4 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="shrink-0 rounded-full bg-muted p-2.5">
                            <MessageSquare className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {ticket.assunto}
                              </p>
                              <Badge
                                variant="outline"
                                className={`${prConf.className} text-[10px]`}
                              >
                                {prConf.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <User className="h-3 w-3" />
                              <span className="truncate">
                                {ticket.usuario?.nome || "N/A"}
                              </span>
                              <span className="text-muted-foreground/30">
                                &bull;
                              </span>
                              <span className="truncate">
                                {ticket.usuario?.email || ""}
                              </span>
                            </div>
                            {ticket.mensagens && ticket.mensagens.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {ticket.mensagens[ticket.mensagens.length - 1]
                                  .mensagem || ""}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <Badge
                              variant="outline"
                              className={`${stConf.className} text-[10px]`}
                            >
                              <StIcon className="mr-1 h-3 w-3" />
                              {stConf.label}
                            </Badge>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {formatarDataHora(ticket.criado_em)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
