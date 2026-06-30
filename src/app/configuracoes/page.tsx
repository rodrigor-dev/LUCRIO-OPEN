"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda, diasRestantes } from "@/utils";
import type { Usuario, Negocio, Assinatura } from "@/types/database";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregarDados() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: negocioData } = await supabase
        .from("negocios")
        .select("*")
        .eq("usuario_id", user.id)
        .single();

      const { data: assinaturaData } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("usuario_id", user.id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .single();

      setUsuario(usuarioData);
      setNegocio(negocioData);
      setAssinatura(assinaturaData);
      setCarregando(false);
    }

    carregarDados();
  }, [supabase, router]);

  async function salvarNegocio(e: React.FormEvent) {
    e.preventDefault();
    if (!negocio) return;

    setSalvando(true);

    const { error } = await supabase
      .from("negocios")
      .update({
        nome: negocio.nome,
        cnpj_cpf: negocio.cnpj_cpf,
        telefone: negocio.telefone,
        email: negocio.email,
      })
      .eq("id", negocio.id);

    if (error) {
      console.error(error);
    }

    setSalvando(false);
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const diasTrial = assinatura?.trial_termina
    ? diasRestantes(assinatura.trial_termina)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie sua conta e dados do negócio
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Dados do Negócio</h2>
            <form onSubmit={salvarNegocio} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Nome do Negócio
                  </label>
                  <input
                    type="text"
                    value={negocio?.nome || ""}
                    onChange={(e) =>
                      setNegocio(
                        negocio ? { ...negocio, nome: e.target.value } : null
                      )
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    CNPJ/CPF
                  </label>
                  <input
                    type="text"
                    value={negocio?.cnpj_cpf || ""}
                    onChange={(e) =>
                      setNegocio(
                        negocio
                          ? { ...negocio, cnpj_cpf: e.target.value }
                          : null
                      )
                    }
                    placeholder="Opcional"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={negocio?.telefone || ""}
                    onChange={(e) =>
                      setNegocio(
                        negocio
                          ? { ...negocio, telefone: e.target.value }
                          : null
                      )
                    }
                    placeholder="(00) 00000-0000"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={negocio?.email || ""}
                    onChange={(e) =>
                      setNegocio(
                        negocio ? { ...negocio, email: e.target.value } : null
                      )
                    }
                    placeholder="contato@negocio.com"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar Alterações"}
              </button>
            </form>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Conta</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{usuario?.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {usuario?.email}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Plano Atual</h2>
            {assinatura ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      assinatura.status === "ativo" || assinatura.status === "trial"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {assinatura.status === "trial"
                      ? "Teste Grátis"
                      : assinatura.status === "ativo"
                      ? "Ativo"
                      : assinatura.status}
                  </span>
                </div>
                {assinatura.status === "trial" && diasTrial > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Faltam <strong>{diasTrial}</strong> dias para o término do
                    teste grátis.
                  </p>
                )}
                {assinatura.status === "trial" && diasTrial <= 0 && (
                  <p className="text-sm text-destructive">
                    Seu período de teste expirou. Assine um plano para continuar.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma assinatura ativa.
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Ajuda</h2>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-accent">
                <span>📖</span> Documentação
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-accent">
                <span>❓</span> FAQ
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-accent">
                <span>💬</span> Suporte
              </button>
              <button className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-accent">
                <span>📱</span> Instalar App
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
