-- ============================================================
-- 028: Correções da auditoria de 11/11/2026
-- ============================================================
-- Problemas encontrados nos dados reais:
--   1. Cobranças de clientes fixos só eram geradas quando o DONO da conta
--      abria o sistema. 113 recorrências estavam com novembro pendente
--      porque o usuário não entrou no mês.
--   2. Ao excluir um cliente, a mensalidade dele continuava ativa e o
--      sistema seguia gerando cobranças "fantasma" (sem cliente).
--   3. Excluir um cliente que já tinha receitas dava erro (chave
--      estrangeira sem ON DELETE).
--   4. FALHA DE SEGURANÇA: as views calendario_financeiro, resumo_cliente
--      e kpis_dashboard ignoravam o RLS e podiam ser lidas por qualquer um
--      (até sem login) — expondo receitas, despesas e clientes de todos.
--
-- Esta migration:
--   A. Fecha a falha das views e de duas funções expostas.
--   B. Exclusão de cliente: pausa a mensalidade e mantém o histórico.
--   C. Gera as mensalidades no SERVIDOR, todo dia (pg_cron), para todos
--      os usuários com acesso liberado, sem depender de alguém abrir o
--      sistema. Regra definida pelo dono do sistema:
--        * nunca gera cobrança de meses que já passaram;
--        * conta bloqueada (sem pagar) não gera nada; ao voltar a pagar,
--          gera a partir do mês atual. Meses anteriores o usuário ajusta
--          manualmente, se quiser.
-- Segura para rodar mais de uma vez.
-- ============================================================


-- ------------------------------------------------------------
-- A. Segurança
-- ------------------------------------------------------------
-- As views passam a respeitar o RLS de quem consulta (cada usuário só vê
-- o próprio negócio). O sistema não usa essas views hoje.
ALTER VIEW IF EXISTS public.calendario_financeiro SET (security_invoker = on);
ALTER VIEW IF EXISTS public.resumo_cliente        SET (security_invoker = on);
ALTER VIEW IF EXISTS public.kpis_dashboard        SET (security_invoker = on);

REVOKE ALL ON public.calendario_financeiro FROM anon;
REVOKE ALL ON public.resumo_cliente        FROM anon;
REVOKE ALL ON public.kpis_dashboard        FROM anon;

