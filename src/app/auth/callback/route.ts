import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token = searchParams.get("token");
  const type = searchParams.get("type");
  const tokenHash = searchParams.get("token_hash");
  const refCode = searchParams.get("ref");
  const emailParam = searchParams.get("email") || "";
  let redirect = searchParams.get("redirect") || "/dashboard";

  if (redirect.startsWith("http") || redirect.startsWith("//")) {
    redirect = "/dashboard";
  }
  if (!redirect.startsWith("/")) {
    redirect = "/dashboard";
  }

  const supabase = createClient();

  // Fluxo 1: PKCE code exchange (OAuth + email confirmation)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await criarPerfilSeNecessario(supabase, user, refCode);
        return redirecionarComAdminCheck(supabase, user.id, origin, redirect);
      }
    }
    console.error("[Callback] Erro no code exchange:", error?.message);
    return NextResponse.redirect(`${origin}/login?error=auth_error`);
  }

  // Fluxo 2: Token direto (email confirmation via /auth/confirm)
  if (token && (type === "signup" || type === "email")) {
    const email = emailParam || searchParams.get("email") || "";

    if (email) {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
      });

      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await criarPerfilSeNecessario(supabase, user, refCode);
          return redirecionarComAdminCheck(supabase, user.id, origin, redirect);
        }
      }
      console.error("[Callback] Erro na verificação OTP:", error?.message);
    } else {
      console.error("[Callback] Token recebido mas email não encontrado na URL");
    }

    return NextResponse.redirect(`${origin}/login?error=auth_error&msg=email_confirm`);
  }

  // Fluxo 3: token_hash (Supabase newer format)
  if (tokenHash && type === "signup") {
    const email = emailParam || searchParams.get("email") || "";
    if (email) {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: tokenHash,
        type: "signup",
      });

      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await criarPerfilSeNecessario(supabase, user, refCode);
          return redirecionarComAdminCheck(supabase, user.id, origin, redirect);
        }
      }
      console.error("[Callback] Erro na verificação token_hash:", error?.message);
    }

    return NextResponse.redirect(`${origin}/login?error=auth_error&msg=email_confirm`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}

async function redirecionarComAdminCheck(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  origin: string,
  fallbackRedirect: string,
) {
  let finalRedirect = fallbackRedirect;
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (usuario?.is_admin === true) {
    finalRedirect = "/admin";
  }

  return NextResponse.redirect(`${origin}${finalRedirect}`);
}

async function criarPerfilSeNecessario(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  refCode: string | null
) {
  const { data: existente } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existente) {
    const nome =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.nome as string) ||
      user.email?.split("@")[0] ||
      "Usuário";

    const { error: insertError } = await supabase.from("usuarios").insert({
      id: user.id,
      email: user.email!,
      nome,
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
    });

    if (insertError && insertError.code !== "23505") {
      console.error("[Callback] Erro ao criar perfil:", insertError.message);
    }
  }

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!negocio) {
    const { data: novoNegocio } = await supabase
      .from("negocios")
      .insert({ usuario_id: user.id, nome: "Meu Negócio" })
      .select("id")
      .single();

    if (novoNegocio) {
      const categorias = [
        { nome: "Combustível", icone: "⛽", cor: "#FF6B35" },
        { nome: "Alimentação", icone: "🍔", cor: "#4CAF50" },
        { nome: "Materiais", icone: "📦", cor: "#2196F3" },
        { nome: "Ferramentas", icone: "🔧", cor: "#9C27B0" },
        { nome: "Internet", icone: "🌐", cor: "#00BCD4" },
        { nome: "Água", icone: "💧", cor: "#03A9F4" },
        { nome: "Energia", icone: "⚡", cor: "#FFC107" },
        { nome: "Telefone", icone: "📱", cor: "#E91E63" },
        { nome: "Marketing", icone: "📢", cor: "#FF5722" },
        { nome: "Software", icone: "💻", cor: "#607D8B" },
        { nome: "Impostos", icone: "📋", cor: "#795548" },
        { nome: "Transporte", icone: "🚗", cor: "#3F51B5" },
        { nome: "Equipamentos", icone: "🏗️", cor: "#8BC34A" },
        { nome: "Outros", icone: "📌", cor: "#9E9E9E" },
      ].map((cat) => ({
        negocio_id: novoNegocio.id,
        ...cat,
        tipo: "padrao" as const,
      }));

      await supabase.from("categorias_despesas").insert(categorias);
    }
  }

  const { data: existenteAssinatura } = await supabase
    .from("assinaturas")
    .select("id")
    .eq("usuario_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!existenteAssinatura) {
    let planoId: string | null = null;

    const { data: planoPro } = await supabase
      .from("planos")
      .select("id")
      .eq("slug", "pro")
      .eq("is_ativo", true)
      .maybeSingle();

    if (planoPro) {
      planoId = planoPro.id;
    } else {
      const { data: planoBarato } = await supabase
        .from("planos")
        .select("id")
        .eq("is_ativo", true)
        .order("preco_mensal", { ascending: true })
        .limit(1)
        .maybeSingle();
      planoId = planoBarato?.id ?? null;
    }

    if (planoId) {
      const trialTermina = new Date();
      trialTermina.setDate(trialTermina.getDate() + 7);

      const { error: trialError } = await supabase.from("assinaturas").insert({
        usuario_id: user.id,
        plano_id: planoId,
        status: "trial",
        trial_termina: trialTermina.toISOString(),
        inicio_periodo: new Date().toISOString(),
        fim_periodo: trialTermina.toISOString(),
      });

      if (trialError && trialError.code !== "23505") {
        console.error("[Callback] Erro ao criar trial:", trialError.message);
      }

      await supabase
        .from("usuarios")
        .update({ trial_termina_em: trialTermina.toISOString() })
        .eq("id", user.id);
    }
  }

  if (refCode) {
    try {
      const { data: resultadoIndicacao } = await supabase.rpc("registrar_indicacao" as never, {
        p_indicador_codigo: refCode,
        p_indicado_id: user.id,
      } as never);

      if (resultadoIndicacao?.sucesso) {
        // Aplicar recompensa: estender trial do indicado em 7 dias
        const { data: assinatura } = await supabase
          .from("assinaturas")
          .select("id, fim_periodo, trial_termina")
          .eq("usuario_id", user.id)
          .eq("status", "trial")
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (assinatura?.fim_periodo) {
          const fimAtual = new Date(assinatura.fim_periodo);
          fimAtual.setDate(fimAtual.getDate() + 7);
          await supabase
            .from("assinaturas")
            .update({
              fim_periodo: fimAtual.toISOString(),
              trial_termina: fimAtual.toISOString(),
            })
            .eq("id", assinatura.id);

          // Marcar recompensa como aplicada
          await supabase
            .from("recompensas_indicacao")
            .update({ aplicada: true, aplicada_em: new Date().toISOString() })
            .eq("indicacao_id", resultadoIndicacao.indicacao_id)
            .eq("tipo", "dias_trial");
        }
      }
    } catch (err) {
      console.error("[Callback] Erro ao processar indicacao:", err);
    }
  }
}
