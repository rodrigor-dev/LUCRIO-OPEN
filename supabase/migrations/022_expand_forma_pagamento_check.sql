-- =====================================================
-- Migration 022: Expandir CHECK constraint de forma_pagamento
-- =====================================================
-- A migration 001 criou constraints com apenas 4 valores:
--   ('dinheiro', 'cartao', 'pix', 'transferencia')
-- O frontend adicionou opções: debito, credito, boleto
-- Esta migration expande as 3 tabelas para aceitar todos os 7 valores.
-- =====================================================>

-- DESPESAS
ALTER TABLE despesas DROP CONSTRAINT IF EXISTS despesas_forma_pagamento_check;
ALTER TABLE despesas ADD CONSTRAINT despesas_forma_pagamento_check
  CHECK (forma_pagamento IN ('pix', 'dinheiro', 'debito', 'credito', 'cartao', 'boleto', 'transferencia'));

-- RECEITAS
ALTER TABLE receitas DROP CONSTRAINT IF EXISTS receitas_forma_pagamento_check;
ALTER TABLE receitas ADD CONSTRAINT receitas_forma_pagamento_check
  CHECK (forma_pagamento IN ('pix', 'dinheiro', 'debito', 'credito', 'cartao', 'boleto', 'transferencia'));

-- SERVICOS
ALTER TABLE servicos DROP CONSTRAINT IF EXISTS servicos_forma_pagamento_check;
ALTER TABLE servicos ADD CONSTRAINT servicos_forma_pagamento_check
  CHECK (forma_pagamento IN ('pix', 'dinheiro', 'debito', 'credito', 'cartao', 'boleto', 'transferencia'));
