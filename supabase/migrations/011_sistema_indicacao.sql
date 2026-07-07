-- ============================================================
-- Migration 011: SISTEMA DE INDICACAO / REFERRAL
-- ============================================================

-- ============================================================
-- 1. TABELA: codigos_indicacao
-- Cada usuario tem um codigo unico de indicacao
-- ============================================================
CREATE TABLE IF NOT EXISTS codigos_indicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo TEXT UNIQUE NOT NULL,
  total_indicacoes INTEGER DEFAULT 0,
  total_recompensas INTEGER DEFAULT 0,
  is_ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Um usuario so pode ter um codigo ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_codigos_indicacao_usuario
  ON codigos_indicacao(usuario_id) WHERE is_ativo = true;

-- Index para busca por codigo
CREATE INDEX IF NOT EXISTS idx_codigos_indicacao_codigo
  ON codigos_indicacao(codigo);

-- ============================================================
-- 2. TABELA: indicacoes
-- Registra cada indicacao feita
-- ============================================================
CREATE TABLE IF NOT EXISTS indicacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  indicado_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_usado TEXT NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'convertida', 'recompensada', 'cancelada')),
  trial_convertido BOOLEAN DEFAULT false,
  assinatura_gerada BOOLEAN DEFAULT false,
  ip_indicado TEXT,
  user_agent_indicado TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  -- Um usuario nao pode indicar a si mesmo
  CONSTRAINT indicacao_no_self_referral CHECK (indicador_id != indicado_id)
);

-- Um indicado so pode ser registrado uma vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_indicacoes_indicado
  ON indicacoes(indicado_id);

-- Index para buscar indicacoes de um indicador
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador
  ON indicacoes(indicador_id);

-- Index para status
CREATE INDEX IF NOT EXISTS idx_indicacoes_status
  ON indicacoes(status);

-- ============================================================
-- 3. TABELA: recompensas_indicacao
-- Registra recompensas concedidas
-- ============================================================
CREATE TABLE IF NOT EXISTS recompensas_indicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  indicacao_id UUID NOT NULL REFERENCES indicacoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('dias_trial', 'meses_gratis', 'desconto')),
  valor NUMERIC NOT NULL,
  descricao TEXT,
  aplicada BOOLEAN DEFAULT false,
  aplicada_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. TABELA: campanhas_indicacao
-- Configuracao de campanhas pelo admin
-- ============================================================
CREATE TABLE IF NOT EXISTS campanhas_indicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  -- Recompensa para quem indica
  recompensa_indicador_tipo TEXT DEFAULT 'dias_trial' CHECK (recompensa_indicador_tipo IN ('dias_trial', 'meses_gratis', 'desconto')),
  recompensa_indicador_valor NUMERIC DEFAULT 15,
  -- Recompensa para quem e indicado
  recompensa_indicado_tipo TEXT DEFAULT 'dias_trial' CHECK (recompensa_indicado_tipo IN ('dias_trial', 'meses_gratis', 'desconto')),
  recompensa_indicado_valor NUMERIC DEFAULT 7,
  -- Limites
  max_indicacoes_por_usuario INTEGER DEFAULT 0, -- 0 = ilimitado
  max_total_indicacoes INTEGER DEFAULT 0, -- 0 = ilimitado
  -- Validade
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  -- Anti-fraud
  bloquear_temp_emails BOOLEAN DEFAULT true,
  dominios_bloqueados TEXT[] DEFAULT ARRAY['tempmail.com', 'guerrillamail.com', 'mailinator.com', 'throwaway.email', 'yopmail.com'],
  -- Status
  is_ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Campanha ativa padrao