-- Funções internas que não devem ser chamadas pelo navegador
DO $$
BEGIN
  IF to_regprocedure('public.processar_recompensa_indicacao(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.processar_recompensa_indicacao(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.atualizar_status_vencidos()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.atualizar_status_vencidos() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;


-- ------------------------------------------------------------
-- B. Excluir cliente
-- ------------------------------------------------------------
-- B1. Mantém o histórico (receitas, serviços, propostas) e só desvincula
--     o cliente, em vez de bloquear a exclusão com erro.
ALTER TABLE public.receitas  DROP CONSTRAINT IF EXISTS receitas_cliente_id_fkey;
ALTER TABLE public.receitas  ADD  CONSTRAINT receitas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.servicos  DROP CONSTRAINT IF EXISTS servicos_cliente_id_fkey;
ALTER TABLE public.servicos  ADD  CONSTRAINT servicos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.propostas DROP CONSTRAINT IF EXISTS propostas_cliente_id_fkey;
ALTER TABLE public.propostas ADD  CONSTRAINT propostas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

-- B2. Cliente excluído → mensalidade pausada (antes continuava gerando).
CREATE OR REPLACE FUNCTION public.desativar_recorrencias_do_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE recorrencias SET is_ativa = false
  WHERE cliente_id = OLD.id AND is_ativa = true;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_desativar_recorrencias_do_cliente ON public.clientes;
CREATE TRIGGER trigger_desativar_recorrencias_do_cliente
  BEFORE DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.desativar_recorrencias_do_cliente();


-- ------------------------------------------------------------
-- C. Geração das mensalidades no servidor
-- ------------------------------------------------------------
-- Mesmas regras do app (src/lib/recorrencia-datas.ts):
--   * dia limitado ao fim do mês (31 → 30/29/28);
--   * o próximo ciclo mantém o dia de vencimento ("âncora");
--   * gera só o mês atual (horário de Brasília), nunca meses passados.

CREATE OR REPLACE FUNCTION public.data_no_mes(p_ano INT, p_mes INT, p_dia INT)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT make_date(
    p_ano, p_mes,
    LEAST(GREATEST(p_dia, 1),
          EXTRACT(DAY FROM (make_date(p_ano, p_mes, 1) + INTERVAL '1 month - 1 day'))::INT)
  );
$$;

CREATE OR REPLACE FUNCTION public.proxima_data_recorrencia(p_data DATE, p_tipo TEXT, p_ancora INT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_dia INT := COALESCE(NULLIF(p_ancora, 0), EXTRACT(DAY FROM p_data)::INT);
  v_base DATE;
BEGIN
  IF p_tipo = 'semanal' THEN
    RETURN p_data + 7;
  ELSIF p_tipo = 'quinzenal' THEN
    RETURN p_data + 15;
  ELSIF p_tipo = 'anual' THEN
    v_base := (date_trunc('month', p_data) + INTERVAL '1 year')::DATE;
  ELSE
    v_base := (date_trunc('month', p_data) + INTERVAL '1 month')::DATE;
  END IF;
  RETURN public.data_no_mes(EXTRACT(YEAR FROM v_base)::INT, EXTRACT(MONTH FROM v_base)::INT, v_dia);
END;
$$;

-- O usuário está com acesso liberado? (mesma regra da tela do sistema,
-- src/lib/assinatura-acesso.ts). Admin sempre tem acesso. Assinatura
-- Cakto ativa tem 3 dias de tolerância para a renovação ser confirmada.
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM usuarios WHERE id = p_usuario_id), false)
      OR COALESCE((
           SELECT a.fim_periodo IS NOT NULL
              AND a.fim_periodo
                  + CASE WHEN a.metodo_pagamento_id = 'cakto'
                          AND a.status IN ('ativo', 'atrasado')
                          AND NOT COALESCE(a.cancelar_ao_fim_periodo, false)
                         THEN INTERVAL '3 days' ELSE INTERVAL '0' END
                  > now()
           FROM assinaturas a
           WHERE a.usuario_id = p_usuario_id
             AND a.status IN ('trial', 'ativo', 'cancelado', 'atrasado')
           ORDER BY a.criado_em DESC
           LIMIT 1
         ), false);
$$;

