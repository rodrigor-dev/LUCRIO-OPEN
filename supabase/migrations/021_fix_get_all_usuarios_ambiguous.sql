-- ============================================================
-- 021: Fix get_all_usuarios - criado_em ambiguo
-- ============================================================

DROP FUNCTION IF EXISTS get_all_usuarios();

CREATE OR REPLACE FUNCTION get_all_usuarios()
RETURNS TABLE (
    id UUID,
    email TEXT,
    nome TEXT,
    avatar_url TEXT,
    telefone TEXT,
    is_admin BOOLEAN,
    is_ativo BOOLEAN,
    is_bloqueado BOOLEAN,
    is_suspendido BOOLEAN,
    trial_termina_em TIMESTAMPTZ,
    ultimo_login_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ,
    role_slug TEXT,
    role_nome TEXT,
    assinatura_status TEXT,
    assinatura_fim_periodo TIMESTAMPTZ,
    assinatura_trial_termina TIMESTAMPTZ,
    plano_nome TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.nome,
        u.avatar_url,
        u.telefone,
        u.is_admin,
        COALESCE(u.is_ativo, true),
        COALESCE(u.is_bloqueado, false),
        COALESCE(u.is_suspendido, false),
        u.trial_termina_em,
        u.ultimo_login_em,
        u.criado_em,
        r.slug,
        r.nome,
        a.status,
        a.fim_periodo,
        a.trial_termina,
        p.nome
    FROM usuarios u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN LATERAL (
        SELECT ass.status, ass.fim_periodo, ass.trial_termina, ass.plano_id
        FROM assinaturas ass
        WHERE ass.usuario_id = u.id
        ORDER BY ass.criado_em DESC
        LIMIT 1
    ) a ON true
    LEFT JOIN planos p ON p.id = a.plano_id
    ORDER BY u.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
