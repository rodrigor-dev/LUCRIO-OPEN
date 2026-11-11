-- ============================================================
-- 026: Pagamentos via Cakto (substitui Mercado Pago)
-- ============================================================
-- Por que o sistema não liberava depois do pagamento:
--   * o webhook chamava a função webhook_ativar_assinatura_por_usuario,
--     que nunca foi criada em nenhuma migration → sempre dava erro;
--   * o "plano B" só funcionava se o cliente voltasse para
--     /pagamento/sucesso no navegador (Pix pago depois, aba fechada → nada);
--   * a validação da assinatura do Mercado Pago usava o formato errado
--     (com o secret configurado, todo webhook era recusado com 401).
--
-- Agora: a liberação acontece SOMENTE no servidor, pelo webhook da Cakto,
-- de forma idempotente (o mesmo evento nunca é aplicado duas vezes) e com
-- registro de tudo em pagamentos_eventos para auditoria.
-- ============================================================

-- 0) Quem está chamando é admin ou o próprio servidor?
--    (também usada pela migration 027)
CREATE OR REPLACE FUNCTION public.chamador_eh_admin_ou_servidor()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN true;
  END IF;
  -- SQL Editor / migrations do Supabase
  IF session_user IN ('postgres', 'supabase_admin') THEN
    RETURN true;
  END IF;
  RETURN coalesce((SELECT is_admin FROM public.usuarios WHERE id = auth.uid()), false);
END;
$$;

