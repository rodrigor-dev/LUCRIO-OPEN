-- ============================================================
-- 027: Proteger funções administrativas (FALHA DE SEGURANÇA)
-- ============================================================
-- As funções SECURITY DEFINER das migrations 006, 007, 009 e 010 não
-- verificavam quem estava chamando. Qualquer usuário logado conseguia,
-- pelo navegador, por exemplo:
--   * toggle_admin(<seu id>, true)          → virar administrador
--   * conceder_acesso / acesso_vitalicio    → liberar o sistema de graça
--   * get_all_usuarios / get_all_assinaturas → ver dados de todos
--
-- Esta migration injeta uma checagem no início de cada função:
--   * funções de admin: só administradores (ou o servidor/SQL Editor);
--   * funções "por usuário": só o próprio usuário (ou admin).
-- Não muda o comportamento para quem tem permissão. Segura para rodar
-- mais de uma vez.
-- ============================================================

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

DO $$
DECLARE
  v_func RECORD;
  v_def TEXT;
  v_novo TEXT;
  v_guard TEXT;
  v_param TEXT;
  -- Funções exclusivas de administrador
  v_admin TEXT[] := ARRAY[
    'get_admin_stats', 'get_admin_financeiro', 'get_all_usuarios',
    'get_all_assinaturas', 'get_all_planos', 'get_all_cupons',
    'get_all_auditoria', 'get_all_logs', 'get_all_tickets',
    'get_ticket_mensagens', 'get_all_avisos', 'get_all_feature_flags',
    'get_all_configuracoes', 'get_all_backups', 'get_all_atualizacoes',
    'get_all_roles', 'get_usuario_crescimento_mensal', 'get_receita_mensal',
    'get_plano_distribuicao', 'save_configuracao', 'get_usuarios_assinaturas',
    'conceder_acesso', 'acesso_vitalicio', 'estender_trial',
    'estender_periodo', 'reativar_assinatura', 'toggle_admin',
    'get_admin_indicacoes', 'get_admin_indicacoes_stats',
    'webhook_atualizar_assinatura'
  ];
  -- Funções que recebem o id do usuário: só o próprio usuário ou admin
  v_por_usuario TEXT[] := ARRAY[
    'get_user_profile', 'get_subscription_status', 'get_indicacoes_stats'
  ];
BEGIN
  FOR v_func IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND l.lanname = 'plpgsql'
      AND (p.proname = ANY (v_admin) OR p.proname = ANY (v_por_usuario))
  LOOP
    v_def := pg_get_functiondef(v_func.oid);

    -- Já protegida por esta migration
    IF position('[guard-027]' IN v_def) > 0 THEN
      CONTINUE;
    END IF;

    IF v_func.proname = ANY (v_admin) THEN
      v_guard := 'BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION ''Acesso restrito a administradores'' USING ERRCODE = ''42501'';
  END IF;
';
    ELSE
      -- primeiro parâmetro da função (o id do usuário)
      SELECT (p.proargnames)[1] INTO v_param FROM pg_proc p WHERE p.oid = v_func.oid;
      v_guard := 'BEGIN
  -- [guard-027]
  IF ' || quote_ident(v_param) || ' IS DISTINCT FROM auth.uid()
     AND NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION ''Acesso negado'' USING ERRCODE = ''42501'';
  END IF;
';
    END IF;

    -- Insere a checagem logo após o primeiro BEGIN do corpo
    v_novo := regexp_replace(v_def, '\mBEGIN\M', v_guard, 'i');

    IF v_novo = v_def THEN
      RAISE WARNING 'Não foi possível proteger a função %', v_func.proname;
      CONTINUE;
    END IF;

    EXECUTE v_novo;
    RAISE NOTICE 'Função protegida: %', v_func.proname;
  END LOOP;
END $$;

