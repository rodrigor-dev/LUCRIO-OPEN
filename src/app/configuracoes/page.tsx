"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda, diasRestantes } from "@/utils";
import type { Usuario, Negocio, Assinatura } from "@/types/database";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Building,
  Bell,
  CreditCard,
  HelpCircle,
  Save,
  Camera,
  Mail,
  Phone,
  MapPin,
  FileText,
  MessageCircle,
  Smartphone,
  ChevronRight,
  ExternalLink,
  Loader2,
  Crown,
  Clock,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  Settings,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-36" />
        </CardContent>
      </Card>
    </div>
  );
}

function BusinessSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
        <Skeleton className="h-10 w-24" />
      </CardContent>
    </Card>
  );
}

function NotificationsSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SubscriptionSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-44" />
        </div>
      </CardContent>
    </Card>
  );
}

function HelpSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
        <Skeleton className="h-10 w-36" />
      </CardContent>
    </Card>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        <span>{question}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 text-sm text-muted-foreground">{answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const tabContentVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.15 } },
};

export default function ConfiguracoesPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoNegocio, setSalvandoNegocio] = useState(false);

  const [perfil, setPerfil] = useState({ nome: "", telefone: "" });
  const [negocioForm, setNegocioForm] = useState({
    nome: "",
    cnpj_cpf: "",
    telefone: "",
    email: "",
    endereco: {
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    },
  });
  const [notificacoes, setNotificacoes] = useState({
    emailLembretes: true,
    alertasVencimento: true,
    novidades: false,
  });
  const [activeTab, setActiveTab] = useState("perfil");

  useEffect(() => {
    async function carregarDados() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: negocioData } = await supabase
        .from("negocios")
        .select("*")
        .eq("usuario_id", user.id)
        .single();

      const { data: assinaturaData } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("usuario_id", user.id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .single();

      setUsuario(usuarioData);
      setNegocio(negocioData);
      setAssinatura(assinaturaData);

      if (usuarioData) {
        setPerfil({ nome: usuarioData.nome || "", telefone: usuarioData.telefone || "" });
      }

      if (negocioData) {
        setNegocioForm({
          nome: negocioData.nome || "",
          cnpj_cpf: negocioData.cnpj_cpf || "",
          telefone: negocioData.telefone || "",
          email: negocioData.email || "",
          endereco: {
            rua: negocioData.endereco?.rua || "",
            numero: negocioData.endereco?.numero || "",
            complemento: negocioData.endereco?.complemento || "",
            bairro: negocioData.endereco?.bairro || "",
            cidade: negocioData.endereco?.cidade || "",
            estado: negocioData.endereco?.estado || "",
            cep: negocioData.endereco?.cep || "",
          },
        });
      }

      setCarregando(false);
    }

    carregarDados();
  }, [supabase, router]);

  async function salvarPerfil() {
    if (!usuario) return;
    setSalvandoPerfil(true);

    const { error } = await supabase
      .from("usuarios")
      .update({ nome: perfil.nome, telefone: perfil.telefone })
      .eq("id", usuario.id);

    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      setUsuario({ ...usuario, nome: perfil.nome, telefone: perfil.telefone });
      toast.success("Perfil salvo com sucesso");
    }

    setSalvandoPerfil(false);
  }

  async function salvarDadosNegocio() {
    if (!negocio) return;
    setSalvandoNegocio(true);

    const { error } = await supabase
      .from("negocios")
      .update({
        nome: negocioForm.nome,
        cnpj_cpf: negocioForm.cnpj_cpf,
        telefone: negocioForm.telefone,
        email: negocioForm.email,
        endereco: negocioForm.endereco,
      })
      .eq("id", negocio.id);

    if (error) {
      toast.error("Erro ao salvar dados do negócio");
    } else {
      setNegocio({ ...negocio, ...negocioForm });
      toast.success("Dados do negócio salvos com sucesso");
    }

    setSalvandoNegocio(false);
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  const diasTrial = assinatura?.trial_termina
    ? diasRestantes(assinatura.trial_termina)
    : 0;

  const planName =
    assinatura?.status === "trial"
      ? "Período de Teste"
      : assinatura?.status === "ativo"
      ? "Plano Pro"
      : "Sem Plano";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie sua conta, notificações e dados do negócio
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex w-full sm:w-auto">
              <TabsTrigger value="perfil" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Perfil</span>
              </TabsTrigger>
              <TabsTrigger value="negocio" className="gap-2">
                <Building className="h-4 w-4" />
                <span className="hidden sm:inline">Negócio</span>
              </TabsTrigger>
              <TabsTrigger value="notificacoes" className="gap-2">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Notificações</span>
              </TabsTrigger>
              <TabsTrigger value="assinatura" className="gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Assinatura</span>
              </TabsTrigger>
              <TabsTrigger value="ajuda" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Ajuda</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ==================== PERFIL ==================== */}
          <TabsContent value="perfil">
            <AnimatePresence mode="wait">
              {carregando ? (
                <ProfileSkeleton />
              ) : (
                <motion.div
                  key="perfil"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-6"
                >
                  {/* Avatar Card */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative group">
                          <Avatar className="h-20 w-20 border-2 border-border">
                            <AvatarImage src={usuario?.avatar_url} alt={perfil.nome} />
                            <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                              {getInitials(perfil.nome || "U")}
                            </AvatarFallback>
                          </Avatar>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={() => toast.info("Upload de avatar em breve")}
                          />
                        </div>
                        <div className="text-center sm:text-left">
                          <h3 className="text-lg font-semibold">{perfil.nome}</h3>
                          <p className="text-sm text-muted-foreground">{usuario?.email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Membro desde {new Date(usuario?.criado_em || "").toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Personal Data Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dados Pessoais</CardTitle>
                      <CardDescription>Atualize suas informações pessoais</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="nome" className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            Nome
                          </Label>
                          <Input
                            id="nome"
                            value={perfil.nome}
                            onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
                            placeholder="Seu nome completo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email-perfil" className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            E-mail
                          </Label>
                          <Input
                            id="email-perfil"
                            value={usuario?.email || ""}
                            readOnly
                            disabled
                            className="bg-muted cursor-not-allowed"
                          />
                          <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telefone-perfil" className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          Telefone
                        </Label>
                        <Input
                          id="telefone-perfil"
                          value={perfil.telefone}
                          onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          className="max-w-sm"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={salvarPerfil} disabled={salvandoPerfil}>
                          {salvandoPerfil ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Salvar Alterações
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ==================== NEGÓCIO ==================== */}
          <TabsContent value="negocio">
            <AnimatePresence mode="wait">
              {carregando ? (
                <BusinessSkeleton />
              ) : (
                <motion.div
                  key="negocio"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dados do Negócio</CardTitle>
                      <CardDescription>Informações do seu estabelecimento</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* Logo Upload */}
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/50">
                          {negocio?.logo_url ? (
                            <img src={negocio.logo_url} alt="Logo" className="h-14 w-14 rounded-lg object-cover" />
                          ) : (
                            <Building className="h-6 w-6 text-muted-foreground/50" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">Logo do Negócio</p>
                          <p className="text-xs text-muted-foreground">PNG ou JPG (máx. 2MB)</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => toast.info("Upload de logo em breve")}
                          >
                            <Camera className="mr-2 h-3.5 w-3.5" />
                            Escolher arquivo
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Business Info */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="nome-negocio">Nome do Negócio</Label>
                          <Input
                            id="nome-negocio"
                            value={negocioForm.nome}
                            onChange={(e) => setNegocioForm({ ...negocioForm, nome: e.target.value })}
                            placeholder="Minha Empresa LTDA"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cnpj-cpf">CNPJ / CPF</Label>
                          <Input
                            id="cnpj-cpf"
                            value={negocioForm.cnpj_cpf}
                            onChange={(e) => setNegocioForm({ ...negocioForm, cnpj_cpf: e.target.value })}
                            placeholder="00.000.000/0001-00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="telefone-negocio">Telefone</Label>
                          <Input
                            id="telefone-negocio"
                            value={negocioForm.telefone}
                            onChange={(e) => setNegocioForm({ ...negocioForm, telefone: e.target.value })}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email-negocio">E-mail</Label>
                          <Input
                            id="email-negocio"
                            value={negocioForm.email}
                            onChange={(e) => setNegocioForm({ ...negocioForm, email: e.target.value })}
                            placeholder="contato@negocio.com"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Address */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          Endereço
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="rua">Rua / Logradouro</Label>
                            <Input
                              id="rua"
                              value={negocioForm.endereco.rua}
                              onChange={(e) =>
                                setNegocioForm({
                                  ...negocioForm,
                                  endereco: { ...negocioForm.endereco, rua: e.target.value },
                                })
                              }
                              placeholder="Rua das Flores, 123"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="numero">Número</Label>
                            <Input
                              id="numero"
                              value={negocioForm.endereco.numero}
                              onChange={(e) =>
                                setNegocioForm({
                                  ...negocioForm,
                                  endereco: { ...negocioForm.endereco, numero: e.target.value },
                                })
                              }
                              placeholder="123"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="complemento">Complemento</Label>
                            <Input
                              id="complemento"
                              value={negocioForm.endereco.complemento}
                              onChange={(e) =>
                                setNegocioForm({
                                  ...negocioForm,
                                  endereco: { ...negocioForm.endereco, complemento: e.target.value },
                                })
                              }
                              placeholder="Sala 1"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="bairro">Bairro</Label>
                            <Input
                              id="bairro"
                              value={negocioForm.endereco.bairro}
                              onChange={(e) =>
                                setNegocioForm({
                                  ...negocioForm,
                                  endereco: { ...negocioForm.endereco, bairro: e.target.value },
                                })
                              }
                              placeholder="Centro"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cidade">Cidade</Label>
                            <Input
                              id="cidade"
                              value={negocioForm.endereco.cidade}
                              onChange={(e) =>
                                setNegocioForm({
                                  ...negocioForm,
                                  endereco: { ...negocioForm.endereco, cidade: e.target.value },
                                })
                              }
                              placeholder="São Paulo"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="estado">Estado</Label>
                            <Input
                              id="estado"
                              value={negocioForm.endereco.estado}
                              onChange={(e) =>
                                setNegocioForm({
                                  ...negocioForm,
                                  endereco: { ...negocioForm.endereco, estado: e.target.value },
                                })
                              }
                              placeholder="SP"
                              className="max-w-[80px]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cep">CEP</Label>
                            <Input
                              id="cep"
                              value={negocioForm.endereco.cep}
                              onChange={(e) =>
                                setNegocioForm({
                                  ...negocioForm,
                                  endereco: { ...negocioForm.endereco, cep: e.target.value },
                                })
                              }
                              placeholder="00000-000"
                              className="max-w-[140px]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={salvarDadosNegocio} disabled={salvandoNegocio}>
                          {salvandoNegocio ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Salvar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ==================== NOTIFICAÇÕES ==================== */}
          <TabsContent value="notificacoes">
            <AnimatePresence mode="wait">
              {carregando ? (
                <NotificationsSkeleton />
              ) : (
                <motion.div
                  key="notificacoes"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Preferências de Notificação</CardTitle>
                      <CardDescription>Escolha quais notificações deseja receber</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {/* Email de lembretes */}
                      <div className="flex items-center justify-between py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">E-mail de lembretes</p>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            Receba lembretes de sessões agendadas e pendências
                          </p>
                        </div>
                        <Switch
                          checked={notificacoes.emailLembretes}
                          onCheckedChange={(checked) =>
                            setNotificacoes({ ...notificacoes, emailLembretes: checked })
                          }
                        />
                      </div>
                      <Separator />

                      {/* Alertas de vencimento */}
                      <div className="flex items-center justify-between py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Alertas de vencimento</p>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            Seja notificado sobre pagamentos pendentes e vencimentos
                          </p>
                        </div>
                        <Switch
                          checked={notificacoes.alertasVencimento}
                          onCheckedChange={(checked) =>
                            setNotificacoes({ ...notificacoes, alertasVencimento: checked })
                          }
                        />
                      </div>
                      <Separator />

                      {/* Novidades */}
                      <div className="flex items-center justify-between py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm font-medium">Novidades</p>
                          </div>
                          <p className="text-xs text-muted-foreground pl-6">
                            Receba informações sobre novidades e atualizações do sistema
                          </p>
                        </div>
                        <Switch
                          checked={notificacoes.novidades}
                          onCheckedChange={(checked) =>
                            setNotificacoes({ ...notificacoes, novidades: checked })
                          }
                        />
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button
                          onClick={() => toast.success("Preferências salvas")}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Salvar Preferências
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ==================== ASSINATURA ==================== */}
          <TabsContent value="assinatura">
            <AnimatePresence mode="wait">
              {carregando ? (
                <SubscriptionSkeleton />
              ) : (
                <motion.div
                  key="assinatura"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-6"
                >
                  {/* Current Plan */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Plano Atual</CardTitle>
                      <CardDescription>Detalhes da sua assinatura</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                          <Crown className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{planName}</p>
                          <p className="text-sm text-muted-foreground">
                            {assinatura?.status === "trial"
                              ? "Acesso completo durante o período de teste"
                              : assinatura?.status === "ativo"
                              ? "Acesso completo a todas as funcionalidades"
                              : "Assine um plano para acessar todas as funcionalidades"}
                          </p>
                        </div>
                      </div>

                      {assinatura?.status === "trial" && diasTrial > 0 && (
                        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-4">
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <Clock className="h-4 w-4" />
                            <p className="text-sm font-medium">
                              Período de teste: <strong>{diasTrial}</strong> dias restantes
                            </p>
                          </div>
                          <div className="mt-2 h-2 w-full rounded-full bg-amber-200 dark:bg-amber-800">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all"
                              style={{ width: `${Math.min(100, (diasTrial / 14) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {assinatura?.status === "trial" && diasTrial <= 0 && (
                        <div className="rounded-lg border bg-destructive/10 p-4">
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <p className="text-sm font-medium">
                              Seu período de teste expirou. Assine um plano para continuar.
                            </p>
                          </div>
                        </div>
                      )}

                      {assinatura && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Início do período</p>
                            <p className="font-medium">
                              {new Date(assinatura.inicio_periodo).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Fim do período</p>
                            <p className="font-medium">
                              {new Date(assinatura.fim_periodo).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      )}

                      <Separator />

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={() => toast.info("Gerenciamento de assinatura em breve")}>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Gerenciar Assinatura
                        </Button>
                        <Button
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => toast.info("Cancelamento de assinatura em breve")}
                        >
                          Cancelar Assinatura
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ==================== AJUDA ==================== */}
          <TabsContent value="ajuda">
            <AnimatePresence mode="wait">
              {carregando ? (
                <HelpSkeleton />
              ) : (
                <motion.div
                  key="ajuda"
                  variants={tabContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-6"
                >
                  {/* FAQ */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        Perguntas Frequentes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <FaqItem
                        question="Como cadastrar um novo cliente?"
                        answer="Vá até a página de Clientes e clique em 'Novo Cliente'. Preencha os dados e salve."
                      />
                      <FaqItem
                        question="Como registrar uma receita?"
                        answer="Na página de Receitas, clique em 'Nova Receita', preencha os detalhes e confirme."
                      />
                      <FaqItem
                        question="Posso usar o sistema no celular?"
                        answer="Sim! O LUCRIO é um PWA e pode ser instalado no seu celular pela tela de Configurações > Ajuda."
                      />
                      <FaqItem
                        question="Como gerar uma proposta comercial?"
                        answer="Acesse a página de Propostas, clique em 'Nova Proposta', adicione os itens e gere o PDF."
                      />
                      <FaqItem
                        question="Como cancelar minha assinatura?"
                        answer="Acesse Configurações > Assinatura e clique em 'Cancelar Assinatura'. O cancelamento será efetivado ao final do período."
                      />
                    </CardContent>
                  </Card>

                  {/* Quick Links */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recursos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <a
                        href="https://docs.lucrio.com.br"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border p-4 text-sm font-medium hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p>Documentação</p>
                            <p className="text-xs text-muted-foreground font-normal">
                              Guias completos e tutoriais
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>

                      <button
                        onClick={() => toast.info("Suporte em breve")}
                        className="flex w-full items-center justify-between rounded-lg border p-4 text-sm font-medium hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <MessageCircle className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <p>Suporte</p>
                            <p className="text-xs text-muted-foreground font-normal">
                              Fale com nossa equipe de suporte
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>

                      <button
                        onClick={() => {
                          const installPrompt = (window as unknown as { deferredInstallPrompt?: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } }).deferredInstallPrompt;
                          if (installPrompt) {
                            installPrompt.prompt();
                            installPrompt.userChoice.then((choice) => {
                              if (choice.outcome === "accepted") {
                                toast.success("App instalado com sucesso!");
                              }
                            });
                          } else {
                            toast.info(
                              "Para instalar, acesse o menu do navegador e selecione 'Instalar app'"
                            );
                          }
                        }}
                        className="flex w-full items-center justify-between rounded-lg border p-4 text-sm font-medium hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <p>Tutorial PWA</p>
                            <p className="text-xs text-muted-foreground font-normal">
                              Instale o LUCRIO no seu dispositivo
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
