"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  Loader2,
  Palette,
  Globe,
  Link2,
  Settings,
  Share2,
  Eye,
  Wrench,
  RotateCcw,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  listarConfiguracoes,
  salvarConfiguracao,
} from "@/services/admin.service";
import type { ConfiguracaoGlobal } from "@/types/admin";

interface ConfigMap {
  [chave: string]: string;
}

function ConfigSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminConfiguracoesPage() {
  const [configs, setConfigs] = useState<ConfigMap>({});
  const [configsRaw, setConfigsRaw] = useState<ConfiguracaoGlobal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("geral");

  const carregarDados = useCallback(async () => {
    try {
      const data = await listarConfiguracoes();
      setConfigsRaw(data);
      const map: ConfigMap = {};
      data.forEach((c) => {
        map[c.chave] = c.valor || "";
      });
      setConfigs(map);
    } catch {
      toast.error("Erro ao carregar configuracoes");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const updateConfig = (chave: string, valor: string) => {
    setConfigs((prev) => ({ ...prev, [chave]: valor }));
  };

  const handleSalvar = async (chaves: string[]) => {
    const chavePrimaria = chaves[0];
    setSalvando(chavePrimaria);
    try {
      for (const chave of chaves) {
        if (configs[chave] !== undefined) {
          await salvarConfiguracao(chave, configs[chave]);
        }
      }
      toast.success("Configuracoes salvas com sucesso");
      await carregarDados();
    } catch {
      toast.error("Erro ao salvar configuracoes");
    } finally {
      setSalvando(null);
    }
  };

  const getColorValue = (chave: string) => {
    return configs[chave] || "#6366f1";
  };

  if (carregando) return <ConfigSkeleton />;

  const sections = [
    {
      id: "geral",
      label: "Geral",
      icon: Settings,
      title: "Configuracoes Gerais",
      description: "Informacoes basicas do aplicativo",
    },
    {
      id: "aparencia",
      label: "Aparencia",
      icon: Palette,
      title: "Aparencia",
      description: "Visual e identidade do app",
    },
    {
      id: "urls",
      label: "URLs",
      icon: Link2,
      title: "URLs e Contato",
      description: "Links uteis e informacoes de contato",
    },
    {
      id: "sistema",
      label: "Sistema",
      icon: Wrench,
      title: "Sistema",
      description: "Configuracoes tecnicas do sistema",
    },
    {
      id: "redes",
      label: "Redes Sociais",
      icon: Share2,
      title: "Redes Sociais",
      description: "Links das redes sociais",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuracoes</h1>
        <p className="text-muted-foreground">
          Gerencie as configuracoes globais do sistema
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {sections.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuracoes Gerais
                </CardTitle>
                <CardDescription>
                  Informacoes basicas do aplicativo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do App</Label>
                    <Input
                      value={configs.app_name || ""}
                      onChange={(e) => updateConfig("app_name", e.target.value)}
                      placeholder="FATURION"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Input
                      value={configs.app_moeda || ""}
                      onChange={(e) => updateConfig("app_moeda", e.target.value)}
                      placeholder="BRL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Input
                      value={configs.app_idioma || ""}
                      onChange={(e) => updateConfig("app_idioma", e.target.value)}
                      placeholder="pt-BR"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fuso Horario</Label>
                    <Input
                      value={configs.app_fuso_horario || ""}
                      onChange={(e) =>
                        updateConfig("app_fuso_horario", e.target.value)
                      }
                      placeholder="America/Sao_Paulo"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cor Primaria</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getColorValue("app_cor_primaria")}
                        onChange={(e) =>
                          updateConfig("app_cor_primaria", e.target.value)
                        }
                        className="h-10 w-14 cursor-pointer rounded border"
                      />
                      <Input
                        value={configs.app_cor_primaria || ""}
                        onChange={(e) =>
                          updateConfig("app_cor_primaria", e.target.value)
                        }
                        placeholder="#6366f1"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundaria</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getColorValue("app_cor_secundaria")}
                        onChange={(e) =>
                          updateConfig("app_cor_secundaria", e.target.value)
                        }
                        className="h-10 w-14 cursor-pointer rounded border"
                      />
                      <Input
                        value={configs.app_cor_secundaria || ""}
                        onChange={(e) =>
                          updateConfig("app_cor_secundaria", e.target.value)
                        }
                        placeholder="#22c55e"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      handleSalvar([
                        "app_name",
                        "app_moeda",
                        "app_idioma",
                        "app_fuso_horario",
                        "app_cor_primaria",
                        "app_cor_secundaria",
                      ])
                    }
                    disabled={salvando !== null}
                  >
                    {salvando === "app_name" ? (
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
        </TabsContent>

        <TabsContent value="aparencia" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Aparencia
                </CardTitle>
                <CardDescription>
                  Visual e identidade do aplicativo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    URL do Logo
                  </Label>
                  <Input
                    value={configs.app_logo || ""}
                    onChange={(e) => updateConfig("app_logo", e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                  />
                  {configs.app_logo && (
                    <div className="mt-2 flex items-center gap-3 rounded-lg border p-3">
                      <img
                        src={configs.app_logo}
                        alt="Logo preview"
                        className="h-10 w-auto object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        Preview do logo
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    URL do Favicon
                  </Label>
                  <Input
                    value={configs.app_favicon || ""}
                    onChange={(e) => updateConfig("app_favicon", e.target.value)}
                    placeholder="https://exemplo.com/favicon.ico"
                  />
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleSalvar(["app_logo", "app_favicon"])}
                    disabled={salvando !== null}
                  >
                    {salvando === "app_logo" ? (
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
        </TabsContent>

        <TabsContent value="urls" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  URLs e Contato
                </CardTitle>
                <CardDescription>
                  Links uteis e informacoes de contato
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>URL Politica de Privacidade</Label>
                    <Input
                      value={configs.app_url_politica || ""}
                      onChange={(e) =>
                        updateConfig("app_url_politica", e.target.value)
                      }
                      placeholder="https://exemplo.com/politica"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL Termos de Uso</Label>
                    <Input
                      value={configs.app_url_termos || ""}
                      onChange={(e) =>
                        updateConfig("app_url_termos", e.target.value)
                      }
                      placeholder="https://exemplo.com/termos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email de Contato</Label>
                    <Input
                      value={configs.app_contato_email || ""}
                      onChange={(e) =>
                        updateConfig("app_contato_email", e.target.value)
                      }
                      placeholder="contato@exemplo.com"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      value={configs.app_whatsapp || ""}
                      onChange={(e) =>
                        updateConfig("app_whatsapp", e.target.value)
                      }
                      placeholder="5511999999999"
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      handleSalvar([
                        "app_url_politica",
                        "app_url_termos",
                        "app_contato_email",
                        "app_whatsapp",
                      ])
                    }
                    disabled={salvando !== null}
                  >
                    {salvando === "app_url_politica" ? (
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
        </TabsContent>

        <TabsContent value="sistema" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Sistema
                </CardTitle>
                <CardDescription>
                  Configuracoes tecnicas do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Modo Manutencao</Label>
                    <p className="text-xs text-muted-foreground">
                      Ativar modo manutencao bloqueia acesso dos usuarios
                    </p>
                  </div>
                  <Switch
                    checked={configs.app_manutencao === "true"}
                    onCheckedChange={(checked) =>
                      updateConfig("app_manutencao", checked ? "true" : "false")
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dias de Trial</Label>
                  <Input
                    type="number"
                    value={configs.app_trial_dias || ""}
                    onChange={(e) =>
                      updateConfig("app_trial_dias", e.target.value)
                    }
                    placeholder="7"
                    min="0"
                    max="90"
                  />
                  <p className="text-xs text-muted-foreground">
                    Numero de dias de trial gratuito para novos usuarios
                  </p>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      handleSalvar(["app_manutencao", "app_trial_dias"])
                    }
                    disabled={salvando !== null}
                  >
                    {salvando === "app_manutencao" ? (
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
        </TabsContent>

        <TabsContent value="redes" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Redes Sociais
                </CardTitle>
                <CardDescription>
                  Links das redes sociais do aplicativo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>JSON das Redes Sociais</Label>
                  <Textarea
                    value={configs.app_redes_sociais || ""}
                    onChange={(e) =>
                      updateConfig("app_redes_sociais", e.target.value)
                    }
                    placeholder={`{\n  "instagram": "https://instagram.com/lucrrio",\n  "facebook": "https://facebook.com/lucrrio",\n  "twitter": "https://twitter.com/lucrrio",\n  "linkedin": "https://linkedin.com/company/lucrrio",\n  "youtube": "https://youtube.com/@lucrrio"\n}`}
                    className="font-mono text-sm min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato JSON valido. Chaves: instagram, facebook, twitter,
                    linkedin, youtube, tiktok
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(() => {
                    try {
                      const parsed = JSON.parse(configs.app_redes_sociais || "{}");
                      return Object.entries(parsed).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                          <span className="text-xs font-medium capitalize text-muted-foreground">
                            {key}:
                          </span>
                          <span className="text-xs truncate flex-1">
                            {String(value)}
                          </span>
                        </div>
                      ));
                    } catch {
                      return (
                        <div className="col-span-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          Formato JSON invalido - corrija antes de salvar
                        </div>
                      );
                    }
                  })()}
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      try {
                        JSON.parse(configs.app_redes_sociais || "{}");
                        handleSalvar(["app_redes_sociais"]);
                      } catch {
                        toast.error("JSON invalido. Corrija o formato antes de salvar.");
                      }
                    }}
                    disabled={salvando !== null}
                  >
                    {salvando === "app_redes_sociais" ? (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
