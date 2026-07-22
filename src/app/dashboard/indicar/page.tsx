"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Share2,
  Copy,
  Check,
  Users,
  Gift,
  Calendar,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authService } from "@/services/auth.service";
import {
  obterStatsIndicacoes,
  gerarLinksCompartilhamento,
  montarLinkIndicacao,
} from "@/services/referral.service";
import type { IndicacoesUsuarioStats } from "@/types/admin";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function IndicarPage() {
  const [stats, setStats] = useState<IndicacoesUsuarioStats | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    try {
      const user = await authService.getAuthUser();
      if (!user) return;
      setUsuarioId(user.id);
      const dados = await obterStatsIndicacoes(user.id);
      if (!dados?.codigo) {
        setErro(true);
        toast.error("Erro ao carregar código de indicação");
      }
      setStats(dados);
    } catch {
      setErro(true);
      toast.error("Erro ao carregar dados de indicações");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function copiarLink() {
    if (!stats?.codigo) return;
    const link = montarLinkIndicacao(stats.codigo);
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopiado(false), 2000);
  }

  function compartilhar() {
    if (!stats?.codigo) return;
    const links = gerarLinksCompartilhamento(stats.codigo);
    window.open(links.whatsapp, "_blank");
  }

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (erro && !stats) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4">
        <p className="text-center text-muted-foreground">
          Erro ao carregar dados de indicações.
        </p>
        <Button onClick={carregarDados} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const progresso = stats ? Math.min(stats.total_convertidas / 3, 1) : 0;
  const proximaRecompensa = stats ? 3 - (stats.total_convertidas % 3) : 3;

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold">Indique e Ganhe</h1>
        <p className="text-muted-foreground">
          Convide amigos e ganhe dias extras de trial
        </p>
      </div>

      {/* Card principal com codigo */}
      <motion.div {...fadeInUp} transition={{ delay: 0.1 }}>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Seu código de indicação</h2>
                <p className="text-sm text-muted-foreground">
                  Compartilhe com seus amigos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-background p-4 border border-border/50">
              <code className="flex-1 text-center text-2xl font-bold tracking-widest text-primary">
                {stats?.codigo || "Erro ao gerar código"}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={copiarLink}
                className="shrink-0"
              >
                {copiado ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </Button>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={copiarLink} className="flex-1" size="lg">
                {copiado ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copiar Link
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (!stats?.codigo) return;
                  const link = montarLinkIndicacao(stats.codigo);
                  if (navigator.share) {
                    navigator.share({ title: "FATURION", text: "Cadastre-se no FATURION!", url: link });
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progresso */}
      <motion.div {...fadeInUp} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Progresso</h3>
              <Badge variant="secondary">
                {stats?.total_convertidas || 0} de 3 conversões
              </Badge>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progresso * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {proximaRecompensa > 0
                ? `Faltam ${proximaRecompensa} indicações para ganhar dias extras de trial`
                : "Parabéns! Você já desbloqueou todas as recompensas!"}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div {...fadeInUp} transition={{ delay: 0.3 }}>
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats?.total_indicacoes || 0}</p>
              <p className="text-xs text-muted-foreground">Indicados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Check className="mx-auto mb-2 h-5 w-5 text-green-500" />
              <p className="text-2xl font-bold">{stats?.total_convertidas || 0}</p>
              <p className="text-xs text-muted-foreground">Convertidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Gift className="mx-auto mb-2 h-5 w-5 text-primary" />
              <p className="text-2xl font-bold">{stats?.total_recompensas || 0}</p>
              <p className="text-xs text-muted-foreground">Recompensas ganhas</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Compartilhar */}
      <motion.div {...fadeInUp} transition={{ delay: 0.4 }}>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Compartilhar via</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="justify-start gap-3"
                onClick={compartilhar}
              >
                <MessageCircle className="h-5 w-5 text-green-600" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-3"
                onClick={copiarLink}
              >
                {copiado ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Historico */}
      {stats?.indicacoes && stats.indicacoes.length > 0 && (
        <motion.div {...fadeInUp} transition={{ delay: 0.5 }}>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Suas indicações</h3>
              <div className="space-y-3">
                {stats.indicacoes.map((ind) => (
                  <div
                    key={ind.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {ind.indicado_nome || "Novo usuário"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ind.indicado_email || ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        ind.status === "recompensada"
                          ? "default"
                          : ind.status === "convertida"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {ind.status === "recompensada"
                        ? "Recompensada"
                        : ind.status === "convertida"
                        ? "Convertida"
                        : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Como funciona */}
      <motion.div {...fadeInUp} transition={{ delay: 0.6 }}>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Como funciona</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  1
                </div>
                <div>
                  <p className="font-medium">Compartilhe seu código</p>
                  <p className="text-sm text-muted-foreground">
                    Envie o link para amigos via WhatsApp ou link copiado
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  2
                </div>
                <div>
                  <p className="font-medium">Amigo se cadastra</p>
                  <p className="text-sm text-muted-foreground">
                    Ele ganha 7 dias extras de trial ao usar seu código
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  3
                </div>
                <div>
                  <p className="font-medium">Você ganha dias extras</p>
                  <p className="text-sm text-muted-foreground">
                    A cada 3 amigos que se cadastra, você ganha 15 dias de trial
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
