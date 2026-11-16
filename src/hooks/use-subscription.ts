"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRevalidarAssinatura } from "@/lib/revalidar-assinatura";
import {
  STATUS_COM_ACESSO,
  acessoValeAte,
  assinaturaLiberaAcesso,
} from "@/lib/assinatura-acesso";

interface AssinaturaInfo {
  is_valid: boolean;
  is_expired: boolean;
  is_trial: boolean;
  is_active: boolean;
  plan_name: string;
  days_remaining: number;
  expires_at: string | null;
  status: string;
}

const SEM_ASSINATURA: AssinaturaInfo = {
  is_valid: false,
  is_expired: true,
  is_trial: false,
  is_active: false,
  plan_name: "Gratuito",
  days_remaining: 0,
  expires_at: null,
  status: "nenhum",
};

export function useSubscription() {
  const [assinatura, setAssinatura] = useState<AssinaturaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // true quando NÃO deu para consultar (rede/servidor). Nesse caso a tela
  // não bloqueia: falha momentânea não pode travar quem está pagando.
  const [erro, setErro] = useState(false);

  const checkSubscription = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: erroUsuario,
      } = await supabase.auth.getUser();
      if (erroUsuario && !user) throw erroUsuario;
      if (!user) {
        setAssinatura(null);
        setErro(false);
        return;
      }

      const { data, error } = await supabase
        .from("assinaturas")
        .select("*, plano:planos(nome)")
        .eq("usuario_id", user.id)
        .in("status", [...STATUS_COM_ACESSO])
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setAssinatura(SEM_ASSINATURA);
        setErro(false);
        return;
      }

      const agora = new Date();
      const valeAte = acessoValeAte(data);
      const fimPeriodo = data.fim_periodo ? new Date(data.fim_periodo) : null;
      const liberado = assinaturaLiberaAcesso(data, agora);
      const diffMs = fimPeriodo ? fimPeriodo.getTime() - agora.getTime() : 0;
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      setAssinatura({
        // Pago (ativo/cancelado/atrasado) dentro do período + tolerância
        is_valid: liberado && data.status !== "trial",
        is_expired: !valeAte || valeAte.getTime() <= agora.getTime(),
        is_trial: data.status === "trial",
        is_active: data.status === "ativo" && liberado,
        plan_name: data.plano?.nome || data.plano_id || "PRO",
        days_remaining: daysRemaining,
        expires_at: data.fim_periodo,
        status: data.status,
      });
      setErro(false);
    } catch (error) {
      console.error("Erro ao verificar assinatura:", error);
      // Mantém o último estado conhecido; se ainda não havia nenhum,
      // marca erro (a tela não bloqueia) e tenta de novo ao voltar à aba.
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Libera a tela sozinha depois do pagamento (sem fechar e abrir o sistema)
  useRevalidarAssinatura(checkSubscription, assinatura?.is_active !== true);

  return { ...assinatura, loading, erro, refresh: checkSubscription };
}
