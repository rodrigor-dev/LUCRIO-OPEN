-- Migration 009: View de assinaturas com todos os usuarios
-- Execute no SQL Editor do Supabase

-- Função que retorna TODOS os usuarios com seu status de assinatura
CREATE OR REPLACE FUNCTION get_usuarios_assinaturas()
RETURNS TABLE (
    usuario_id UUID,
    usuario_nome TEXT,
    usuario_email TEXT,
    usuario_avatar TEXT,
    usuario_criado_em TIMESTAMPTZ,
    is_admin BOOLEAN,
    is_ativo BOOLEAN,
    assinatura_id UUID,
    plano_id UUID,
    plano_nome TEXT,
    plano_preco NUMERIC,
    status TEXT,
    inicio_periodo TIMESTAMPTZ,
    fim_periodo TIMESTAMPTZ,
    trial_termina TIMESTAMPTZ,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.nome,
        u.email,
        u.avatar_url,
        u.criado_em,
        COALESCE(u.is_admin, false),
        COALESCE(u.is_ativo, true),
        a.id,
        a.plano_id,
        p.nome,
        p.preco_mensal,
        a.status,
        a.inicio_periodo,
        a.fim_periodo,
        a.trial_termina,
        a.criado_em
    FROM usuarios u
    LEFT JOIN assinaturas a ON a.usuario_id = u.id
        AND a.id = (
            SELECT a2.id FROM assinaturas a2
            WHERE a2.usuario_id = u.id
            ORDER BY
                CASE a2.status
                    WHEN 'ativo' THEN 1
                    WHEN 'trial' THEN 2
                    WHEN 'cancelado' THEN 3
                    ELSE 4
                END,
                a2.criado_em DESC
            LIMIT 1
        )
    LEFT JOIN planos p ON p.id = a.plano_id
    ORDER BY
        CASE
            WHEN a.status = 'ativo' THEN 1
            WHEN a.status = 'trial' THEN 2
            WHEN a.status IS NULL THEN 3
            ELSE 4
        END,
        u.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
