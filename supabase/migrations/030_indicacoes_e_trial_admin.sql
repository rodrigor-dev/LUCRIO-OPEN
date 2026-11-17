-- 030: Indicações (bônus de verdade) e "período de teste" do admin
--
-- Problemas corrigidos:
-- 1. O bônus de indicação só era somado a quem estava em teste grátis.
--    Para quem já paga, ficava "registrado" mas não aumentava o acesso.
-- 2. Regra combinada: quem indica ganha 15 dias A CADA 3 amigos
--    (antes: 15 dias por amigo, enquanto a página prometia a cada 3).
--    Quem é indicado continua ganhando 7 dias na hora do cadastro.
-- 3. Código de amigo só pode ser usado nos primeiros 7 dias de conta
--    (evita contas antigas trocando códigos entre si).
-- 4. Só o próprio usuário (ou o servidor/admin) registra a própria indicação;
--    e-mails temporários bloqueados pela campanha são recusados.
-- 5. "Período de teste" dado pelo admin para quem já paga criava uma
--    assinatura de teste nova por cima da paga (podendo encurtar o acesso).
--    Agora soma os dias ao plano atual.
--
-- Não altera nem apaga dados existentes.

-- ------------------------------------------------------------------
-- Aplica uma recompensa: soma dias/meses ao acesso atual do usuário
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.processar_recompensa_indicacao(p_recompensa_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_intervalo INTERVAL;
  v_assinatura RECORD;
  v_plano_id UUID;
  v_novo_fim TIMESTAMPTZ;
  v_eh_indicador BOOLEAN;
BEGIN
  SELECT * INTO v_rec FROM recompensas_indicacao
  WHERE id = p_recompensa_id AND aplicada = false
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_rec.tipo = 'dias_trial' THEN
    v_intervalo := make_interval(days => v_rec.valor::INT);
  ELSIF v_rec.tipo = 'meses_gratis' THEN
    v_intervalo := make_interval(months => v_rec.valor::INT);
  ELSE
    RETURN false; -- 'desconto' não altera período
  END IF;

  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = v_rec.usuario_id) THEN
    RETURN false;
  END IF;

  -- Assinatura atual (a mesma que o sistema usa para liberar o acesso)
  SELECT * INTO v_assinatura FROM assinaturas
  WHERE usuario_id = v_rec.usuario_id AND status IN ('trial', 'ativo', 'cancelado', 'atrasado')
  ORDER BY criado_em DESC LIMIT 1
  FOR UPDATE;

  IF v_assinatura.id IS NOT NULL THEN
    -- Soma em cima do que a pessoa já tem (nunca encurta)
    v_novo_fim := GREATEST(COALESCE(v_assinatura.fim_periodo, now()), now()) + v_intervalo;
    UPDATE assinaturas SET
      fim_periodo = v_novo_fim,
      trial_termina = CASE WHEN status = 'trial' THEN v_novo_fim ELSE trial_termina END,
      atualizado_em = now()
    WHERE id = v_assinatura.id;

    IF v_assinatura.status = 'trial' THEN
      UPDATE usuarios SET trial_termina_em = v_novo_fim, atualizado_em = now() WHERE id = v_rec.usuario_id;
    END IF;
  ELSE
    SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;
    IF v_plano_id IS NULL THEN
      RETURN false;
    END IF;
    v_novo_fim := now() + v_intervalo;
    INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
    VALUES (v_rec.usuario_id, v_plano_id, 'trial', v_novo_fim, now(), v_novo_fim);
    UPDATE usuarios SET trial_termina_em = v_novo_fim, atualizado_em = now() WHERE id = v_rec.usuario_id;
  END IF;

  UPDATE recompensas_indicacao SET aplicada = true, aplicada_em = now() WHERE id = p_recompensa_id;

  -- Contador "recompensas ganhas" só para quem indicou
  SELECT EXISTS (
    SELECT 1 FROM indicacoes WHERE id = v_rec.indicacao_id AND indicador_id = v_rec.usuario_id
  ) INTO v_eh_indicador;
  IF v_eh_indicador THEN
    UPDATE codigos_indicacao SET total_recompensas = total_recompensas + 1, atualizado_em = now()
    WHERE usuario_id = v_rec.usuario_id AND is_ativo = true;
  END IF;

  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.processar_recompensa_indicacao(UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------
-- Registra a indicação e aplica os bônus
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_indicacao(
  p_indicador_codigo TEXT,
  p_indicado_id UUID,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_amigos_por_bonus CONSTANT INT := 3;
  c_dias_para_usar_codigo CONSTANT INTERVAL := INTERVAL '7 days';
  v_codigo TEXT := upper(trim(COALESCE(p_indicador_codigo, '')));
  v_codigo_record RECORD;
  v_indicado RECORD;
  v_campanha RECORD;
  v_indicacao_id UUID;
  v_total INT;
  v_rec_id UUID;
  v_ganhou_bonus BOOLEAN := false;
  v_dominio TEXT;
BEGIN
  -- Só o próprio usuário (ou o servidor/admin) pode registrar a indicação dele
  IF p_indicado_id IS DISTINCT FROM auth.uid() AND NOT public.chamador_eh_admin_ou_servidor() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Não autorizado');
  END IF;

  SELECT id, usuario_id, total_indicacoes INTO v_codigo_record
  FROM codigos_indicacao WHERE codigo = v_codigo AND is_ativo = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Código de indicação inválido');
  END IF;

  IF v_codigo_record.usuario_id = p_indicado_id THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Você não pode usar o seu próprio código');
  END IF;

  IF EXISTS (SELECT 1 FROM indicacoes WHERE indicado_id = p_indicado_id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Você já usou um código de indicação');
  END IF;

  SELECT id, email, criado_em INTO v_indicado FROM usuarios WHERE id = p_indicado_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não encontrado');
  END IF;

  -- Só nos primeiros 7 dias da conta
  IF v_indicado.criado_em < now() - c_dias_para_usar_codigo THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'O código de indicação só pode ser usado nos primeiros 7 dias de conta');
  END IF;

  SELECT * INTO v_campanha FROM campanhas_indicacao
  WHERE is_ativo = true
    AND (data_inicio IS NULL OR data_inicio <= now())
    AND (data_fim IS NULL OR data_fim >= now())
  ORDER BY criado_em DESC LIMIT 1;

  IF v_campanha.id IS NOT NULL THEN
    -- E-mails temporários bloqueados pela campanha
    v_dominio := lower(split_part(COALESCE(v_indicado.email, ''), '@', 2));
    IF COALESCE(v_campanha.bloquear_temp_emails, false)
       AND v_dominio <> ''
       AND v_dominio = ANY (SELECT lower(d) FROM unnest(COALESCE(v_campanha.dominios_bloqueados, ARRAY[]::TEXT[])) d) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'E-mail não permitido para indicação');
    END IF;

    IF COALESCE(v_campanha.max_indicacoes_por_usuario, 0) > 0
       AND v_codigo_record.total_indicacoes >= v_campanha.max_indicacoes_por_usuario THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Este código atingiu o limite de indicações');
    END IF;
  END IF;

  INSERT INTO indicacoes (indicador_id, indicado_id, codigo_usado, ip_indicado, user_agent_indicado)
  VALUES (v_codigo_record.usuario_id, p_indicado_id, v_codigo, p_ip, p_user_agent)
  RETURNING id INTO v_indicacao_id;

  UPDATE codigos_indicacao SET total_indicacoes = total_indicacoes + 1, atualizado_em = now()
  WHERE id = v_codigo_record.id
  RETURNING total_indicacoes INTO v_total;

  IF v_campanha.id IS NOT NULL THEN
    -- Quem foi indicado: bônus na hora
    INSERT INTO recompensas_indicacao (usuario_id, indicacao_id, tipo, valor, descricao)
    VALUES (p_indicado_id, v_indicacao_id, v_campanha.recompensa_indicado_tipo, v_campanha.recompensa_indicado_valor,
            format('Bem-vindo! +%s dias grátis por usar um código de indicação', v_campanha.recompensa_indicado_valor))
    RETURNING id INTO v_rec_id;
    PERFORM processar_recompensa_indicacao(v_rec_id);

    -- Quem indicou: bônus a cada 3 amigos
    IF v_total % c_amigos_por_bonus = 0 THEN
      INSERT INTO recompensas_indicacao (usuario_id, indicacao_id, tipo, valor, descricao)
      VALUES (v_codigo_record.usuario_id, v_indicacao_id, v_campanha.recompensa_indicador_tipo, v_campanha.recompensa_indicador_valor,
              format('+%s dias grátis: você indicou %s amigos', v_campanha.recompensa_indicador_valor, v_total))
      RETURNING id INTO v_rec_id;
      PERFORM processar_recompensa_indicacao(v_rec_id);
      v_ganhou_bonus := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'indicacao_id', v_indicacao_id,
    'recompensas', jsonb_build_object(
      'indicado_dias', COALESCE(v_campanha.recompensa_indicado_valor, 0),
      'indicador_ganhou', v_ganhou_bonus
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.registrar_indicacao(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_indicacao(TEXT, UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------
-- Admin: "dar período de teste"
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estender_trial(p_usuario_id UUID, p_dias INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura RECORD;
  v_plano_id UUID;
  v_novo_fim TIMESTAMPTZ;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  IF p_dias IS NULL OR p_dias < 1 THEN
    RAISE EXCEPTION 'Informe ao menos 1 dia';
  END IF;

  SELECT * INTO v_assinatura FROM assinaturas
  WHERE usuario_id = p_usuario_id AND status IN ('trial', 'ativo', 'cancelado', 'atrasado')
  ORDER BY criado_em DESC LIMIT 1
  FOR UPDATE;

  IF v_assinatura.id IS NOT NULL AND v_assinatura.status = 'trial' THEN
    -- Já está em teste: soma os dias
    v_novo_fim := GREATEST(COALESCE(v_assinatura.fim_periodo, now()), now()) + make_interval(days => p_dias);
    UPDATE assinaturas SET fim_periodo = v_novo_fim, trial_termina = v_novo_fim WHERE id = v_assinatura.id;
    UPDATE usuarios SET trial_termina_em = v_novo_fim WHERE id = p_usuario_id;

  ELSIF v_assinatura.id IS NOT NULL AND public.usuario_tem_acesso(p_usuario_id) THEN
    -- Já tem plano com acesso: soma os dias ao plano, sem trocar por teste
    v_novo_fim := GREATEST(COALESCE(v_assinatura.fim_periodo, now()), now()) + make_interval(days => p_dias);
    UPDATE assinaturas SET fim_periodo = v_novo_fim WHERE id = v_assinatura.id;

  ELSE
    -- Sem assinatura ou vencido: novo período de teste a partir de agora
    SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;
    IF v_plano_id IS NULL THEN
      RAISE EXCEPTION 'Plano PRO nao encontrado';
    END IF;
    v_novo_fim := now() + make_interval(days => p_dias);
    INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
    VALUES (p_usuario_id, v_plano_id, 'trial', v_novo_fim, now(), v_novo_fim);
    UPDATE usuarios SET trial_termina_em = v_novo_fim WHERE id = p_usuario_id;
  END IF;
END;
$$;
