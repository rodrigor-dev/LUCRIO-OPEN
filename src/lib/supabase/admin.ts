import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service role key. Ignora RLS — use SOMENTE em
 * rotas de servidor que não dependem de um usuário logado (webhooks).
 * Nunca importe este arquivo em componentes "use client".
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