-- estender_trial estava quebrada ("record v_existente is not assigned
-- yet") e, quando funcionava, só mexia em trial_termina — mas o acesso é
-- liberado por fim_periodo, então o admin estendia e nada mudava.
CREATE OR REPLACE FUNCTION estender_trial(p_usuario_id UUID, p_dias INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_fim TIMESTAMPTZ;
  v_plano_id UUID;
  v_novo_fim TIMESTAMPTZ;
BEGIN
  -- [guard-027]
  IF NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;

  SELECT id, fim_periodo INTO v_id, v_fim
  FROM assinaturas
  WHERE usuario_id = p_usuario_id AND status = 'trial'
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    v_novo_fim := GREATEST(COALESCE(v_fim, now()), now()) + make_interval(days => p_dias);
    UPDATE assinaturas
    SET fim_periodo = v_novo_fim, trial_termina = v_novo_fim
    WHERE id = v_id;
  ELSE
    SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' ORDER BY is_ativo DESC LIMIT 1;
    IF v_plano_id IS NULL THEN
      RAISE EXCEPTION 'Plano PRO nao encontrado';
    END IF;
    v_novo_fim := now() + make_interval(days => p_dias);
    INSERT INTO assinaturas (usuario_id, plano_id, status, trial_termina, inicio_periodo, fim_periodo)
    VALUES (p_usuario_id, v_plano_id, 'trial', v_novo_fim, now(), v_novo_fim);
  END IF;

  UPDATE usuarios SET trial_termina_em = v_novo_fim WHERE id = p_usuario_id;
END;
$$;

-- Cancelamento pelo próprio usuário: só a assinatura dele, e o acesso
-- continua até o fim do período pago.
CREATE OR REPLACE FUNCTION cancelar_assinatura(p_assinatura_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE assinaturas
  SET status = 'cancelado',
      cancelar_ao_fim_periodo = true,
      cancelado_em = now()
  WHERE id = p_assinatura_id
    AND status IN ('ativo', 'atrasado', 'cancelado')
    AND (usuario_id = auth.uid() OR public.chamador_eh_admin_ou_servidor());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- O webhook antigo do Mercado Pago não é mais usado.
REVOKE ALL ON FUNCTION webhook_atualizar_assinatura(TEXT, TEXT, BOOLEAN) FROM anon, authenticated;

-- ------------------------------------------------------------
-- Tabela usuarios
-- ------------------------------------------------------------
-- (a) A policy "usuarios_update_own" deixava o usuário alterar a própria
--     linha inteira — inclusive is_admin. Este trigger impede que alguém
--     que não é admin mude is_admin.
CREATE OR REPLACE FUNCTION proteger_campos_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER  -- precisa enxergar QUEM está gravando (current_user)
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     AND current_user IN ('authenticated', 'anon')
     AND NOT public.chamador_eh_admin_ou_servidor() THEN
    RAISE EXCEPTION 'Somente administradores podem alterar permissões' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_proteger_campos_usuario ON usuarios;
CREATE TRIGGER trigger_proteger_campos_usuario
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION proteger_campos_usuario();

CREATE OR REPLACE FUNCTION proteger_insert_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.is_admin, false)
     AND current_user IN ('authenticated', 'anon')
     AND NOT public.chamador_eh_admin_ou_servidor() THEN
    NEW.is_admin := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_proteger_insert_usuario ON usuarios;
CREATE TRIGGER trigger_proteger_insert_usuario
  BEFORE INSERT ON usuarios
  FOR EACH ROW EXECUTE FUNCTION proteger_insert_usuario();

-- (b) As policies de admin consultavam a própria tabela usuarios dentro
--     da policy (recursão infinita no Postgres). Passam a usar a função
--     acima, que não sofre RLS.
DROP POLICY IF EXISTS "usuarios_select_admin" ON usuarios;
CREATE POLICY "usuarios_select_admin" ON usuarios
  FOR SELECT USING (public.chamador_eh_admin_ou_servidor());

DROP POLICY IF EXISTS "usuarios_update_admin" ON usuarios;
CREATE POLICY "usuarios_update_admin" ON usuarios
  FOR UPDATE USING (public.chamador_eh_admin_ou_servidor());

DROP POLICY IF EXISTS "Admin ve qualquer assinatura" ON assinaturas;
CREATE POLICY "Admin ve qualquer assinatura" ON assinaturas
  FOR SELECT USING (public.chamador_eh_admin_ou_servidor());
