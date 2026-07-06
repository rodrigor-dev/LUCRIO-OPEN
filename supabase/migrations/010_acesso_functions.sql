-- Migration 010: Funções de gerenciamento de acesso (SECURITY DEFINER)
-- Execute no SQL Editor do Supabase

-- Conceder acesso por X dias
CREATE OR REPLACE FUNCTION conceder_acesso(p_usuario_id UUID, p_dias INTEGER)
RETURNS VOID AS $$
DECLARE
    v_plano_id UUID;
    v_inicio TIMESTAMPTZ := NOW();
    v_fim TIMESTAMPTZ;
    v_existente_id UUID;
BEGIN
    SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' AND is_ativo = true LIMIT 1;
    IF v_plano_id IS NULL THEN
        RAISE EXCEPTION 'Plano PRO nao encontrado';
    END IF;

    v_fim := v_inicio + (p_dias || ' days')::interval;

    SELECT id INTO v_existente_id FROM assinaturas
    WHERE usuario_id = p_usuario_id AND status IN ('trial', 'ativo')
    LIMIT 1;

    IF v_existente_id IS NOT NULL THEN
        UPDATE assinaturas SET
            status = 'ativo',
            plano_id = v_plano_id,
            fim_periodo = v_fim,
            trial_termina = v_inicio
        WHERE id = v_existente_id;
    ELSE
        INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
        VALUES (p_usuario_id, v_plano_id, 'ativo', v_inicio, v_inicio, v_fim);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Acesso vitalicio (100 anos)
CREATE OR REPLACE FUNCTION acesso_vitalicio(p_usuario_id UUID)
RETURNS VOID AS $$
DECLARE
    v_plano_id UUID;
    v_inicio TIMESTAMPTZ := NOW();
    v_fim TIMESTAMPTZ;
    v_existente_id UUID;
BEGIN
    SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' AND is_ativo = true LIMIT 1;
    IF v_plano_id IS NULL THEN
        RAISE EXCEPTION 'Plano PRO nao encontrado';
    END IF;

    v_fim := v_inicio + interval '100 years';

    SELECT id INTO v_existente_id FROM assinaturas
    WHERE usuario_id = p_usuario_id AND status IN ('trial', 'ativo')
    LIMIT 1;

    IF v_existente_id IS NOT NULL THEN
        UPDATE assinaturas SET
            status = 'ativo',
            plano_id = v_plano_id,
            fim_periodo = v_fim,
            trial_termina = v_inicio
        WHERE id = v_existente_id;
    ELSE
        INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
        VALUES (p_usuario_id, v_plano_id, 'ativo', v_inicio, v_inicio, v_fim);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Estender trial
CREATE OR REPLACE FUNCTION estender_trial(p_usuario_id UUID, p_dias INTEGER)
RETURNS VOID AS $$
DECLARE
    v_plano_id UUID;
    v_existente RECORD;
    v_novo_trial TIMESTAMPTZ;
    v_novo_fim TIMESTAMPTZ;
BEGIN
    SELECT id, trial_termina INTO v_existente.id, v_existente.trial_termina
    FROM assinaturas
    WHERE usuario_id = p_usuario_id AND status = 'trial'
    LIMIT 1;

    IF v_existente.id IS NOT NULL THEN
        v_novo_trial := COALESCE(v_existente.trial_termina, NOW()) + (p_dias || ' days')::interval;
        UPDATE assinaturas SET trial_termina = v_novo_trial WHERE id = v_existente.id;
    ELSE
        SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' AND is_ativo = true LIMIT 1;
        IF v_plano_id IS NULL THEN
            RAISE EXCEPTION 'Plano PRO nao encontrado';
        END IF;
        v_novo_trial := NOW() + (p_dias || ' days')::interval;
        v_novo_fim := NOW() + (p_dias || ' days')::interval;
        INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
        VALUES (p_usuario_id, v_plano_id, 'trial', v_novo_trial, NOW(), v_novo_fim);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Estender periodo de assinatura ativa
CREATE OR REPLACE FUNCTION estender_periodo(p_assinatura_id UUID, p_dias INTEGER)
RETURNS VOID AS $$
DECLARE
    v_novo_fim TIMESTAMPTZ;
BEGIN
    SELECT COALESCE(fim_periodo, NOW()) + (p_dias || ' days')::interval INTO v_novo_fim
    FROM assinaturas WHERE id = p_assinatura_id;

    UPDATE assinaturas SET
        fim_periodo = v_novo_fim,
        status = 'ativo'
    WHERE id = p_assinatura_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancelar assinatura
CREATE OR REPLACE FUNCTION cancelar_assinatura(p_assinatura_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE assinaturas SET status = 'cancelado' WHERE id = p_assinatura_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reativar assinatura
CREATE OR REPLACE FUNCTION reativar_assinatura(p_assinatura_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE assinaturas SET status = 'ativo' WHERE id = p_assinatura_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tornar admin / remover admin
CREATE OR REPLACE FUNCTION toggle_admin(p_usuario_id UUID, p_is_admin BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE usuarios SET is_admin = p_is_admin WHERE id = p_usuario_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
