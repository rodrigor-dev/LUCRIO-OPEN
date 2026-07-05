"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

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

export function useSubscription() {
  const [assinatura, setAssinatura] = useState<AssinaturaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAssinatura(null);
        return;
      }

      const { data } = await supabase
        .from("assinaturas")
        .select("*, plano:planos(nome)")
        .eq("usuario_id", user.id)
        .in("status", ["trial", "ativo"])
        .order("criado_em", { ascending: false })
        .limit(1)
        .single();

      if (!data) {
        setAssinatura({
          is_valid: false,
          is_expired: true,
          is_trial: false,
          is_active: false,
          plan_name: "Gratuito",
          days_remaining: 0,
          expires_at: null,
          status: "nenhum",
        });
        return;
      }

      const now = new Date();
      const fimPeriodo = new Date(data.fim_periodo);
      const diffMs = fimPeriodo.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const isExpired = fimPeriodo < now;

      setAssinatura({
        is_valid: !isExpired && data.status === "ativo",
        is_expired: isExpired,
        is_trial: data.status === "trial",
        is_active: data.status === "ativo" && !isExpired,
        plan_name: data.plano?.nome || data.plano_id || "PRO",
        days_remaining: daysRemaining,
        expires_at: data.fim_periodo,
        status: data.status,
      });
    } catch (error) {
      console.error("Erro ao verificar assinatura:", error);
      setAssinatura(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return { ...assinatura, loading, refresh: checkSubscription };
}