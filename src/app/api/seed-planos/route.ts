import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createClient();

    // Call SECURITY DEFINER function to insert PRO plan (bypasses RLS)
    const { data, error } = await supabase.rpc("seed_plano_pro");

    if (error) {
      // Function might not exist yet, try direct insert
      const { data: existing } = await supabase
        .from("planos")
        .select("id")
        .eq("slug", "pro")
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ ok: true, mensagem: "Plano PRO ja existe", id: existing.id });
      }

      const { data: plano, error: insertErr } = await supabase
        .from("planos")
        .insert({
          nome: "PRO",
          slug: "pro",
          descricao: "Plano completo com todas as funcionalidades",
          preco_mensal: 14.99,
          preco_anual: 139.99,
          is_ativo: true,
          is_destaque: true,
          ordem: 2,
          limite_clientes: -1,
          funcionalidades: ["Clientes ilimitados", "Receitas e despesas", "Calendario financeiro", "Relatorios avancados", "Propostas", "Suporte prioritario"],
        })
        .select("id")
        .single();

      if (insertErr) {
        return NextResponse.json({ erro: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, id: plano.id });
    }

    return NextResponse.json({ ok: true, id: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
