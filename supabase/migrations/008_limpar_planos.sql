-- Migration 008: Limpar planos - manter apenas PRO
-- Execute no SQL Editor do Supabase

-- 1. Adicionar DELETE policy para admin na tabela planos
CREATE POLICY "planos_delete_admin" ON planos
    FOR DELETE USING (is_user_admin());

-- 2. Migrar assinaturas do plano Basico para PRO (se existirem)
UPDATE assinaturas
SET plano_id = (SELECT id FROM planos WHERE slug = 'pro' LIMIT 1)
WHERE plano_id IN (SELECT id FROM planos WHERE slug != 'pro');

-- 3. Migrar cupons que referenciam planos diferentes de PRO
UPDATE cupons
SET plano_permitido_id = NULL
WHERE plano_permitido_id IS NOT NULL
AND plano_permitido_id != (SELECT id FROM planos WHERE slug = 'pro' LIMIT 1);

-- 4. Deletar todos os planos que NAO sao o PRO
DELETE FROM planos WHERE slug != 'pro';

-- 5. Atualizar plano PRO para garantir dados corretos
UPDATE planos SET
    nome = 'PRO',
    slug = 'pro',
    descricao = 'Plano completo com todas as funcionalidades',
    preco_mensal = 14.99,
    preco_anual = 139.99,
    moeda = 'BRL',
    is_ativo = true,
    is_destaque = true,
    ordem = 1,
    limite_clientes = -1,
    limite_receitas = -1,
    limite_despesas = -1,
    limite_armazenamento_mb = 1024,
    limite_usuarios = 1,
    cor = '#10b981',
    funcionalidades = '[
        "Clientes ilimitados",
        "Receitas e despesas",
        "Calendario financeiro",
        "Relatorios avancados",
        "Propostas comerciais em PDF",
        "Suporte prioritario",
        "Acesso PWA",
        "Atualizacoes gratuitas"
    ]'::jsonb,
    atualizado_em = now()
WHERE slug = 'pro';
