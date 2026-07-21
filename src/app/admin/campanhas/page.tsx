"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Megaphone,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  X,
  Save,
  Gift,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  listarCampanhas,
  criarCampanha,
  atualizarCampanha,
  toggleCampanha,
  excluirCampanha,
} from "@/services/referral.service";
import type { CampanhaIndicacao } from "@/types/admin";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const defaultCampanha: Omit<CampanhaIndicacao, "id" | "criado_em" | "atualizado_em"> = {
  nome: "Indique e Ganhe",
  descricao: "Convide amigos e ganhe dias extras de trial",
  recompensa_indicador_tipo: "dias_trial",
  recompensa_indicador_valor: 15,
  recompensa_indicado_tipo: "dias_trial",
  recompensa_indicado_valor: 7,
  max_indicacoes_por_usuario: 0,
  max_total_indicacoes: 0,
  data_inicio: null,
  data_fim: null,
  bloquear_temp_emails: true,
  dominios_bloqueados: ["tempmail.com", "guerrillamail.com", "mailinator.com"],
  is_ativo: true,
};

export default function AdminCampanhasPage() {
  const [campanhas, setCampanhas] = useState<CampanhaIndicacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [editando, setEditando] = useState<CampanhaIndicacao | null>(null);
  const [form, setForm] = useState(defaultCampanha);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const data = await listarCampanhas();
    setCampanhas(data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNova() {
    setEditando(null);
    setForm(defaultCampanha);
    setSheetAberto(true);
  }

  function abrirEditar(c: CampanhaIndicacao) {
    setEditando(c);
    setForm({
      nome: c.nome,
      descricao: c.descricao,
      recompensa_indicador_tipo: c.recompensa_indicador_tipo,
      recompensa_indicador_valor: c.recompensa_indicador_valor,
      recompensa_indicado_tipo: c.recompensa_indicado_tipo,
      recompensa_indicado_valor: c.recompensa_indicado_valor,
      max_indicacoes_por_usuario: c.max_indicacoes_por_usuario,
      max_total_indicacoes: c.max_total_indicacoes,
      data_inicio: c.data_inicio,
      data_fim: c.data_fim,
      bloquear_temp_emails: c.bloquear_temp_emails,
      dominios_bloqueados: c.dominios_bloqueados,
      is_ativo: c.is_ativo,
    });
    setSheetAberto(true);
  }

  async function salvar() {
    setSalvando(true);
    let resultado;
    if (editando) {
      resultado = await atualizarCampanha(editando.id, form);
    } else {
      resultado = await criarCampanha(form);
    }
    setSalvando(false);

    if (resultado.erro) {
      toast.error(resultado.erro);
    } else {
      toast.success(editando ? "Campanha atualizada!" : "Campanha criada!");
      setSheetAberto(false);
      carregar();
    }
  }

  async function handleToggle(id: string, is_ativo: boolean) {
    const resultado = await toggleCampanha(id, is_ativo);
    if (resultado.erro) {
      toast.error(resultado.erro);
    } else {
      toast.success(is_ativo ? "Campanha ativada!" : "Campanha desativada!");
      carregar();
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;
    const resultado = await excluirCampanha(id);
    if (resultado.erro) {
      toast.error(resultado.erro);
    } else {
      toast.success("Campanha excluída!");
      carregar();
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campanhas de Indicação</h1>
          <p className="text-muted-foreground">
            Configure regras e recompensas do sistema de indicação
          </p>
        </div>
        <Button onClick={abrirNova}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Lista de campanhas */}
      <div className="space-y-4">
        {campanhas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">Nenhuma campanha criada</p>
              <p className="text-sm text-muted-foreground">
                Crie uma campanha para configurar o sistema de indicação
              </p>
            </CardContent>
          </Card>
        ) : (
          campanhas.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={c.is_ativo ? "border-green-200" : "opacity-60"}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{c.nome}</h3>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.is_ativo
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {c.is_ativo ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                      {c.descricao && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {c.descricao}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-muted-foreground">Indicador</p>
                            <p className="font-medium">
                              +{c.recompensa_indicador_valor}{" "}
                              {c.recompensa_indicador_tipo === "dias_trial"
                                ? "dias"
                                : c.recompensa_indicador_tipo === "meses_gratis"
                                ? "meses"
                                : "%"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-blue-500" />
                          <div>
                            <p className="text-muted-foreground">Indicado</p>
                            <p className="font-medium">
                              +{c.recompensa_indicado_valor}{" "}
                              {c.recompensa_indicado_tipo === "dias_trial"
                                ? "dias"
                                : c.recompensa_indicado_tipo === "meses_gratis"
                                ? "meses"
                                : "%"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-orange-500" />
                          <div>
                            <p className="text-muted-foreground">Anti-fraude</p>
                            <p className="font-medium">
                              {c.bloquear_temp_emails
                                ? `${c.dominios_bloqueados.length} blocos`
                                : "Desligado"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Limite/usuário</p>
                          <p className="font-medium">
                            {c.max_indicacoes_por_usuario > 0
                              ? c.max_indicacoes_por_usuario
                              : "Ilimitado"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        checked={c.is_ativo}
                        onCheckedChange={(checked) =>
                          handleToggle(c.id, checked)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirEditar(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleExcluir(c.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Sheet de criacao/edicao */}
      <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editando ? "Editar Campanha" : "Nova Campanha"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da campanha</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Indique e Ganhe"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao || ""}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Descreva a campanha..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recompensa indicador (dias)</Label>
                <Input
                  type="number"
                  value={form.recompensa_indicador_valor}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recompensa_indicador_valor: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Recompensa indicado (dias)</Label>
                <Input
                  type="number"
                  value={form.recompensa_indicado_valor}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recompensa_indicado_valor: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máx. indicações/usuário (0=ilimitado)</Label>
                <Input
                  type="number"
                  value={form.max_indicacoes_por_usuario}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_indicacoes_por_usuario: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Máx. total indicações (0=ilimitado)</Label>
                <Input
                  type="number"
                  value={form.max_total_indicacoes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_total_indicacoes: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Bloquear emails temporários</p>
                <p className="text-xs text-muted-foreground">
                  Impedir cadastros com domínios de email descartável
                </p>
              </div>
              <Switch
                checked={form.bloquear_temp_emails}
                onCheckedChange={(checked) =>
                  setForm({ ...form, bloquear_temp_emails: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Campanha ativa</p>
                <p className="text-xs text-muted-foreground">
                  Apenas campanhas ativas concedem recompensas
                </p>
              </div>
              <Switch
                checked={form.is_ativo}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_ativo: checked })
                }
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSheetAberto(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={salvar}
                disabled={salvando || !form.nome}
              >
                {salvando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {editando ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
