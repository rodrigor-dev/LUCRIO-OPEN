-- Migration 014: Inserir plano PRO (se nao existir)
-- A tabela planos esta vazia porque a migration 005 pode nao ter sido aplicada corretamente

-- Funcao SECURITY DEFINER para inserir o plano PRO sem RLS
CREATE OR REPLACE FUNCTION seed_plano_pro()
RETURNS UUID AS $$
DECLARE
  v_plano_id UUID;
BEGIN
  -- Verificar se ja existe
  SELECT id INTO v_plano_id FROM planos WHERE slug = 'pro' LIMIT 1;
  
  IF v_plano_id IS NOT NULL THEN
    RETURN v_plano_id;
  END IF;

  -- Inserir plano PRO
  INSERT INTO planos (
    nome, slug, descricao, preco_mensal, preco_anual,
    is_ativo, is_destaque, ordem, limite_clientes,
    funcionalidades
  ) VALUES (
    'PRO', 'pro', 'Plano completo com todas as funcionalidades',
    14.99, 139.99, true, true, 2, -1,
    '["Clientes ilimitados","Receitas e despesas","Calendario financeiro","Relatorios avancados","Propostas","Suporte prioritario"]'::jsonb
  ) RETURNING id INTO v_plano_id;

  RETURN v_plano_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar
SELECT seed_plano_pro();

-- Verificar
SELECT id, nome, slug, preco_mensal, preco_anual, is_ativo FROM planos WHERE slug = 'pro';
