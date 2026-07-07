import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const refCode = searchParams.get("ref");
  let redirect = searchParams.get("redirect") || "/dashboard";

  if (redirect.startsWith("http") || redirect.startsWith("//")) {
    redirect = "/dashboard";
  }

  if (!redirect.startsWith("/")) {
    redirect = "/dashboard";
  }

  if (code) {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Verificar se perfil já existe
          const { data: existente } = await supabase
            .from("usuarios")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

          if (!existente) {
            const nome =
              user.user_metadata?.full_name ||
              user.user_metadata?.nome ||
              user.email?.split("@")[0] ||
              "Usuário";

            const { error: insertError } = await supabase
              .from("usuarios")
              .insert({
                id: user.id,
                email: user.email!,
                nome,
                avatar_url: user.user_metadata?.avatar_url || null,
              });

            if (insertError && insertError.code !== "23505") {
              console.error(
                "[Callback] Erro ao criar perfil:",
                insertError.message
              );
            }
          }

          // Verificar se já tem negócio
          const { data: negocio } = await supabase
            .from("negocios")
            .select("id")
            .eq("usuario_id", user.id)
            .maybeSingle();

          if (!negocio) {
            const { data: novoNegocio } = await supabase
              .from("negocios")
              .insert({
                usuario_id: user.id,
                nome: "Meu Negócio",
              })
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

          // Criar trial se não existir assinatura
          const { data: existenteAssinatura } = await supabase
            .from("assinaturas")
            .select("id")
            .eq("usuario_id", user.id)
            .limit(1)
            .maybeSingle();

          if (!existenteAssinatura) {
            // Buscar plano PRO por UUID (não hardcoded)
            const { data: plano } = await supabase
              .from("planos")
              .select("id")
              .eq("is_ativo", true)
              .order("preco_mensal", { ascending: true })
              .limit(1)
              .single();

            if (plano) {
              const trialTermina = new Date();
              trialTermina.setDate(trialTermina.getDate() + 7);

              const { error: trialError } = await supabase
                .from("assinaturas")
                .insert({
                  usuario_id: user.id,
                  plano_id: plano.id,
                  status: "trial",
                  trial_termina: trialTermina.toISOString(),
                  inicio_periodo: new Date().toISOString(),
                  fim_periodo: trialTermina.toISOString(),
                });

              if (trialError && trialError.code !== "23505") {
                console.error(
                  "[Callback] Erro ao criar trial:",
                  trialError.message
                );
              }

              await supabase
                .from("usuarios")
                .update({ trial_termina_em: trialTermina.toISOString() })
                .eq("id", user.id);
            }
          }

          // Processar codigo de indicacao
          if (refCode) {
            try {
              await supabase.rpc("registrar_indicacao" as never, {
                p_indicador_codigo: refCode,
                p_indicado_id: user.id,
              } as never);
            } catch (err) {
              console.error("[Callback] Erro ao processar indicacao:", err);
            }
          }

          // Verificar se é admin para redirecionar
          let finalRedirect = redirect;
          const { data: usuario } = await supabase
            .from("usuarios")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();

          if (usuario?.is_admin === true) {
            finalRedirect = "/admin";
          }

          return NextResponse.redirect(`${origin}${finalRedirect}`);
        }
      }
    } catch (err) {
      console.error("[Callback] Erro inesperado:", err);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
