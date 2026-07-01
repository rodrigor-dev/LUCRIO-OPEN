-- ============================================
-- LUCRIO SaaS - Correção de RLS e Segurança
-- ============================================

-- 1. Habilitar RLS na tabela planos (estava sem RLS)
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;

-- Planos são públicos (qualquer usuário autenticado pode ler)
CREATE POLICY "planos_select_authenticated" ON planos
    FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Adicionar INSERT policy para usuarios (necessário para auth callback)
CREATE POLICY "usuarios_insert_auth" ON usuarios
    FOR INSERT WITH CHECK (
        auth.uid() = id
    );

-- 3. Adicionar políticas para categorias_despesas
CREATE POLICY "categorias_despesas_insert_own" ON categorias_despesas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = categorias_despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "categorias_despesas_update_own" ON categorias_despesas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = categorias_despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "categorias_despesas_delete_own" ON categorias_despesas
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = categorias_despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- 4. Adicionar DELETE policy para itens_proposta
CREATE POLICY "itens_proposta_delete_own" ON itens_proposta
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM propostas
            JOIN negocios ON negocios.id = propostas.negocio_id
            WHERE propostas.id = itens_proposta.proposta_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "itens_proposta_update_own" ON itens_proposta
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM propostas
            JOIN negocios ON negocios.id = propostas.negocio_id
            WHERE propostas.id = itens_proposta.proposta_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- 5. Adicionar políticas para assinaturas
CREATE POLICY "assinaturas_insert_own" ON assinaturas
    FOR INSERT WITH CHECK (
        auth.uid() = usuario_id
    );

CREATE POLICY "assinaturas_update_own" ON assinaturas
    FOR UPDATE USING (
        auth.uid() = usuario_id
    );

-- 6. Adicionar políticas para pagamentos
CREATE POLICY "pagamentos_insert_own" ON pagamentos
    FOR INSERT WITH CHECK (
        auth.uid() = (
            SELECT usuario_id FROM assinaturas
            WHERE assinaturas.id = pagamentos.assinatura_id
        )
    );

CREATE POLICY "pagamentos_update_own" ON pagamentos
    FOR UPDATE USING (
        auth.uid() = (
            SELECT usuario_id FROM assinaturas
            WHERE assinaturas.id = pagamentos.assinatura_id
        )
    );

-- 7. Adicionar políticas para contas_bancarias
CREATE POLICY "contas_bancarias_update_own" ON contas_bancarias
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = contas_bancarias.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "contas_bancarias_delete_own" ON contas_bancarias
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = contas_bancarias.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- 8. Adicionar DELETE policy para propostas
CREATE POLICY "propostas_delete_own" ON propostas
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = propostas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- 9. Índices para performance
CREATE INDEX IF NOT EXISTS idx_categorias_despesas_negocio ON categorias_despesas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_usuario_status ON assinaturas(usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_receitas_status ON receitas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON despesas(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_assinatura ON pagamentos(assinatura_id);
