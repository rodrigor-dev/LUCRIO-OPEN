ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS cliente_nome_manual TEXT;

COMMENT ON COLUMN propostas.cliente_nome_manual IS
  'Nome do cliente digitado livremente quando não há cliente cadastrado selecionado (cliente_id nulo).';
