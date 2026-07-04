-- Migration 004: Tabela de assinaturas e pagamentos

CREATE TABLE IF NOT EXISTS assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id TEXT NOT NULL DEFAULT 'pro',
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'ativo', 'atrasado', 'cancelado', 'incompleto')),
  inicio_periodo TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim_periodo TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  trial_termina TIMESTAMPTZ,
  cancelar_ao_fim_periodo BOOLEAN DEFAULT false,
  cancelado_em TIMESTAMPTZ,
  metodo_pagamento_id TEXT,
  intent_pagamento_id TEXT,
  ultimo_pagamento TIMESTAMPTZ,
  proximo_pagamento TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assinaturas_select" ON assinaturas
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "assinaturas_insert" ON assinaturas
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "assinaturas_update" ON assinaturas
  FOR UPDATE USING (usuario_id = auth.uid());

CREATE INDEX idx_assinaturas_usuario ON assinaturas(usuario_id);
CREATE INDEX idx_assinaturas_status ON assinaturas(status);

-- Trigger para atualizar_timestamp
CREATE OR REPLACE TRIGGER trigger_assinaturas_timestamp
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();