"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, ShieldCheck, ShieldX, User, Key, Database, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authService, type UserProfile } from "@/services/auth.service";
import { useSubscription } from "@/hooks/use-subscription";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DebugInfo {
  authUser: { id: string; email: string; } | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  subscription: ReturnType<typeof useSubscription>;
  middlewareResult: string;
  adminLayoutResult: string;
  subscriptionGuardResult: string;
  dashboardResult: string;
  rlsPolicies: string[];
  errors: string[];
}

export default function AdminDebugPage() {
  const router = useRouter();
  const supabase = createClient();
  const sub = useSubscription();
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDebugInfo() {
    setRefreshing(true);
    const errors: string[] = [];
    let authUser = null;
    let profile = null;
    let isAdmin = false;
    let middlewareResult = "N/A (só executa no server)";
    let adminLayoutResult = "N/A";
    let subscriptionGuardResult = "N/A";
    let dashboardResult = "N/A";
    let rlsPolicies: string[] = [];

    try {
      // 1. Auth User
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        errors.push(`Auth Error: ${authError.message}`);
      }
      authUser = user ? { id: user.id, email: user.email || "N/A" } : null;

      // 2. Profile via AuthService
      if (user) {
        profile = await authService.getUserProfile(user.id);
        if (!profile) {
          errors.push("Perfil não encontrado na tabela usuarios");
        }
        isAdmin = authService.isUserAdmin(profile);

        // 3. Check RLS - try to read own data
        const { data: rlsTest, error: rlsError } = await supabase
          .from("usuarios")
          .select("id, is_admin")
          .eq("id", user.id)
          .single();

        if (rlsError) {
          errors.push(`RLS bloqueou leitura: ${rlsError.message}`);
        } else {
          rlsPolicies.push(`usuarios_select_own: OK (is_admin=${rlsTest.is_admin})`);
        }

        // 4. Check admin RLS - try to read ALL users
        const { data: allUsers, error: adminRlsError } = await supabase
          .from("usuarios")
          .select("id, email, is_admin");

        if (adminRlsError) {
          errors.push(`Admin RLS bloqueou listagem: ${adminRlsError.message}`);
          rlsPolicies.push("usuarios_select_admin: BLOQUEADO");
        } else {
          rlsPolicies.push(`usuarios_select_admin: OK (${allUsers?.length || 0} usuários visíveis)`);
        }

        // 5. Simulate component checks
        adminLayoutResult = profile && isAdmin
          ? "✅ ACESSO PERMITIDO (is_admin=true)"
          : "❌ ACESSO NEGADO (redireciona para /dashboard)";

        dashboardResult = profile
          ? `✅ Perfil carregado: ${profile.nome} (${profile.email})`
          : "❌ Perfil não encontrado";

        subscriptionGuardResult = isAdmin
          ? "✅ BYPASS ATIVO (admin não bloqueado)"
          : sub.is_expired
            ? "❌ BLOQUEADO (assinatura expirada)"
            : "✅ PERMITIDO (assinatura ativa)";
      }
    } catch (err) {
      errors.push(`Erro inesperado: ${err}`);
    }

    setInfo({
      authUser,
      profile,
      isAdmin,
      subscription: sub,
      middlewareResult,
      adminLayoutResult,
      subscriptionGuardResult,
      dashboardResult,
      rlsPolicies,
      errors,
    });
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadDebugInfo();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando diagnóstico...</p>
        </div>
      </div>
    );
  }

  if (!info) return null;

  const statusColor = info.isAdmin ? "bg-emerald-500" : "bg-amber-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico do Sistema</h1>
          <p className="text-muted-foreground">Verificação completa do fluxo de autenticação e permissões</p>
        </div>
        <Button onClick={loadDebugInfo} disabled={refreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Status Geral */}
      <Card className={`border-0 ${info.isAdmin ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-amber-50 dark:bg-amber-950/20"}`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${statusColor} text-white`}>
              {info.isAdmin ? <ShieldCheck className="h-8 w-8" /> : <ShieldX className="h-8 w-8" />}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {info.isAdmin ? "ADMINISTRADOR" : "USUÁRIO COMUM"}
              </h2>
              <p className="text-muted-foreground">
                {info.profile?.nome} ({info.profile?.email})
              </p>
              <p className="text-xs text-muted-foreground">
                ID: {info.authUser?.id}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fluxo de Autenticação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Fluxo de Autenticação
          </CardTitle>
          <CardDescription>Verificação do caminho completo de auth</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <DebugRow
            label="1. Supabase Auth"
            value={info.authUser ? `✅ Logado (${info.authUser.email})` : "❌ Não autenticado"}
          />
          <DebugRow
            label="2. Tabela usuarios"
            value={info.profile ? `✅ Perfil encontrado` : "❌ Perfil não encontrado"}
            detail={info.profile ? `is_admin: ${info.profile.is_admin}, is_ativo: ${info.profile.is_ativo}` : undefined}
          />
          <DebugRow
            label="3. Verificação Admin"
            value={info.isAdmin ? "✅ is_admin = true" : "❌ is_admin = false/null"}
          />
          <DebugRow
            label="4. Middleware (/admin/*)"
            value={info.middlewareResult}
          />
          <DebugRow
            label="5. Admin Layout"
            value={info.adminLayoutResult}
          />
          <DebugRow
            label="6. Dashboard Layout"
            value={info.dashboardResult}
          />
          <DebugRow
            label="7. SubscriptionGuard"
            value={info.subscriptionGuardResult}
          />
        </CardContent>
      </Card>

      {/* Assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Status da Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DebugRow label="Status" value={info.subscription.status || "N/A"} />
          <DebugRow label="É Trial" value={info.subscription.is_trial ? "Sim" : "Não"} />
          <DebugRow label="Ativa" value={info.subscription.is_active ? "Sim" : "Não"} />
          <DebugRow label="Expirada" value={info.subscription.is_expired ? "Sim" : "Não"} />
          <DebugRow label="Plano" value={info.subscription.plan_name || "N/A"} />
          <DebugRow label="Dias Restantes" value={String(info.subscription.days_remaining ?? "N/A")} />
          <DebugRow label="Expira em" value={info.subscription.expires_at || "N/A"} />
          <DebugRow
            label="Resultado"
            value={info.isAdmin
              ? "✅ ADMIN: Sempre ativo (ignora assinatura)"
              : info.subscription.is_expired
                ? "❌ BLOQUEADO"
                : "✅ PERMITIDO"
            }
          />
        </CardContent>
      </Card>

      {/* RLS Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Políticas RLS Verificadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {info.rlsPolicies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma verificação realizada</p>
          ) : (
            info.rlsPolicies.map((policy, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Badge variant={policy.includes("BLOQUEADO") ? "destructive" : "default"}>
                  {policy.includes("BLOQUEADO") ? "BLOCKED" : "OK"}
                </Badge>
                <span>{policy}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Erros */}
      {info.errors.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-600">Erros Encontrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {info.errors.map((error, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                <ShieldX className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DebugRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const isError = value.includes("❌");
  return (
    <div className={`flex items-start justify-between rounded-lg p-3 ${isError ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/50"}`}>
      <div>
        <span className="text-sm font-medium">{label}</span>
        {detail && <p className="text-xs text-muted-foreground mt-1">{detail}</p>}
      </div>
      <span className={`text-sm font-mono ${isError ? "text-red-600" : "text-emerald-600"}`}>
        {value}
      </span>
    </div>
  );
}
