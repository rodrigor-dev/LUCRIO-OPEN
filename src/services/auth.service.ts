import { createClient } from "@/lib/supabase/client";
import type { Usuario, Assinatura, Plano } from "@/types/database";

const supabase = createClient();

export async function obterUsuarioAtual(): Promise<Usuario | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

export async function criarConta(
  email: string,
  senha: string,
  nome: string
): Promise<{ usuario: Usuario | null; erro?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome },
    },
  });

  if (error) {
    return { usuario: null, erro: error.message };
  }

  if (data.user) {
    const { error: insertError } = await supabase.from("usuarios").insert({
      id: data.user.id,
      email: data.user.email!,
      nome,
      is_ativo: true,
    });

    if (insertError) {
      return { usuario: null, erro: insertError.message };
    }

    await criarTrial(data.user.id);
  }

  const { data: usuario } = await supabase.from("usuarios").select("*").eq("id", data.user!.id).single();

  return { usuario: (usuario as Usuario) || null };
}

export async function entrarComEmail(
  email: string,
  senha: string
): Promise<{ erro?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return { erro: error.message };
  }

  return {};
}

export async function entrarComGoogle(): Promise<{ erro?: string }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    return { erro: error.message };
  }

  return {};
}

export async function recuperarSenha(
  email: string
): Promise<{ erro?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/redefinir-senha`,
  });

  if (error) {
    return { erro: error.message };
  }

  return {};
}

export async function redefinirSenha(
  novaSenha: string
): Promise<{ erro?: string }> {
  const { error } = await supabase.auth.updateUser({
    password: novaSenha,
  });

  if (error) {
    return { erro: error.message };
  }

  return {};
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut();
}

async function criarTrial(usuarioId: string): Promise<void> {
  const trialTerminaEm = new Date();
  trialTerminaEm.setDate(trialTerminaEm.getDate() + 7);

  const { data: plano } = await supabase
    .from("planos")
    .select("id")
    .eq("is_ativo", true)
    .order("preco_mensal", { ascending: true })
    .limit(1)
    .single();

  if (!plano) return;

  await supabase.from("assinaturas").insert({
    usuario_id: usuarioId,
    plano_id: plano.id,
    status: "trial",
    trial_termina: trialTerminaEm.toISOString(),
    inicio_periodo: new Date().toISOString(),
    fim_periodo: trialTerminaEm.toISOString(),
  });

  await supabase
    .from("usuarios")
    .update({ trial_termina_em: trialTerminaEm.toISOString() })
    .eq("id", usuarioId);
}

export async function verificarAssinatura(
  usuarioId: string
): Promise<{ status: string; plano: Plano | null; trial_termina?: string }> {
  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("*, plano:planos(*)")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .single();

  if (!assinatura) {
    return { status: "sem_assinatura", plano: null };
  }

  const agora = new Date();
  const trialExpirou =
    assinatura.trial_termina && new Date(assinatura.trial_termina) < agora;

  if (assinatura.status === "trial" && trialExpirou) {
    return {
      status: "trial_expirado",
      plano: assinatura.plano as unknown as Plano,
      trial_termina: assinatura.trial_termina,
    };
  }

  return {
    status: assinatura.status,
    plano: assinatura.plano as unknown as Plano,
    trial_termina: assinatura.trial_termina,
  };
}
