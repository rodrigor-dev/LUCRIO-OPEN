-- ============================================================
-- 025: Recorrências de clientes fixos confiáveis
-- ============================================================
-- Contexto: alguns usuários não viam todos os clientes fixos em Receitas.
-- Causas encontradas no código (corrigidas no app nesta mesma entrega):
--   * vencimento dia 29/30/31 gerava datas inválidas (ex.: 31/11) e o
--     banco recusava a receita sem avisar ninguém;
--   * a data do próximo ciclo "andava" (31/jan → 03/mar → 03/abr...);
--   * só aparecia no mês quem já tinha passado do dia de vencimento.
--
-- Esta migration:
--   1. Desativa recorrências ativas duplicadas do mesmo cliente
--      (mantém a mais recente) e impede que voltem a existir.
--   2. Recoloca no dia certo os próximos ciclos que "andaram",
--      sem mexer em meses que já têm receita gerada.
-- Segura para rodar mais de uma vez.
-- ============================================================

-- 1) Uma única recorrência ATIVA de receita por cliente
WITH ordenadas AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY cliente_id
      ORDER BY atualizado_em DESC NULLS LAST, criado_em DESC
    ) AS ordem
  FROM recorrencias
  WHERE tipo = 'receita'
    AND cliente_id IS NOT NULL
    AND is_ativa = true
)
UPDATE recorrencias r
SET is_ativa = false
FROM ordenadas o
WHERE r.id = o.id
  AND o.ordem > 1;

CREATE UNIQUE INDEX IF NOT EXISTS recorrencias_receita_ativa_por_cliente
  ON recorrencias (cliente_id)
  WHERE tipo = 'receita' AND is_ativa = true AND cliente_id IS NOT NULL;

-- 2) Re-ancorar o próximo ciclo mensal no dia de vencimento cadastrado
--    (limitado ao último dia do mês), apenas se aquele mês ainda não
--    tem receita gerada por essa recorrência.
UPDATE recorrencias r
SET proximo_gerar_em = make_date(
      EXTRACT(YEAR FROM r.proximo_gerar_em)::int,
      EXTRACT(MONTH FROM r.proximo_gerar_em)::int,
      LEAST(
        r.dia_vencimento,
        EXTRACT(DAY FROM (date_trunc('month', r.proximo_gerar_em) + INTERVAL '1 month - 1 day'))::int
      )
    )
WHERE r.recorrencia = 'mensal'
  AND r.is_ativa = true
  AND r.dia_vencimento IS NOT NULL
  AND r.proximo_gerar_em IS NOT NULL
  AND EXTRACT(DAY FROM r.proximo_gerar_em)::int <> LEAST(
        r.dia_vencimento,
        EXTRACT(DAY FROM (date_trunc('month', r.proximo_gerar_em) + INTERVAL '1 month - 1 day'))::int
      )
  AND NOT EXISTS (
    SELECT 1 FROM receitas rc
    WHERE rc.recorrencia_id = r.id
      AND date_trunc('month', rc.data) = date_trunc('month', r.proximo_gerar_em)
  );
