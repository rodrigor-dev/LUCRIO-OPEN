-- Migration 024: Trigger para criar trial automaticamente para novos usuarios
-- Garante que TODO novo usuario receba 7 dias de trial
-- A funcao e SECURITY DEFINER para evitar problemas de RLS

-- Funcao que cria o trial
CREATE OR REPLACE FUNCTION criar_trial_para_novo_usuario()
RETURNS TRIGGER AS $$
DECLARE
    v_plano_id UUID;
    v_trial_fim TIMESTAMPTZ;
    v_ja_possui_assinatura BOOLEAN;
BEGIN
    -- Verificar se ja possui assinatura (evitar duplicar)
    SELECT EXISTS(
        SELECT 1 FROM assinaturas WHERE usuario_id = NEW.id LIMIT 1
    ) INTO v_ja_possui_assinatura;

    IF v_ja_possui_assinatura THEN
        RETURN NEW;
    END IF;

    -- Buscar plano PRO (ou qualquer plano ativo)
    SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' AND is_ativo = true LIMIT 1;

    IF v_plano_id IS NULL THEN
        SELECT id INTO v_plano_id FROM planos WHERE is_ativo = true ORDER BY preco_mensal ASC LIMIT 1;
    END IF;

    -- Se ainda nao tem plano, criar um PRO padrao
    IF v_plano_id IS NULL THEN
        INSERT INTO planos (nome, slug, descricao, preco_mensal, preco_anual, is_ativo, is_destaque, ordem, limite_clientes, funcionalidades)
        VALUES (
            'PRO', 'pro', 'Plano completo com todas as funcionalidades',
            14.99, 139.99, true, true, 1, -1,
            '["Clientes ilimitados","Receitas e despesas","Calendario financeiro","Relatorios avancados","Propostas","Suporte prioritario"]'::jsonb
        ) RETURNING id INTO v_plano_id;
    END IF;

    -- Criar trial de 7 dias
    v_trial_fim := NOW() + INTERVAL '7 days';

    INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
    VALUES (NEW.id, v_plano_id, 'trial', v_trial_fim, NOW(), v_trial_fim)
    ON CONFLICT DO NOTHING;

    -- Atualizar campo trial_termina_em no usuario
    UPDATE usuarios SET trial_termina_em = v_trial_fim WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: executa APOS INSERT na tabela usuarios
DROP TRIGGER IF EXISTS trigger_criar_trial ON usuarios;
CREATE TRIGGER trigger_criar_trial
    AFTER INSERT ON usuarios
    FOR EACH ROW EXECUTE FUNCTION criar_trial_para_novo_usuario();

-- Criar assinatura para usuarios existentes que nao tem trial
DO $$
DECLARE
    v_plano_id UUID;
    v_trial_fim TIMESTAMPTZ;
    v_usuario RECORD;
BEGIN
    -- Buscar plano PRO
    SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' AND is_ativo = true LIMIT 1;

    IF v_plano_id IS NULL THEN
        SELECT id INTO v_plano_id FROM planos WHERE is_ativo = true ORDER BY preco_mensal ASC LIMIT 1;
    END IF;

    IF v_plano_id IS NULL THEN
        RAISE NOTICE 'Nenhum plano ativo encontrado, criando plano PRO padrao';
        INSERT INTO planos (nome, slug, descricao, preco_mensal, preco_anual, is_ativo, is_destaque, ordem, limite_clientes, funcionalidades)
        VALUES (
            'PRO', 'pro', 'Plano completo com todas as funcionalidades',
            14.99, 139.99, true, true, 1, -1,
            '["Clientes ilimitados","Receitas e despesas","Calendario financeiro","Relatorios avancados","Propostas","Suporte prioritario"]'::jsonb
        ) RETURNING id INTO v_plano_id;
    END IF;

    v_trial_fim := NOW() + INTERVAL '7 days';

    -- Inserir trial para usuarios que nao tem nenhuma assinatura
    FOR v_usuario IN
        SELECT u.id FROM usuarios u
        WHERE NOT EXISTS (SELECT 1 FROM assinaturas a WHERE a.usuario_id = u.id)
    LOOP
        INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
        VALUES (v_usuario.id, v_plano_id, 'trial', v_trial_fim, NOW(), v_trial_fim)
        ON CONFLICT DO NOTHING;

        UPDATE usuarios SET trial_termina_em = v_trial_fim WHERE id = v_usuario.id;
    END LOOP;
END $$;
