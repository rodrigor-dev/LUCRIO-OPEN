-- Migration 006: Correção definitiva do sistema de auth/admin
-- Resolve: cadastro email/senha, RLS admin, permissões centralizadas

-- ============================================================
-- 1. CORRIGIR RLS DA TABELA USUARIOS
-- ============================================================

-- Remover políticas antigas que podem estar conflitantes
DROP POLICY IF EXISTS "usuarios_select_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_own" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_auth" ON usuarios;

-- SELECT: qualquer autenticado pode ler seu próprio perfil
CREATE POLICY "usuarios_select_own" ON usuarios
    FOR SELECT USING (auth.uid() = id);

-- SELECT admin: admin pode ler todos os usuários
CREATE POLICY "usuarios_select_admin" ON usuarios
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- INSERT: próprio usuário pode criar seu perfil (necessário para cadastro)
CREATE POLICY "usuarios_insert_own" ON usuarios
    FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: próprio usuário pode atualizar seu perfil
CREATE POLICY "usuarios_update_own" ON usuarios
    FOR UPDATE USING (auth.uid() = id);

-- UPDATE admin: admin pode atualizar qualquer usuário
CREATE POLICY "usuarios_update_admin" ON usuarios
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- DELETE admin: admin pode deletar usuários (soft delete via is_ativo)
-- Não permitir DELETE físico por segurança

-- ============================================================
-- 2. GARANTIR QUE IS_ADMIN E IS_ATIVO SÃO BOOLEAN NOT NULL
-- ============================================================
-- Converter NULL para false em ambos
UPDATE usuarios SET is_admin = false WHERE is_admin IS NULL;
UPDATE usuarios SET is_ativo = true WHERE is_ativo IS NULL;
ALTER TABLE usuarios ALTER COLUMN is_admin SET DEFAULT false;
ALTER TABLE usuarios ALTER COLUMN is_admin SET NOT NULL;
ALTER TABLE usuarios ALTER COLUMN is_ativo SET DEFAULT true;
ALTER TABLE usuarios ALTER COLUMN is_ativo SET NOT NULL;

-- ============================================================
-- 3. FUNÇÃO: Obter perfil do usuário com permissões
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    nome TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN,
    is_ativo BOOLEAN,
    trial_termina_em TIMESTAMPTZ,
    role_slug TEXT,
    role_nome TEXT,
    permissoes JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.nome,
        u.avatar_url,
        u.is_admin,
        u.is_ativo,
        u.trial_termina_em,
        r.slug AS role_slug,
        r.nome AS role_nome,
        r.permissoes
    FROM usuarios u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. FUNÇÃO: Verificar se usuário é admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT is_admin INTO v_is_admin
    FROM usuarios
    WHERE id = p_user_id;

    RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. FUNÇÃO: Obter status da assinatura
-- ============================================================
CREATE OR REPLACE FUNCTION get_subscription_status(p_user_id UUID)
RETURNS TABLE (
    status TEXT,
    is_trial BOOLEAN,
    is_active BOOLEAN,
    is_expired BOOLEAN,
    plan_name TEXT,
    days_remaining INTEGER,
    expires_at TIMESTAMPTZ,
    is_admin BOOLEAN
) AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_assinatura RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_diff_days INTEGER;
BEGIN
    -- Check admin first
    SELECT COALESCE(u.is_admin, false) INTO v_is_admin
    FROM usuarios u WHERE u.id = p_user_id;

    -- If admin, always return valid
    IF v_is_admin THEN
        RETURN QUERY SELECT
            'ativo'::TEXT,
            false,
            true,
            false,
            'Admin'::TEXT,
            999999,
            (NOW() + INTERVAL '10 years')::TIMESTAMPTZ,
            true;
        RETURN;
    END IF;

    -- Get latest subscription
    SELECT a.*, p.nome INTO v_assinatura
    FROM assinaturas a
    LEFT JOIN planos p ON p.id = a.plano_id
    WHERE a.usuario_id = p_user_id
    AND a.status IN ('trial', 'ativo')
    ORDER BY a.criado_em DESC
    LIMIT 1;

    IF v_assinatura IS NULL THEN
        RETURN QUERY SELECT
            'nenhum'::TEXT,
            false,
            false,
            true,
            'Gratuito'::TEXT,
            0,
            NULL::TIMESTAMPTZ,
            COALESCE(v_is_admin, false);
        RETURN;
    END IF;

    v_diff_days := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_assinatura.fim_periodo - v_now)) / 86400));

    RETURN QUERY SELECT
        v_assinatura.status,
        (v_assinatura.status = 'trial'),
        (v_assinatura.status = 'ativo' AND v_assinatura.fim_periodo > v_now),
        (v_assinatura.fim_periodo < v_now),
        COALESCE(v_assinatura.nome, 'PRO'),
        v_diff_days,
        v_assinatura.fim_periodo,
        COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
