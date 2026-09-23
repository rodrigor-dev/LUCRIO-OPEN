-- ============================================================
-- 022: Corrigir duplicação de receitas recorrentes (bug de condição de corrida)
-- ============================================================
-- Causa raiz: a função gerarReceitasRecorrentes() é chamada tanto ao
-- abrir o Dashboard quanto ao abrir a tela de Receitas. Se as duas
-- chamadas acontecerem quase ao mesmo tempo (ex: usuário navega rápido
-- de uma tela pra outra), as duas conferem "essa receita já existe?"
-- ANTES de qualquer uma delas ter inserido nada — as duas veem "não
-- existe" e as duas inserem, gerando duplicata. Isso é uma condição
-- de corrida clássica, e por isso só acontecia com alguns usuários (os
-- que, por coincidência de tempo/rede, disparavam as duas chamadas
-- quase juntas), nunca com todos.
--
-- Esta migration:
-- 1. Limpa as duplicatas que já existem no banco (mantendo a que foi
--    paga, se alguma foi, senão a mais antiga).
-- 2. Cria uma trava (UNIQUE) que impede fisicamente o banco de aceitar
--    uma duplicata de novo — mesmo que duas chamadas cheguem juntas,
--    só uma consegue inserir; a outra recebe um erro que o código já
--    trata como "ok, já existe".
-- ============================================================

-- 0) Adicionar colunas que a migration 003 não aplicou (se não existirem)
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS recorrencia_id UUID REFERENCES recorrencias(id) ON DELETE SET NULL;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS recorrencia_id UUID REFERENCES recorrencias(id) ON DELETE SET NULL;

-- 1) Limpar duplicatas existentes (mesma recorrencia_id + mesma data)
WITH duplicatas AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY recorrencia_id, data
      ORDER BY
        CASE WHEN status = 'pago' THEN 0 ELSE 1 END, -- prioriza manter a que já foi paga
        criado_em ASC                                 -- entre as demais, mantém a mais antiga
    ) AS ordem
  FROM receitas
  WHERE recorrencia_id IS NOT NULL
)
DELETE FROM receitas
WHERE id IN (
  SELECT id FROM duplicatas WHERE ordem > 1
);

-- 2) Impedir duplicatas novas: uma recorrência só pode gerar UMA
-- receita por data (isso é seguro porque cada ciclo da recorrência
-- sempre teria uma data diferente da anterior).
ALTER TABLE receitas
  DROP CONSTRAINT IF EXISTS receitas_recorrencia_data_unica;

CREATE UNIQUE INDEX IF NOT EXISTS receitas_recorrencia_data_unica
  ON receitas (recorrencia_id, data)
  WHERE recorrencia_id IS NOT NULL;

-- O mesmo problema pode acontecer com despesas recorrentes (mesmo
-- padrão de função/chamada dupla), então a mesma proteção é aplicada lá.
WITH duplicatas_despesas AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY recorrencia_id, data
      ORDER BY
        CASE WHEN status = 'pago' THEN 0 ELSE 1 END,
        criado_em ASC
    ) AS ordem
  FROM despesas
  WHERE recorrencia_id IS NOT NULL
)
DELETE FROM despesas
WHERE id IN (
  SELECT id FROM duplicatas_despesas WHERE ordem > 1
);

ALTER TABLE despesas
  DROP CONSTRAINT IF EXISTS despesas_recorrencia_data_unica;

CREATE UNIQUE INDEX IF NOT EXISTS despesas_recorrencia_data_unica
  ON despesas (recorrencia_id, data)
  WHERE recorrencia_id IS NOT NULL;