INSERT INTO campanhas_indicacao (nome, descricao, recompensa_indicador_valor, recompensa_indicado_valor, is_ativo)
VALUES (
  'Indique e Ganhe',
  'Convide amigos e ganhe 15 dias de trial extra. Seu amigo tambem ganha 7 dias extras!',
  15,
  7,
  true
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================
ALTER TABLE codigos_indicacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recompensas_indicacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanhas_indicacao ENABLE ROW LEVEL SECURITY;

-- codigos_indicacao: usuario ve seu proprio codigo
CREATE POLICY "Usuarios veem seu codigo" ON codigos_indicacao
  FOR SELECT USING (auth.uid() = usuario_id);

-- indicacoes: usuario ve suas indicacoes (como indicador)
CREATE POLICY "Indicador ve suas indicacoes" ON indicacoes
  FOR SELECT USING (auth.uid() = indicador_id);

-- indicacoes: usuario indicado ve a si mesmo
CREATE POLICY "Indicado ve sua indicacao" ON indicacoes
  FOR SELECT USING (auth.uid() = indicado_id);

-- recompensas_indicacao: usuario ve suas recompensas
CREATE POLICY "Usuario ve suas recompensas" ON recompensas_indicacao
  FOR SELECT USING (auth.uid() = usuario_id);

-- campanhas_indicacao: todos veem campanhas ativas
CREATE POLICY "Campanhas ativas visiveis" ON campanhas_indicacao
  FOR SELECT USING (is_ativo = true);

-- Admin policies (SECURITY DEFINER)
CREATE POLICY "Admin gerencia codigos" ON codigos_indicacao
  FOR ALL USING (is_user_admin());

CREATE POLICY "Admin gerencia indicacoes" ON indicacoes
  FOR ALL USING (is_user_admin());

CREATE POLICY "Admin gerencia recompensas" ON recompensas_indicacao
  FOR ALL USING (is_user_admin());

CREATE POLICY "Admin gerencia campanhas" ON campanhas_indicacao
  FOR ALL USING (is_user_admin());

-- ============================================================
-- 6. FUNCOES SECURITY DEFINER
-- ============================================================

-- Gerar codigo de indicacao para um usuario
CREATE OR REPLACE FUNCTION gerar_codigo_indicacao(p_usuario_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_codigo TEXT;
  v_existe BOOLEAN;
BEGIN
  -- Verificar se ja tem codigo ativo
  SELECT codigo INTO v_codigo
  FROM codigos_indicacao
  WHERE usuario_id = p_usuario_id AND is_ativo = true;

  IF v_codigo IS NOT NULL THEN
    RETURN v_codigo;
  END IF;

  -- Gerar codigo unico (6 caracteres alfanumericos maiusculos)
  LOOP
    v_codigo := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM codigos_indicacao WHERE codigo = v_codigo) INTO v_existe;
    EXIT WHEN NOT v_existe;
  END LOOP;

  INSERT INTO codigos_indicacao (usuario_id, codigo)
  VALUES (p_usuario_id, v_codigo);

  RETURN v_codigo;
END;
$$;

-- Registrar uma indicacao (chamado quando usuario novo se cadastra com codigo)
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

  -- Criar recompensas se campanha existir
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
    );

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
    );
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

-- Processar recompensa (estender trial do indicador)
CREATE OR REPLACE FUNCTION processar_recompensa_indicacao(p_recompensa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recompensa RECORD;
  v_usuario RECORD;
  v_nova_data TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_recompensa
  FROM recompensas_indicacao
  WHERE id = p_recompensa_id AND aplicada = false;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO v_usuario
  FROM usuarios
  WHERE id = v_recompensa.usuario_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Calcular nova data
  IF v_recompensa.tipo = 'dias_trial' THEN
    v_nova_data := COALESCE(v_usuario.trial_termina_em, now()) + (v_recompensa.valor || ' days')::INTERVAL;
  ELSIF v_recompensa.tipo = 'meses_gratis' THEN
    v_nova_data := COALESCE(v_usuario.trial_termina_em, now()) + (v_recompensa.valor || ' months')::INTERVAL;
  ELSE
    RETURN false;
  END IF;

  -- Atualizar trial do usuario
  UPDATE usuarios
  SET trial_termina_em = v_nova_data,
      atualizado_em = now()
  WHERE id = v_recompensa.usuario_id;

  -- Atualizar assinatura se existir trial
  UPDATE assinaturas
  SET trial_termina = v_nova_data,
      fim_periodo = v_nova_data,
      atualizado_em = now()
  WHERE usuario_id = v_recompensa.usuario_id
    AND status = 'trial';

  -- Marcar recompensa como aplicada
  UPDATE recompensas_indicacao
  SET aplicada = true,
      aplicada_em = now()
  WHERE id = p_recompensa_id;

  -- Atualizar contador do indicador
  UPDATE codigos_indicacao
  SET total_recompensas = total_recompensas + 1
  WHERE usuario_id = v_recompensa.usuario_id;

  RETURN true;
END;
$$;

-- Obter stats de indicacoes do usuario
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
    -- Gerar codigo se nao existir
    v_codigo := gerar_codigo_indicacao(p_usuario_id);
    v_total_indicacoes := 0;
    v_total_recompensas := 0;
  END IF;

  SELECT COUNT(*) INTO v_total_convertidas
  FROM indicacoes
  WHERE indicador_id = p_usuario_id AND status IN ('convertida', 'recompensada');

  -- Ultimas 10 indicacoes
  SELECT jsonb_agg(jsonb_build_object(
    'id', i.id,
    'indicado_nome', COALESCE(u.nome, 'Novo usuario'),
    'indicado_email', u.email,
    'status', i.status,
    'criado_em', i.criado_em
  )) INTO v_indicacoes_recentes
  FROM indicacoes i
  LEFT JOIN usuarios u ON u.id = i.indicado_id
  WHERE i.indicador_id = p_usuario_id
  ORDER BY i.criado_em DESC
  LIMIT 10;

  RETURN jsonb_build_object(
    'codigo', v_codigo,
    'total_indicacoes', COALESCE(v_total_indicacoes, 0),
    'total_convertidas', COALESCE(v_total_convertidas, 0),
    'total_recompensas', COALESCE(v_total_recompensas, 0),
    'indicacoes', COALESCE(v_indicacoes_recentes, '[]'::jsonb)
  );
END;
$$;

-- Admin: obter todas as indicacoes com detalhes
CREATE OR REPLACE FUNCTION get_admin_indicacoes(
  p_status TEXT DEFAULT NULL,
  p_busca TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', i.id,
    'indicador_nome', COALESCE(u_ind.nome, 'N/A'),
    'indicador_email', u_ind.email,
    'indicado_nome', COALESCE(u_indicado.nome, 'N/A'),
    'indicado_email', u_indicado.email,
    'codigo_usado', i.codigo_usado,
    'status', i.status,
    'ip_indicado', i.ip_indicado,
    'criado_em', i.criado_em
  )) INTO v_resultado
  FROM indicacoes i
  LEFT JOIN usuarios u_ind ON u_ind.id = i.indicador_id
  LEFT JOIN usuarios u_indicado ON u_indicado.id = i.indicado_id
  WHERE (p_status IS NULL OR i.status = p_status)
    AND (p_busca IS NULL OR u_ind.email ILIKE '%' || p_busca || '%'
      OR u_indicado.email ILIKE '%' || p_busca || '%'
      OR u_ind.nome ILIKE '%' || p_busca || '%'
      OR u_indicado.nome ILIKE '%' || p_busca || '%')
  ORDER BY i.criado_em DESC;

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

