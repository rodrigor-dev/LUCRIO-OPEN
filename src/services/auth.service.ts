import { createClient } from "@/lib/supabase/client";
import type { Usuario } from "@/types/database";

export interface UserProfile extends Usuario {
  role_slug?: string;
  role_nome?: string;
  permissoes?: string[];
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * AuthService — ÚNICA fonte de verdade para autenticação e permissões.
 *
 * TODA verificação de admin/permissão deve usar este serviço.
 * NUNCA verificar is_admin diretamente em componentes.
 */
class AuthService {
  private supabase = createClient();

  /**
   * Obtém o usuário autenticado do Supabase Auth
   */
  async getAuthUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  }

  /**
   * Obtém o perfil completo do usuário (usuarios + roles)
   * Esta é a ÚNICA função que deve ser usada para carregar dados do usuário.
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from("usuarios")
      .select(`
        *,
        role:roles(slug, nome, permissoes)
      `)
      .eq("id", userId)
      .single();

    if (error || !data) return null;

    const profile: UserProfile = {
      ...data,
      role_slug: data.role?.slug,
      role_nome: data.role?.nome,
      permissoes: data.role?.permissoes,
    };

    return profile;
  }

  /**
   * Verifica se o usuário é admin.
   * Esta é a ÚNICA função que deve ser usada para checar admin.
   */
  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("usuarios")
      .select("is_admin")
      .eq("id", userId)
      .single();

    if (error || !data) return false;
    return data.is_admin === true;
  }

  /**
   * Verifica se o usuário é admin de forma síncrona (requer perfil carregado).
   * Use apenas quando já tiver o UserProfile carregado.
   */
  isUserAdmin(profile: UserProfile | null): boolean {
    return profile?.is_admin === true;
  }

  /**
   * Verifica se o usuário tem uma permissão específica.
   */
  hasPermission(profile: UserProfile | null, permission: string): boolean {
    if (!profile) return false;
    if (profile.is_admin) return true; // Admin tem todas as permissões
    if (!profile.permissoes) return false;
    return profile.permissoes.includes("*") || profile.permissoes.includes(permission);
  }

  /**
   * Verifica se o usuário pode acessar uma rota admin.
   */
  canAccessAdmin(profile: UserProfile | null): boolean {
    return this.isUserAdmin(profile);
  }

  /**
   * Cria conta com email e senha.
   * Retorna erro se houver problema.
   */
  async criarConta(
    email: string,
    senha: string,
    nome: string
  ): Promise<{ usuario: Usuario | null; erro?: string; requiresEmailConfirmation?: boolean }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { usuario: null, erro: error.message };
    }

    // Se não retornou sessão, email confirmation está habilitado
    if (!data.session) {
      return {
        usuario: null,
        requiresEmailConfirmation: true,
      };
    }

    // Sessão existe → inserir perfil imediatamente
    if (data.user) {
      const { error: insertError } = await this.supabase.from("usuarios").insert({
        id: data.user.id,
        email: data.user.email!,
        nome,
        is_ativo: true,
        is_admin: false,
      });

      if (insertError) {
        console.error("[AuthService] Erro ao criar perfil:", insertError);
        return { usuario: null, erro: insertError.message };
      }

      // Criar trial
      await this.criarTrial(data.user.id);

      // Buscar perfil criado
      const usuario = await this.getUserProfile(data.user.id);
      return { usuario };
    }

    return { usuario: null };
  }

  /**
   * Login com email e senha.
   */
  async entrarComEmail(
    email: string,
    senha: string
  ): Promise<{ erro?: string; user?: Usuario }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      return { erro: error.message };
    }

    if (data.user) {
      const usuario = await this.getUserProfile(data.user.id);
      return { user: usuario ?? undefined };
    }

    return {};
  }

  /**
   * Login com Google OAuth.
   */
  async entrarComGoogle(): Promise<{ erro?: string }> {
    const { error } = await this.supabase.auth.signInWithOAuth({
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

  /**
   * Criar trial de 7 dias para novo usuário.
   */
  private async criarTrial(usuarioId: string): Promise<void> {
    const trialTerminaEm = new Date();
    trialTerminaEm.setDate(trialTerminaEm.getDate() + 7);

    // Buscar plano PRO
    const { data: plano } = await this.supabase
      .from("planos")
      .select("id")
      .eq("is_ativo", true)
      .order("preco_mensal", { ascending: true })
      .limit(1)
      .single();

    if (!plano) return;

    await this.supabase.from("assinaturas").insert({
      usuario_id: usuarioId,
      plano_id: plano.id,
      status: "trial",
      trial_termina: trialTerminaEm.toISOString(),
      inicio_periodo: new Date().toISOString(),
      fim_periodo: trialTerminaEm.toISOString(),
    });

    await this.supabase
      .from("usuarios")
      .update({ trial_termina_em: trialTerminaEm.toISOString() })
      .eq("id", usuarioId);
  }

  /**
   * Recuperar senha.
   */
  async recuperarSenha(email: string): Promise<{ erro?: string }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      return { erro: error.message };
    }

    return {};
  }

  /**
   * Redefinir senha.
   */
  async redefinirSenha(novaSenha: string): Promise<{ erro?: string }> {
    const { error } = await this.supabase.auth.updateUser({
      password: novaSenha,
    });

    if (error) {
      return { erro: error.message };
    }

    return {};
  }

  /**
   * Sair do sistema.
   */
  async sair(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}

// Singleton — única instância para todo o app
export const authService = new AuthService();

// Funções de conveniência (backward compatibility)
export const criarConta = (email: string, senha: string, nome: string) =>
  authService.criarConta(email, senha, nome);

export const entrarComEmail = (email: string, senha: string) =>
  authService.entrarComEmail(email, senha);

export const entrarComGoogle = () =>
  authService.entrarComGoogle();

export const recuperarSenha = (email: string) =>
  authService.recuperarSenha(email);

export const redefinirSenha = (novaSenha: string) =>
  authService.redefinirSenha(novaSenha);

export const sair = () =>
  authService.sair();

export const obterUsuarioAtual = () =>
  authService.getAuthUser();
