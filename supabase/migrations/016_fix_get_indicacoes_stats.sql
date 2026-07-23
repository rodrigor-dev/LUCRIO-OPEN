-- ============================================================
-- 016: Corrigir bug real de SQL em get_indicacoes_stats
-- ============================================================
-- Causa raiz confirmada do erro "Erro ao carregar indicações":
-- a função original fazia
--   SELECT jsonb_agg(jsonb_build_object(..., 'criado_em', i.criado_em))
--   FROM indicacoes i ...
--   ORDER BY i.criado_em DESC
--   LIMIT 10;
-- Isso é inválido no Postgres: quando se usa uma função de agregação
-- (jsonb_agg) sem GROUP BY, a consulta inteira vira uma única linha
-- agregada, e não é permitido usar ORDER BY numa coluna que não está
-- dentro de uma agregação nem em GROUP BY. Por isso a função falhava
-- SEMPRE que era chamada, com o erro:
--   column "i.criado_em" must appear in the GROUP BY clause or be
--   used in an aggregate function
-- A correção: ordenar e limitar numa subconsulta comum (sem agregação),
-- e só agregar em JSON depois, na consulta de fora.
-- ============================================================

CREATE OR REPLACE FUNCTION get_indicacoes_stats(p_usuario_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_codigo TEXT;
  v_total_indicacoes INTEGER;
  v_total_convertidas INTEGER;
  v_total_recompensas NUMERIC;
  v_indicacoes_recentes JSONB;
BEGIN
  SELECT codigo, total_indicacoes, total_recompensas
  INTO v_codigo, v_total_indicacoes, v_total_recompensas
  FROM codigos_indicacao
  WHERE usuario_id = p_usuario_id AND is_ativo = true;

  IF v_codigo IS NULL THEN
    v_codigo := gerar_codigo_indicacao(p_usuario_id);
    v_total_indicacoes := 0;
    v_total_recompensas := 0;
  END IF;

  SELECT COUNT(*) INTO v_total_convertidas
  FROM indicacoes
  WHERE indicador_id = p_usuario_id AND status IN ('convertida', 'recompensada');

  -- Ultimas 10 indicacoes (ordenadas e limitadas numa subconsulta comum,
  -- só depois agregadas em JSON — evita o erro de ORDER BY + agregação)
  SELECT jsonb_agg(row_to_json(t)) INTO v_indicacoes_recentes
  FROM (
    SELECT
      i.id,
      COALESCE(u.nome, 'Novo usuario') AS indicado_nome,
      u.email AS indicado_email,
      i.status,
      i.criado_em
    FROM indicacoes i
    LEFT JOIN usuarios u ON u.id = i.indicado_id
    WHERE i.indicador_id = p_usuario_id
    ORDER BY i.criado_em DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'codigo', v_codigo,
    'total_indicacoes', COALESCE(v_total_indicacoes, 0),
    'total_convertidas', COALESCE(v_total_convertidas, 0),
    'total_recompensas', COALESCE(v_total_recompensas, 0),
    'indicacoes', COALESCE(v_indicacoes_recentes, '[]'::jsonb)
  );
END;
$$;
