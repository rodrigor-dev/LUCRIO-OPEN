import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado", authError: authError?.message }, { status: 401 });
  }

  // Query direta - RLS own deve permitir
  const { data: usuario, error: dbError } = await supabase
    .from("usuarios")
    .select("id, email, nome, is_admin, is_ativo")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    authUserId: user.id,
    authUserEmail: user.email,
    usuario,
    dbError: dbError?.message,
    isAdmin: usuario?.is_admin === true,
  });
}