-- 1) Registro de eventos recebidos (idempotência + auditoria)
CREATE TABLE IF NOT EXISTS pagamentos_eventos (
  id TEXT PRIMARY KEY,                 -- "<evento>:<id do pedido>"
  gateway TEXT NOT NULL DEFAULT 'cakto',
  evento TEXT NOT NULL,
  pedido_id TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plano TEXT,
  estendeu_periodo BOOLEAN NOT NULL DEFAULT false,
  resultado TEXT,
  payload JSONB,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_eventos_usuario ON pagamentos_eventos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_eventos_pedido ON pagamentos_eventos(pedido_id);

-- Ninguém do lado do navegador lê ou escreve aqui; só o servidor (service role).
ALTER TABLE pagamentos_eventos ENABLE ROW LEVEL SECURITY;

-- 2) Função que aplica um evento de pagamento na assinatura do usuário
CREATE OR REPLACE FUNCTION processar_evento_pagamento(
  p_evento_id TEXT,
  p_evento TEXT,
  p_pedido_id TEXT,
  p_usuario_id UUID,
  p_plano TEXT,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura RECORD;
  v_plano_id UUID;
  v_intervalo INTERVAL;
  v_base TIMESTAMPTZ;
  v_novo_fim TIMESTAMPTZ;
  v_ja_estendeu BOOLEAN;
  v_resultado TEXT;
BEGIN
  -- Idempotência: se este evento já foi registrado, não faz nada.
  INSERT INTO pagamentos_eventos (id, evento, pedido_id, usuario_id, plano, payload)
  VALUES (p_evento_id, p_evento, p_pedido_id, p_usuario_id, p_plano, p_payload)
  ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN 'duplicado';
  END IF;

  IF p_usuario_id IS NULL THEN
    UPDATE pagamentos_eventos SET resultado = 'usuario_nao_encontrado' WHERE id = p_evento_id;
    RETURN 'usuario_nao_encontrado';
  END IF;

  v_intervalo := CASE WHEN p_plano = 'anual' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;

  SELECT * INTO v_assinatura
  FROM assinaturas
  WHERE usuario_id = p_usuario_id
  ORDER BY criado_em DESC
  LIMIT 1
  FOR UPDATE;

  IF p_evento IN (
    'purchase_approved', 'subscription_created', 'subscription_renewed',
    'subscription_late_recovered', 'subscription_resumed'
  ) THEN
    -- Um mesmo pedido pode chegar em mais de um evento (ex.: compra aprovada
    -- + assinatura criada). O período só é estendido uma vez por pedido.
    SELECT EXISTS (
      SELECT 1 FROM pagamentos_eventos
      WHERE pedido_id = p_pedido_id AND estendeu_periodo = true AND id <> p_evento_id
    ) INTO v_ja_estendeu;

    IF v_assinatura.id IS NULL THEN
      SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;
      v_novo_fim := now() + v_intervalo;

      INSERT INTO assinaturas (
        usuario_id, plano_id, status, inicio_periodo, fim_periodo,
        intent_pagamento_id, metodo_pagamento_id, ultimo_pagamento, proximo_pagamento,
        cancelar_ao_fim_periodo
      ) VALUES (
        p_usuario_id, v_plano_id, 'ativo', now(), v_novo_fim,
        p_pedido_id, 'cakto', now(), v_novo_fim, false
      );

      UPDATE pagamentos_eventos SET estendeu_periodo = true WHERE id = p_evento_id;
      v_resultado := 'ativado';

    ELSIF v_ja_estendeu OR p_evento = 'subscription_resumed' THEN
      UPDATE assinaturas
      SET status = 'ativo', cancelar_ao_fim_periodo = false, cancelado_em = NULL
      WHERE id = v_assinatura.id;
      v_resultado := 'ativo_sem_estender';

    ELSE
      -- Trial ou período vencido: conta a partir de agora.
      -- Ainda dentro de um período pago: soma ao fim do período atual.
      v_base := CASE
        WHEN v_assinatura.status = 'trial' THEN now()
        WHEN v_assinatura.fim_periodo IS NULL OR v_assinatura.fim_periodo < now() THEN now()
        ELSE v_assinatura.fim_periodo
      END;
      v_novo_fim := v_base + v_intervalo;

      UPDATE assinaturas
      SET status = 'ativo',
          inicio_periodo = CASE WHEN v_base = now() THEN now() ELSE inicio_periodo END,
          fim_periodo = v_novo_fim,
          trial_termina = CASE WHEN v_assinatura.status = 'trial' THEN now() ELSE trial_termina END,
          intent_pagamento_id = p_pedido_id,
          metodo_pagamento_id = 'cakto',
          ultimo_pagamento = now(),
          proximo_pagamento = v_novo_fim,
          cancelar_ao_fim_periodo = false,
          cancelado_em = NULL
      WHERE id = v_assinatura.id;

      UPDATE pagamentos_eventos SET estendeu_periodo = true WHERE id = p_evento_id;
      v_resultado := 'ativado';
    END IF;

  ELSIF p_evento = 'subscription_canceled' THEN
    -- Cancelou a renovação: mantém o acesso até o fim do período já pago.
    UPDATE assinaturas
    SET status = 'cancelado', cancelar_ao_fim_periodo = true, cancelado_em = now()
    WHERE id = v_assinatura.id AND status <> 'trial';
    v_resultado := 'cancelado_fim_periodo';

  ELSIF p_evento IN ('refund', 'chargeback') THEN
    -- Reembolso/estorno: corta o acesso na hora.
    UPDATE assinaturas
    SET status = 'cancelado', fim_periodo = now(), cancelado_em = now()
    WHERE id = v_assinatura.id;
    v_resultado := 'acesso_removido';

  ELSIF p_evento IN ('subscription_late', 'subscription_renewal_refused', 'subscription_paused') THEN
    -- Cobrança falhou: marca atrasado; o acesso segue até o fim do período pago.
    UPDATE assinaturas SET status = 'atrasado'
    WHERE id = v_assinatura.id AND status IN ('ativo', 'atrasado');
    v_resultado := 'atrasado';

  ELSE
    v_resultado := 'ignorado';
  END IF;

  UPDATE pagamentos_eventos SET resultado = v_resultado WHERE id = p_evento_id;
  RETURN v_resultado;
END;
$$;

-- Só o servidor (service role) pode chamar.
REVOKE ALL ON FUNCTION processar_evento_pagamento(TEXT, TEXT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION processar_evento_pagamento(TEXT, TEXT, TEXT, UUID, TEXT, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION processar_evento_pagamento(TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO service_role;

-- 3) Fechar a brecha de "liberar sozinho": antes, qualquer usuário logado
--    podia gravar status 'ativo' na própria assinatura (a página
--    /pagamento/sucesso fazia isso pelo navegador). Agora só o servidor,
--    funções internas (SECURITY DEFINER) e administradores podem ativar.
CREATE OR REPLACE FUNCTION proteger_status_assinatura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER  -- precisa enxergar QUEM está gravando (current_user)
SET search_path = public
AS $$
BEGIN
  -- Gravações feitas por funções internas do banco (SECURITY DEFINER,
  -- como o webhook, o trial automático e as recompensas de indicação)
  -- ou pelo servidor (service role) passam normalmente.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Administradores logados no painel também podem tudo.
  IF public.chamador_eh_admin_ou_servidor() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Usuário comum só pode criar o próprio trial inicial (7 dias),
    -- e apenas se ainda não tiver nenhuma assinatura.
    IF NEW.status <> 'trial'
       OR NEW.fim_periodo > now() + INTERVAL '8 days'
       OR EXISTS (SELECT 1 FROM assinaturas WHERE usuario_id = NEW.usuario_id) THEN
      RAISE EXCEPTION 'Somente o servidor pode ativar uma assinatura' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: o próprio usuário só pode cancelar (rebaixar para
  -- 'cancelado'), mantendo o fim do período já pago.
  IF NEW.status = 'cancelado'
     AND OLD.status IN ('ativo', 'atrasado', 'cancelado')
     AND NEW.fim_periodo IS NOT DISTINCT FROM OLD.fim_periodo
     AND NEW.intent_pagamento_id IS NOT DISTINCT FROM OLD.intent_pagamento_id
     AND NEW.ultimo_pagamento IS NOT DISTINCT FROM OLD.ultimo_pagamento THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.fim_periodo IS DISTINCT FROM OLD.fim_periodo
     OR NEW.trial_termina IS DISTINCT FROM OLD.trial_termina
     OR NEW.plano_id IS DISTINCT FROM OLD.plano_id
     OR NEW.intent_pagamento_id IS DISTINCT FROM OLD.intent_pagamento_id
     OR NEW.ultimo_pagamento IS DISTINCT FROM OLD.ultimo_pagamento
     OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id THEN
    RAISE EXCEPTION 'Somente o servidor pode alterar o pagamento da assinatura' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_proteger_status_assinatura ON assinaturas;
CREATE TRIGGER trigger_proteger_status_assinatura
  BEFORE INSERT OR UPDATE ON assinaturas
  FOR EACH ROW EXECUTE FUNCTION proteger_status_assinatura();
