import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Exclui a conta de um usuário (login + negócio, clientes, receitas,
 * despesas, assinatura, tickets). Só para administradores.
 * Travas: não exclui a si mesmo nem outro administrador.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const usuarioId = String(body?.usuarioId ?? "");
    if (!UUID_RE.test(usuarioId)) {
      return NextResponse.json({ erro: "Usuário inválido." }, { status: 400 });
    }
    if (usuarioId === user.id) {
      return NextResponse.json({ erro: "Você não pode excluir a sua própria conta." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: quemPede } = await admin
      .from("usuarios")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!quemPede?.is_admin) {
      return NextResponse.json({ erro: "Acesso restrito a administradores." }, { status: 403 });
    }

    const { data: alvo } = await admin
      .from("usuarios")
      .select("id, email, is_admin")
      .eq("id", usuarioId)
      .maybeSingle();
    if (alvo?.is_admin) {
      return NextResponse.json(
        { erro: "Remova a permissão de administrador antes de excluir esta conta." },
        { status: 400 }
      );
    }

    const { error } = await admin.auth.admin.deleteUser(usuarioId);
    if (error) {
      console.error("[ADMIN] Erro ao excluir usuário:", usuarioId, error.message);
      return NextResponse.json({ erro: "Não foi possível excluir: " + error.message }, { status: 500 });
    }

    // Registro de auditoria (não bloqueia a resposta se falhar)
    await admin.from("auditoria").insert({
      usuario_id: user.id,
      usuario_email: user.email,
      acao: "excluir_usuario",
      entidade: "usuarios",
      entidade_id: usuarioId,
      dados_antes: { email: alvo?.email ?? null },
      dados_depois: null,
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error("[ADMIN] Erro inesperado ao excluir usuário:", erro);
    return NextResponse.json({ erro: "Erro inesperado ao excluir o usuário." }, { status: 500 });
  }
}
