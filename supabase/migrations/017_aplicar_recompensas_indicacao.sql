-- ============================================================
-- 017: Aplicar recompensas de indicacao imediatamente
-- ============================================================
-- Bug: registrar_indicacao criava os registros de recompensa
-- (tabela recompensas_indicacao) mas nunca chamava
-- processar_recompensa_indicacao, que e a funcao que de fato
-- soma os dias extras na assinatura do usuario.
-- Resultado: recompensa registrada no banco, mas usuario nunca
-- via os dias a mais na pratica.
-- Correcao: chamar processar_recompensa_indicacao imediatamente
-- apos criar cada recompensa, tanto para indicador quanto indicado.
-- ============================================================

CREATE OR REPLACE FUNCTION registrar_indicacao(
  p_indicador_codigo TEXT,
  p_indicado_id UUID,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_indicador_id UUID;
  v_indicacao_id UUID;
  v_codigo_record RECORD;
  v_campanha RECORD;
  v_recompensa_indicador_id UUID;
  v_recompensa_indicado_id UUID;
BEGIN
  -- Buscar codigo
  SELECT id, usuario_id, total_indicacoes INTO v_codigo_record
  FROM codigos_indicacao
  WHERE codigo = p_indicador_codigo AND is_ativo = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Codigo de indicacao invalido');
  END IF;

  v_indicador_id := v_codigo_record.usuario_id;

  -- Auto-indicacao
  IF v_indicador_id = p_indicado_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Voce nao pode indicar a si mesmo');
  END IF;

  -- Ja foi indicado antes
  IF EXISTS(SELECT 1 FROM indicacoes WHERE indicado_id = p_indicado_id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Este usuario ja foi indicado');
  END IF;

  -- Buscar campanha ativa
  SELECT * INTO v_campanha
  FROM campanhas_indicacao
  WHERE is_ativo = true
    AND (data_inicio IS NULL OR data_inicio <= now())
    AND (data_fim IS NULL OR data_fim >= now())
  ORDER BY criado_em DESC
  LIMIT 1;

  -- Verificar limites
  IF v_campanha IS NOT NULL AND v_campanha.max_indicacoes_por_usuario > 0 THEN
    IF v_codigo_record.total_indicacoes >= v_campanha.max_indicacoes_por_usuario THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Voce atingiu o limite de indicacoes');
    END IF;
  END IF;

  -- Criar indicacao
  INSERT INTO indicacoes (indicador_id, indicado_id, codigo_usado, ip_indicado, user_agent_indicado)
  VALUES (v_indicador_id, p_indicado_id, p_indicador_codigo, p_ip, p_user_agent)
  RETURNING id INTO v_indicacao_id;

  -- Atualizar contador do indicador
  UPDATE codigos_indicacao
  SET total_indicacoes = total_indicacoes + 1,
      atualizado_em = now()
  WHERE id = v_codigo_record.id;

  -- Criar e APLICAR recompensas se campanha existir
  IF v_campanha IS NOT NULL THEN
    -- Recompensa para indicador
    INSERT INTO recompensas_indicacao (usuario_id, indicacao_id, tipo, valor, descricao)
    VALUES (
      v_indicador_id,
      v_indicacao_id,
      v_campanha.recompensa_indicador_tipo,
      v_campanha.recompensa_indicador_valor,
      FORMAT('Indicacao convertida: +%s %s', v_campanha.recompensa_indicador_valor,
        CASE v_campanha.recompensa_indicador_tipo
          WHEN 'dias_trial' THEN 'dias de trial'
          WHEN 'meses_gratis' THEN 'meses gratis'
          WHEN 'desconto' THEN '% de desconto'
        END)
    )
    RETURNING id INTO v_recompensa_indicador_id;

    -- Aplicar recompensa do indicador imediatamente
    PERFORM processar_recompensa_indicacao(v_recompensa_indicador_id);

    -- Recompensa para indicado
    INSERT INTO recompensas_indicacao (usuario_id, indicacao_id, tipo, valor, descricao)
    VALUES (
      p_indicado_id,
      v_indicacao_id,
      v_campanha.recompensa_indicado_tipo,
      v_campanha.recompensa_indicado_valor,
      FORMAT('Bem-vindo! +%s %s de bonus', v_campanha.recompensa_indicado_valor,
        CASE v_campanha.recompensa_indicado_tipo
          WHEN 'dias_trial' THEN 'dias de trial'
          WHEN 'meses_gratis' THEN 'meses gratis'
          WHEN 'desconto' THEN '% de desconto'
        END)
    )
    RETURNING id INTO v_recompensa_indicado_id;

    -- Aplicar recompensa do indicado imediatamente
    PERFORM processar_recompensa_indicacao(v_recompensa_indicado_id);
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'indicacao_id', v_indicacao_id,
    'recompensas', jsonb_build_object(
      'indicador_dias', COALESCE(v_campanha.recompensa_indicador_valor, 15),
      'indicado_dias', COALESCE(v_campanha.recompensa_indicado_valor, 7)
    )
  );
END;
$$;
