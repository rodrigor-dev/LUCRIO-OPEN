-- Migration 007: Funções SQL SECURITY DEFINER para painel admin
-- Bypassa RLS para admin ver dados reais de todas as tabelas

-- ============================================================
-- 1. Stats do dashboard admin
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS TABLE (
    total_usuarios BIGINT,
    usuarios_ativos BIGINT,
    usuarios_inativos BIGINT,
    novos_hoje BIGINT,
    novos_mes BIGINT,
    total_negocios BIGINT,
    total_clientes BIGINT,
    total_receitas BIGINT,
    total_despesas BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM usuarios)::BIGINT,
        (SELECT COUNT(*) FROM usuarios WHERE is_ativo = true)::BIGINT,
        (SELECT COUNT(*) FROM usuarios WHERE is_ativo = false)::BIGINT,
        (SELECT COUNT(*) FROM usuarios WHERE criado_em::date = CURRENT_DATE)::BIGINT,
        (SELECT COUNT(*) FROM usuarios WHERE criado_em >= date_trunc('month', CURRENT_DATE))::BIGINT,
        (SELECT COUNT(*) FROM negocios)::BIGINT,
        (SELECT COUNT(*) FROM clientes)::BIGINT,
        (SELECT COUNT(*) FROM receitas)::BIGINT,
        (SELECT COUNT(*) FROM despesas)::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Financeiro do admin (MRR real)
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_financeiro()
RETURNS TABLE (
    mrr NUMERIC,
    arr_estimado NUMERIC,
    total_assinaturas_ativas BIGINT,
    total_cancelamentos BIGINT,
    total_trials BIGINT
) AS $$
DECLARE
    v_mrr NUMERIC := 0;
    v_ativos BIGINT;
    v_cancelados BIGINT;
    v_trials BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_ativos FROM assinaturas WHERE status = 'ativo';
    SELECT COUNT(*) INTO v_cancelados FROM assinaturas WHERE status = 'cancelado';
    SELECT COUNT(*) INTO v_trials FROM assinaturas WHERE status = 'trial';

    -- MRR: soma dos preços dos planos das assinaturas ativas
    SELECT COALESCE(SUM(p.preco_mensal), 0) INTO v_mrr
    FROM assinaturas a
    JOIN planos p ON p.id = a.plano_id
    WHERE a.status = 'ativo';

    RETURN QUERY SELECT
        v_mrr,
        v_mrr * 12,
        v_ativos,
        v_cancelados,
        v_trials;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Listar todos os usuarios (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_usuarios()
RETURNS TABLE (
    id UUID,
    email TEXT,
    nome TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN,
    is_ativo BOOLEAN,
    is_bloqueado BOOLEAN,
    is_suspendido BOOLEAN,
    trial_termina_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ,
    role_slug TEXT,
    role_nome TEXT
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
        COALESCE(u.is_bloqueado, false),
        COALESCE(u.is_suspendido, false),
        u.trial_termina_em,
        u.criado_em,
        r.slug,
        r.nome
    FROM usuarios u
    LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. Listar assinaturas com joins (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_assinaturas()
RETURNS TABLE (
    id UUID,
    usuario_id UUID,
    plano_id TEXT,
    status TEXT,
    inicio_periodo TIMESTAMPTZ,
    fim_periodo TIMESTAMPTZ,
    trial_termina TIMESTAMPTZ,
    criado_em TIMESTAMPTZ,
    usuario_nome TEXT,
    usuario_email TEXT,
    plano_nome TEXT,
    plano_preco NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.usuario_id,
        a.plano_id,
        a.status,
        a.inicio_periodo,
        a.fim_periodo,
        a.trial_termina,
        a.criado_em,
        u.nome,
        u.email,
        p.nome,
        p.preco_mensal
    FROM assinaturas a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    LEFT JOIN planos p ON p.id = a.plano_id
    ORDER BY a.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Listar planos (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_planos()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    slug TEXT,
    descricao TEXT,
    preco_mensal NUMERIC,
    preco_anual NUMERIC,
    is_ativo BOOLEAN,
    is_destaque BOOLEAN,
    ordem INTEGER,
    funcionalidades JSONB,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.nome,
        p.slug,
        p.descricao,
        p.preco_mensal,
        p.preco_anual,
        p.is_ativo,
        COALESCE(p.is_destaque, false),
        COALESCE(p.ordem, 0),
        p.funcionalidades,
        p.criado_em
    FROM planos p
    ORDER BY p.ordem;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Listar cupons (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_cupons()
RETURNS TABLE (
    id UUID,
    codigo TEXT,
    descricao TEXT,
    tipo_desconto TEXT,
    valor_desconto NUMERIC,
    max_utilizacoes INTEGER,
    utilizacoes INTEGER,
    is_ativo BOOLEAN,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.codigo,
        c.descricao,
        c.tipo_desconto,
        c.valor_desconto,
        c.max_utilizacoes,
        c.utilizacoes,
        c.is_ativo,
        c.criado_em
    FROM cupons c
    ORDER BY c.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. Listar auditoria (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_auditoria(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    usuario_id UUID,
    usuario_email TEXT,
    acao TEXT,
    entidade TEXT,
    entidade_id UUID,
    dados_antes JSONB,
    dados_depois JSONB,
    ip_address TEXT,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.usuario_id,
        a.usuario_email,
        a.acao,
        a.entidade,
        a.entidade_id,
        a.dados_antes,
        a.dados_depois,
        a.ip_address,
        a.criado_em
    FROM auditoria a
    ORDER BY a.criado_em DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. Listar system_logs (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_logs(p_limit INTEGER DEFAULT 200)
RETURNS TABLE (
    id UUID,
    nivel TEXT,
    mensagem TEXT,
    detalhes JSONB,
    usuario_email TEXT,
    rota TEXT,
    status_code INTEGER,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.nivel,
        l.mensagem,
        l.detalhes,
        l.usuario_email,
        l.rota,
        l.status_code,
        l.criado_em
    FROM system_logs l
    ORDER BY l.criado_em DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. Listar tickets suporte (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_tickets()
RETURNS TABLE (
    id UUID,
    usuario_id UUID,
    assunto TEXT,
    mensagem TEXT,
    status TEXT,
    prioridade TEXT,
    categoria TEXT,
    criado_em TIMESTAMPTZ,
    usuario_nome TEXT,
    usuario_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.usuario_id,
        t.assunto,
        t.mensagem,
        t.status,
        t.prioridade,
        t.categoria,
        t.criado_em,
        u.nome,
        u.email
    FROM suporte_tickets t
    LEFT JOIN usuarios u ON u.id = t.usuario_id
    ORDER BY t.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. Listar avisos (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_avisos()
RETURNS TABLE (
    id UUID,
    titulo TEXT,
    mensagem TEXT,
    tipo TEXT,
    destinatario TEXT,
    is_ativo BOOLEAN,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.titulo,
        a.mensagem,
        a.tipo,
        a.destinatario,
        a.is_ativo,
        a.criado_em
    FROM avisos_globais a
    ORDER BY a.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 11. Listar feature flags (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_feature_flags()
RETURNS TABLE (
    id UUID,
    chave TEXT,
    descricao TEXT,
    is_ativo BOOLEAN,
    destinatario TEXT,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.chave,
        f.descricao,
        f.is_ativo,
        f.destinatario,
        f.criado_em
    FROM feature_flags f
    ORDER BY f.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 12. Listar configs globais (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_configuracoes()
RETURNS TABLE (
    id UUID,
    chave TEXT,
    valor TEXT,
    tipo TEXT,
    descricao TEXT,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.chave,
        c.valor,
        c.tipo,
        c.descricao,
        c.criado_em
    FROM configuracoes_globais c
    ORDER BY c.chave;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 13. Listar backups (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_backups()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    tamanho_bytes BIGINT,
    status TEXT,
    tipo TEXT,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.nome,
        b.tamanho_bytes,
        b.status,
        b.tipo,
        b.criado_em
    FROM backups b
    ORDER BY b.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 14. Listar atualizações (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_atualizacoes()
RETURNS TABLE (
    id UUID,
    versao TEXT,
    titulo TEXT,
    descricao TEXT,
    tipo TEXT,
    is_visivel BOOLEAN,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.versao,
        a.titulo,
        a.descricao,
        a.tipo,
        a.is_visivel,
        a.criado_em
    FROM atualizacoes a
    ORDER BY a.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 15. Listar roles (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_roles()
RETURNS TABLE (
    id UUID,
    nome TEXT,
    slug TEXT,
    descricao TEXT,
    permissoes JSONB,
    is_sistema BOOLEAN,
    criado_em TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.nome,
        r.slug,
        r.descricao,
        r.permissoes,
        r.is_sistema,
        r.criado_em
    FROM roles r
    ORDER BY r.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 16. Dados para gráficos: crescimento mensal de usuarios
-- ============================================================
CREATE OR REPLACE FUNCTION get_usuario_crescimento_mensal()
RETURNS TABLE (mes TEXT, total BIGINT) AS $$
DECLARE
    i INTEGER;
    d DATE;
    mes_nome TEXT;
    count_val BIGINT;
BEGIN
    FOR i IN 0..5 LOOP
        d := date_trunc('month', CURRENT_DATE) - (i || ' months')::interval;
        mes_nome := TO_CHAR(d, 'Mon');
        SELECT COUNT(*) INTO count_val
        FROM usuarios
        WHERE criado_em < (d + interval '1 month');
        RETURN QUERY SELECT mes_nome, count_val;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 17. Dados para gráficos: receita mensal real
-- ============================================================
CREATE OR REPLACE FUNCTION get_receita_mensal()
RETURNS TABLE (mes TEXT, receita NUMERIC) AS $$
DECLARE
    i INTEGER;
    d DATE;
    mes_nome TEXT;
    val NUMERIC;
BEGIN
    FOR i IN 0..5 LOOP
        d := date_trunc('month', CURRENT_DATE) - (i || ' months')::interval;
        mes_nome := TO_CHAR(d, 'Mon');
        SELECT COALESCE(SUM(p.preco_mensal), 0) INTO val
        FROM assinaturas a
        JOIN planos p ON p.id = a.plano_id
        WHERE a.status = 'ativo'
        AND a.criado_em < (d + interval '1 month');
        RETURN QUERY SELECT mes_nome, val;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 18. Dados para gráficos: distribuição de planos
-- ============================================================
CREATE OR REPLACE FUNCTION get_plano_distribuicao()
RETURNS TABLE (nome TEXT, value BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(p.nome, 'Sem plano')::TEXT,
        COUNT(*)::BIGINT
    FROM assinaturas a
    LEFT JOIN planos p ON p.id = a.plano_id
    WHERE a.status IN ('ativo', 'trial')
    GROUP BY p.nome
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 19. Salvar configuração (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION save_configuracao(p_chave TEXT, p_valor TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE configuracoes_globais SET valor = p_valor, atualizado_em = NOW() WHERE chave = p_chave;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
