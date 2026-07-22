"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  Gift,
  Clock,
  Search,
  Loader2,
  UserPlus,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  obterStatsAdminIndicacoes,
  listarAdminIndicacoes,
} from "@/services/referral.service";
import type { IndicacoesStats, Indicacao } from "@/types/admin";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function AdminIndicacoesPage() {
  const [stats, setStats] = useState<IndicacoesStats | null>(null);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [busca, setBusca] = useState("");

  const carregarDados = useCallback(async () => {
    try {
      const [s, i] = await Promise.all([
        obterStatsAdminIndicacoes(),
        listarAdminIndicacoes(filtroStatus || undefined, busca || undefined),
      ]);
      setStats(s);
      setIndicacoes(i);
    } catch (err) {
      console.error("[Admin Indicações] Erro ao carregar dados:", err);
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, busca]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    carregarDados();
  }

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-800",
    convertida: "bg-blue-100 text-blue-800",
    recompensada: "bg-green-100 text-green-800",
    cancelada: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold">Indicações</h1>
        <p className="text-muted-foreground">
          Acompanhe o sistema de indicação do FATURION
        </p>
      </div>

      {/* Stats */}
      <motion.div {...fadeInUp} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total_indicacoes || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.convertidas || 0}</p>
                  <p className="text-xs text-muted-foreground">Convertidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.pendentes || 0}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Gift className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total_dias_dados || 0}</p>
                  <p className="text-xs text-muted-foreground">Dias dados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Grafico simples (barras de indicacoes por dia) */}
      {stats?.indicacoes_por_dia && stats.indicacoes_por_dia.length > 0 && (
        <motion.div {...fadeInUp} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Indicações por dia (últimos 30 dias)
              </h3>
              <div className="flex items-end gap-1 h-32">
                {stats.indicacoes_por_dia.map((dia, i) => {
                  const maxVal = Math.max(...stats.indicacoes_por_dia.map((d) => d.total), 1);
                  const height = (dia.total / maxVal) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 min-w-0"
                      title={`${dia.data}: ${dia.total}`}
                    >
                      <div
                        className="w-full rounded-t bg-primary/80 transition-all"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{stats.indicacoes_por_dia[0]?.data?.slice(5)}</span>
                <span>{stats.indicacoes_por_dia[stats.indicacoes_por_dia.length - 1]?.data?.slice(5)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filtros */}
      <motion.div {...fadeInUp} transition={{ delay: 0.3 }}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleBusca} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="secondary">
              Buscar
            </Button>
          </form>
          <div className="flex gap-2 overflow-x-auto">
            {[
              { value: "", label: "Todos" },
              { value: "pendente", label: "Pendentes" },
              { value: "convertida", label: "Convertidas" },
              { value: "recompensada", label: "Recompensadas" },
            ].map((f) => (
              <Button
                key={f.value}
                variant={filtroStatus === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroStatus(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Lista de indicacoes */}
      <motion.div {...fadeInUp} transition={{ delay: 0.4 }}>
        <Card>
          <CardContent className="p-0">
            {indicacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UserPlus className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">Nenhuma indicação encontrada</p>
                <p className="text-sm text-muted-foreground">
                  As indicações aparecerão aqui quando usuários se cadastrarem com códigos
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {indicacoes.map((ind) => (
                  <div
                    key={ind.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {ind.indicador_nome || "N/A"}
                        </p>
                        <span className="text-muted-foreground">→</span>
                        <p className="truncate text-sm text-muted-foreground">
                          {ind.indicado_nome || ind.indicado_email || "N/A"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Código: {ind.codigo_usado} •{" "}
                        {new Date(ind.criado_em).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge className={statusColors[ind.status] || ""}>
                      {ind.status === "pendente" ? "Pendente" : ind.status === "convertida" ? "Convertida" : ind.status === "recompensada" ? "Recompensada" : ind.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
