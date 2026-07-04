-- Migration 003: Refatoração financeira completa
-- Adiciona colunas, tabela de recorrências, views e functions

-- ============================================================
-- 1. TABELA RECORRENCIAS (Motor de recorrência)
-- ============================================================
CREATE TABLE IF NOT EXISTS recorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  recorrencia TEXT NOT NULL CHECK (recorrencia IN ('mensal', 'semanal', 'quinzenal', 'anual')),
  valor NUMERIC(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias_despesas(id) ON DELETE SET NULL,
  forma_pagamento TEXT,
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  is_ativa BOOLEAN DEFAULT true,
  proximo_gerar_em DATE,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recorrencias_select" ON recorrencias
  FOR SELECT USING (negocio_id IN (SELECT id FROM negocios WHERE usuario_id = auth.uid()));

CREATE POLICY "recorrencias_insert" ON recorrencias
  FOR INSERT WITH CHECK (negocio_id IN (SELECT id FROM negocios WHERE usuario_id = auth.uid()));

CREATE POLICY "recorreencias_update" ON recorrencias
  FOR UPDATE USING (negocio_id IN (SELECT id FROM negocios WHERE usuario_id = auth.uid()));

CREATE POLICY "recorreencias_delete" ON recorrencias
  FOR DELETE USING (negocio_id IN (SELECT id FROM negocios WHERE usuario_id = auth.uid()));

CREATE INDEX idx_recorrencias_negocio ON recorrencias(negocio_id);
CREATE INDEX idx_recorrencias_cliente ON recorrencias(cliente_id);
CREATE INDEX idx_recorrencias_proximo_gerar ON recorrencias(proximo_gerar_em) WHERE is_ativa = true;

-- ============================================================
-- 2. NOVAS COLUNAS — CLIENTES
-- ============================================================
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS valor_mensal NUMERIC(10,2);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fornecedor TEXT;

-- ============================================================
-- 3. NOVAS COLUNAS — RECEITAS
-- ============================================================
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS recorrencia_tipo TEXT DEFAULT 'nenhuma'
  CHECK (recorrencia_tipo IN ('nenhuma', 'mensal', 'semanal', 'quinzenal', 'anual'));
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS recorrencia_id UUID REFERENCES recorrencias(id) ON DELETE SET NULL;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS parcela_numero INTEGER;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS parcela_total INTEGER;
ALTER TABLE receitas ADD COLUMN IF NOT EXISTS grupo_parcela_id UUID;

-- ============================================================
-- 4. NOVAS COLUNAS — DESPESAS
-- ============================================================
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS fornecedor TEXT;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS comprovante_url TEXT;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS parcela_numero INTEGER;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS parcela_total INTEGER;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS grupo_parcela_id UUID;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS cartao_tipo TEXT CHECK (cartao_tipo IN ('avista', 'parcelado'));
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS cartao_parcelas INTEGER;
ALTER TABLE despesas ADD COLUMN IF NOT EXISTS cartao_valor_total NUMERIC(10,2);

-- ============================================================
-- 5. INDEXES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_receitas_data_vencimento ON receitas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_receitas_status ON receitas(status);
CREATE INDEX IF NOT EXISTS idx_receitas_cliente ON receitas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_receitas_grupo_parcela ON receitas(grupo_parcela_id) WHERE grupo_parcela_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_data_vencimento ON despesas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON despesas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_grupo_parcela ON despesas(grupo_parcela_id) WHERE grupo_parcela_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor ON despesas(fornecedor);

CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON clientes(tipo);
CREATE INDEX IF NOT EXISTS idx_clientes_valor_mensal ON clientes(valor_mensal) WHERE tipo = 'fixo';

-- ============================================================
-- 6. FUNCTION — Atualizar status automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION atualizar_status_vencidos()
RETURNS void AS $$
BEGIN
  -- Marcar receitas vencidas como atrasadas
  UPDATE receitas
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;

  -- Marcar despesas vencidas como atrasadas
  UPDATE despesas
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento IS NOT NULL
    AND data_vencimento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. VIEW — Calendário Financeiro
-- ============================================================
CREATE OR REPLACE VIEW calendario_financeiro AS
SELECT
  r.id,
  r.negocio_id,
  r.cliente_id,
  NULL::text AS fornecedor,
  r.descricao,
  r.valor,
  COALESCE(r.data_vencimento, r.data) AS data_evento,
  'receita'::text AS tipo,
  r.status,
  r.data_vencimento,
  r.data_pagamento,
  c.nome AS cliente_nome
FROM receitas r
LEFT JOIN clientes c ON r.cliente_id = c.id
WHERE r.status != 'cancelado'

UNION ALL

SELECT
  d.id,
  d.negocio_id,
  NULL::uuid AS cliente_id,
  d.fornecedor,
  d.descricao,
  d.valor,
  COALESCE(d.data_vencimento, d.data) AS data_evento,
  'despesa'::text AS tipo,
  d.status,
  d.data_vencimento,
  d.data_pagamento,
  NULL::text AS cliente_nome
FROM despesas d
WHERE d.status != 'cancelado';

-- ============================================================
-- 8. VIEW — Resumo Financeiro por Cliente
-- ============================================================
CREATE OR REPLACE VIEW resumo_cliente AS
SELECT
  c.id AS cliente_id,
  c.negocio_id,
  c.nome,
  c.tipo,
  c.valor_mensal,
  c.is_ativo,
  COALESCE(SUM(CASE WHEN r.status = 'pago' THEN r.valor ELSE 0 END), 0) AS total_recebido,
  COALESCE(SUM(CASE WHEN r.status IN ('pendente', 'atrasado') THEN r.valor ELSE 0 END), 0) AS total_em_aberto,
  COUNT(CASE WHEN r.status = 'pago' THEN 1 END) AS total_pagos,
  COUNT(CASE WHEN r.status = 'atrasado' THEN 1 END) AS total_atrasados,
  COUNT(CASE WHEN r.status = 'pendente' THEN 1 END) AS total_pendentes,
  MAX(CASE WHEN r.status = 'pago' THEN r.data_pagamento END) AS ultimo_pagamento,
  COUNT(r.id) AS total_receitas,
  MIN(r.criado_em) AS primeira_receita
FROM clientes c
LEFT JOIN receitas r ON r.cliente_id = c.id AND r.status != 'cancelado'
GROUP BY c.id, c.negocio_id, c.nome, c.tipo, c.valor_mensal, c.is_ativo;

-- ============================================================
-- 9. VIEW — KPIs do Dashboard
-- ============================================================
CREATE OR REPLACE VIEW kpis_dashboard AS
SELECT
  d.negocio_id,
  COALESCE(SUM(CASE
    WHEN d.tipo = 'receita' AND d.status = 'pago'
    AND d.data_pagamento >= date_trunc('month', CURRENT_DATE)
    AND d.data_pagamento < date_trunc('month', CURRENT_DATE) + interval '1 month'
    THEN d.valor ELSE 0 END), 0) AS receita_mes,
  COALESCE(SUM(CASE
    WHEN d.tipo = 'receita' AND d.status IN ('pendente', 'atrasado')
    THEN d.valor ELSE 0 END), 0) AS a_receber,
  COALESCE(SUM(CASE
    WHEN d.tipo = 'receita' AND d.status = 'atrasado'
    THEN d.valor ELSE 0 END), 0) AS atrasado,
  COALESCE(SUM(CASE
    WHEN d.tipo = 'despesa' AND d.status = 'pago'
    AND d.data_pagamento >= date_trunc('month', CURRENT_DATE)
    AND d.data_pagamento < date_trunc('month', CURRENT_DATE) + interval '1 month'
    THEN d.valor ELSE 0 END), 0) AS despesa_mes,
  COALESCE(mrr.valor, 0) AS mrr
FROM (
  SELECT negocio_id, valor, status, data_pagamento, 'receita' AS tipo
  FROM receitas WHERE status != 'cancelado'
  UNION ALL
  SELECT negocio_id, valor, status, data_pagamento, 'despesa' AS tipo
  FROM despesas WHERE status != 'cancelado'
) d
LEFT JOIN (
  SELECT negocio_id, SUM(valor_mensal) AS valor
  FROM clientes WHERE tipo = 'fixo' AND is_ativo = true
  GROUP BY negocio_id
) mrr ON mrr.negocio_id = d.negocio_id
GROUP BY d.negocio_id, mrr.valor;

-- ============================================================
-- 10. TRIGGER — atualizar_timestamp para recorrencias
-- ============================================================
CREATE OR REPLACE TRIGGER trigger_recorrencias_timestamp
  BEFORE UPDATE ON recorrencias
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();