REVOKE EXECUTE ON FUNCTION public.usuario_tem_acesso(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gerar_receitas_recorrentes_job()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_inicio_mes DATE := date_trunc('month', v_hoje)::DATE;
  v_limite DATE := (date_trunc('month', v_hoje) + INTERVAL '1 month - 1 day')::DATE;
  v_cli RECORD;
  v_rec RECORD;
  v_data DATE;
  v_ciclos INT;
  v_n INT;
  v_pausadas INT := 0;
  v_criadas INT := 0;
  v_geradas INT := 0;
  v_erros INT := 0;
  v_puladas INT := 0;
  v_rec_id UUID;
BEGIN
  -- 1) Pausa mensalidades que não deveriam gerar: cliente excluído,
  --    inativo, esporádico ou sem valor.
  UPDATE recorrencias r SET is_ativa = false
  WHERE r.tipo = 'receita' AND r.is_ativa = true
    AND NOT EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = r.cliente_id AND c.tipo = 'fixo' AND c.is_ativo = true
        AND COALESCE(c.valor_mensal, 0) > 0
    );
  GET DIAGNOSTICS v_pausadas = ROW_COUNT;

  -- 2) Cliente fixo ativo com valor e sem mensalidade ativa: cria
  --    (ou reativa) a partir do mês atual.
  FOR v_cli IN
    SELECT c.* FROM clientes c
    WHERE c.tipo = 'fixo' AND c.is_ativo = true AND COALESCE(c.valor_mensal, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM recorrencias r
        WHERE r.cliente_id = c.id AND r.tipo = 'receita' AND r.is_ativa = true
      )
  LOOP
    BEGIN
      SELECT id INTO v_rec_id FROM recorrencias
      WHERE cliente_id = v_cli.id AND tipo = 'receita'
      ORDER BY criado_em DESC LIMIT 1;

      IF v_rec_id IS NOT NULL THEN
        UPDATE recorrencias
        SET is_ativa = true,
            valor = v_cli.valor_mensal,
            descricao = 'Mensalidade - ' || v_cli.nome,
            dia_vencimento = v_cli.dia_vencimento,
            proximo_gerar_em = public.data_no_mes(
              EXTRACT(YEAR FROM v_hoje)::INT, EXTRACT(MONTH FROM v_hoje)::INT,
              COALESCE(v_cli.dia_vencimento, EXTRACT(DAY FROM v_hoje)::INT))
        WHERE id = v_rec_id;
      ELSE
        INSERT INTO recorrencias (
          negocio_id, cliente_id, tipo, recorrencia, valor, descricao,
          dia_vencimento, is_ativa, proximo_gerar_em
        ) VALUES (
          v_cli.negocio_id, v_cli.id, 'receita', 'mensal', v_cli.valor_mensal,
          'Mensalidade - ' || v_cli.nome, v_cli.dia_vencimento, true,
          public.data_no_mes(
            EXTRACT(YEAR FROM v_hoje)::INT, EXTRACT(MONTH FROM v_hoje)::INT,
            COALESCE(v_cli.dia_vencimento, EXTRACT(DAY FROM v_hoje)::INT))
        );
      END IF;
      v_criadas := v_criadas + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- o app criou ao mesmo tempo: tudo certo
    END;
  END LOOP;

  -- 3) Gera as cobranças do mês atual, só para quem está com acesso.
  FOR v_rec IN
    SELECT r.* FROM recorrencias r
    JOIN negocios n ON n.id = r.negocio_id
    WHERE r.tipo = 'receita' AND r.is_ativa = true AND r.cliente_id IS NOT NULL
      AND r.proximo_gerar_em IS NOT NULL AND r.proximo_gerar_em <= v_limite
      AND public.usuario_tem_acesso(n.usuario_id)
  LOOP
    BEGIN
      v_data := v_rec.proximo_gerar_em;
      v_ciclos := 0;

      -- Meses que já passaram: pula sem gerar (regra do sistema).
      WHILE v_data < v_inicio_mes AND v_ciclos < 1000 LOOP
        v_data := public.proxima_data_recorrencia(v_data, v_rec.recorrencia, v_rec.dia_vencimento);
        v_ciclos := v_ciclos + 1;
        v_puladas := v_puladas + 1;
      END LOOP;
      v_ciclos := 0;

      WHILE v_data <= v_limite AND v_ciclos < 60 LOOP
        INSERT INTO receitas (
          negocio_id, cliente_id, descricao, valor, data, data_vencimento,
          status, forma_pagamento, recorrencia_tipo, recorrencia_id
        ) VALUES (
          v_rec.negocio_id, v_rec.cliente_id, v_rec.descricao, v_rec.valor,
          v_data, v_data, 'pendente', v_rec.forma_pagamento,
          COALESCE(v_rec.recorrencia, 'mensal'), v_rec.id
        )
        ON CONFLICT (recorrencia_id, data) WHERE recorrencia_id IS NOT NULL DO NOTHING;

        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_geradas := v_geradas + v_n;

        v_data := public.proxima_data_recorrencia(v_data, v_rec.recorrencia, v_rec.dia_vencimento);
        v_ciclos := v_ciclos + 1;
      END LOOP;

      -- Só avança se ninguém (o app) avançou ao mesmo tempo
      UPDATE recorrencias SET proximo_gerar_em = v_data
      WHERE id = v_rec.id AND proximo_gerar_em = v_rec.proximo_gerar_em;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      RAISE WARNING '[recorrencias] falha na recorrência %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;

  -- 4) Cobranças vencidas e não pagas → "atrasado"
  --    (isolado: se falhar, não desfaz as cobranças geradas acima)
  BEGIN
    PERFORM public.atualizar_status_vencidos();
  EXCEPTION WHEN OTHERS THEN
    v_erros := v_erros + 1;
    RAISE WARNING '[recorrencias] falha ao marcar vencidos: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'executado_em', now(),
    'pausadas', v_pausadas,
    'mensalidades_criadas', v_criadas,
    'cobrancas_geradas', v_geradas,
    'meses_passados_pulados', v_puladas,
    'erros', v_erros
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gerar_receitas_recorrentes_job() FROM PUBLIC, anon, authenticated;

-- Agenda: todo dia às 03:05 (horário de Brasília) = 06:05 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule(
      'faturion-recorrencias-diario',
      '5 6 * * *',
      'SELECT public.gerar_receitas_recorrentes_job()'
    );
  ELSE
    RAISE WARNING 'pg_cron indisponível: a geração diária não foi agendada.';
  END IF;
END $$;