-- Admin: stats gerais de indicacoes
CREATE OR REPLACE FUNCTION get_admin_indicacoes_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_convertidas INTEGER;
  v_pendentes INTEGER;
  v_recompensas_dadas INTEGER;
  v_total_dias_dados NUMERIC;
  v_por_dia JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total FROM indicacoes;
  SELECT COUNT(*) INTO v_convertidas FROM indicacoes WHERE status IN ('convertida', 'recompensada');
  SELECT COUNT(*) INTO v_pendentes FROM indicacoes WHERE status = 'pendente';
  SELECT COUNT(*) INTO v_recompensas_dadas FROM recompensas_indicacao WHERE aplicada = true;
  SELECT COALESCE(SUM(valor), 0) INTO v_total_dias_dados FROM recompensas_indicacao WHERE aplicada = true AND tipo = 'dias_trial';

  -- Indicacoes por dia (ultimos 30 dias)
  SELECT jsonb_agg(jsonb_build_object(
    'data', dia,
    'total', COALESCE(cnt, 0)
  )) INTO v_por_dia
  FROM (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '29 days',
      CURRENT_DATE,
      INTERVAL '1 day'
    )::DATE AS dia
  ) dias
  LEFT JOIN (
    SELECT DATE(criado_em) AS dia, COUNT(*) AS cnt
    FROM indicacoes
    WHERE criado_em >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(criado_em)
  ) contagem ON contagem.dia = dias.dia
  ORDER BY dias.dia;

  RETURN jsonb_build_object(
    'total_indicacoes', COALESCE(v_total, 0),
    'convertidas', COALESCE(v_convertidas, 0),
    'pendentes', COALESCE(v_pendentes, 0),
    'recompensas_dadas', COALESCE(v_recompensas_dadas, 0),
    'total_dias_dados', COALESCE(v_total_dias_dados, 0),
    'indicacoes_por_dia', COALESCE(v_por_dia, '[]'::jsonb)
  );
END;
$$;

-- ============================================================
-- 7. TRIGGER: atualizar atualizado_em
-- ============================================================
CREATE OR REPLACE FUNCTION update_indicacoes_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_codigos_indicacao_updated
  BEFORE UPDATE ON codigos_indicacao
  FOR EACH ROW EXECUTE FUNCTION update_indicacoes_timestamp();

CREATE TRIGGER trigger_indicacoes_updated
  BEFORE UPDATE ON indicacoes
  FOR EACH ROW EXECUTE FUNCTION update_indicacoes_timestamp();

CREATE TRIGGER trigger_campanhas_indicacao_updated
  BEFORE UPDATE ON campanhas_indicacao
  FOR EACH ROW EXECUTE FUNCTION update_indicacoes_timestamp();
