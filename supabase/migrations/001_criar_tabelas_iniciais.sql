-- ============================================
-- LUCRIO SaaS - Migração Inicial do Banco de Dados
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. TABELA: USUÁRIOS
-- ============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    avatar_url TEXT,
    telefone TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    plano_id UUID,
    trial_termina_em TIMESTAMPTZ,
    is_ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_plano ON usuarios(plano_id);

-- ============================================
-- 2. TABELA: PLANOS
-- ============================================
CREATE TABLE planos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    descricao TEXT NOT NULL,
    preco_mensal DECIMAL(10,2) NOT NULL,
    preco_anual DECIMAL(10,2) NOT NULL,
    moeda TEXT DEFAULT 'BRL',
    funcionalidades JSONB DEFAULT '[]',
    max_clientes INTEGER,
    max_servicos INTEGER,
    is_ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir plano padrão
INSERT INTO planos (nome, descricao, preco_mensal, preco_anual, funcionalidades)
VALUES (
    'Plano Básico',
    'Ideal para quem está começando',
    29.90,
    299.00,
    '["Clientes ilimitados", "Receitas e despesas", "Fluxo de caixa", "Relatórios básicos", "Propostas comerciais"]'
);

-- ============================================
-- 3. TABELA: NEGÓCIOS
-- ============================================
CREATE TABLE negocios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cnpj_cpf TEXT UNIQUE,
    telefone TEXT,
    email TEXT,
    endereco JSONB DEFAULT '{}',
    logo_url TEXT,
    is_ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_negocios_usuario ON negocios(usuario_id);

-- ============================================
-- 4. TABELA: CLIENTES
-- ============================================
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    cpf_cnpj TEXT,
    endereco JSONB DEFAULT '{}',
    tipo TEXT CHECK (tipo IN ('fixo', 'esporadico')) NOT NULL DEFAULT 'esporadico',
    observacoes TEXT,
    is_ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_negocio ON clientes(negocio_id);
CREATE INDEX idx_clientes_tipo ON clientes(tipo);

-- ============================================
-- 5. TABELA: CATEGORIAS DE DESPESAS
-- ============================================
CREATE TABLE categorias_despesas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    icone TEXT,
    cor TEXT,
    tipo TEXT CHECK (tipo IN ('padrao', 'personalizada')) DEFAULT 'padrao',
    is_ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. TABELA: DESPESAS
-- ============================================
CREATE TABLE despesas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES categorias_despesas(id),
    descricao TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data DATE NOT NULL,
    forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro', 'cartao', 'pix', 'transferencia')),
    status TEXT CHECK (status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
    observacoes TEXT,
    comprovante_url TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_despesas_negocio ON despesas(negocio_id);
CREATE INDEX idx_despesas_data ON despesas(data);
CREATE INDEX idx_despesas_categoria ON despesas(categoria_id);

-- ============================================
-- 7. TABELA: SERVIÇOS
-- ============================================
CREATE TABLE servicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT,
    valor DECIMAL(10,2) NOT NULL,
    data DATE NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'concluido', 'cancelado')) DEFAULT 'pendente',
    forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro', 'cartao', 'pix', 'transferencia')),
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_servicos_negocio ON servicos(negocio_id);
CREATE INDEX idx_servicos_cliente ON servicos(cliente_id);
CREATE INDEX idx_servicos_data ON servicos(data);

-- ============================================
-- 8. TABELA: RECEITAS
-- ============================================
CREATE TABLE receitas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id),
    servico_id UUID REFERENCES servicos(id),
    descricao TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data DATE NOT NULL,
    status TEXT CHECK (status IN ('pendente', 'pago', 'cancelado')) DEFAULT 'pendente',
    forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro', 'cartao', 'pix', 'transferencia')),
    comprovante_url TEXT,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receitas_negocio ON receitas(negocio_id);
CREATE INDEX idx_receitas_cliente ON receitas(cliente_id);
CREATE INDEX idx_receitas_data ON receitas(data);

-- ============================================
-- 9. TABELA: CONTAS BANCÁRIAS
-- ============================================
CREATE TABLE contas_bancarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nome_banco TEXT NOT NULL,
    numero_conta TEXT NOT NULL,
    agencia TEXT,
    tipo_conta TEXT CHECK (tipo_conta IN ('corrente', 'poupanca')) DEFAULT 'corrente',
    saldo DECIMAL(12,2) DEFAULT 0,
    is_ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. TABELA: PROPOSTAS COMERCIAIS
-- ============================================
CREATE TABLE propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id),
    numero_proposta TEXT NOT NULL,
    validade DATE NOT NULL,
    status TEXT CHECK (status IN ('rascunho', 'enviada', 'aceita', 'recusada', 'expirada')) DEFAULT 'rascunho',
    subtotal DECIMAL(10,2) NOT NULL,
    desconto DECIMAL(10,2) DEFAULT 0,
    frete DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    condicoes_gerais TEXT,
    observacoes TEXT,
    pdf_url TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_propostas_negocio ON propostas(negocio_id);
CREATE INDEX idx_propostas_cliente ON propostas(cliente_id);

-- ============================================
-- 11. TABELA: ITENS DE PROPOSTAS
-- ============================================
CREATE TABLE itens_proposta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    valor_unitario DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. TABELA: ASSINATURAS
-- ============================================
CREATE TABLE assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL REFERENCES planos(id),
    status TEXT CHECK (status IN ('trial', 'ativo', 'atrasado', 'cancelado', 'incompleto')) DEFAULT 'trial',
    inicio_periodo TIMESTAMPTZ NOT NULL,
    fim_periodo TIMESTAMPTZ NOT NULL,
    trial_termina TIMESTAMPTZ,
    cancelar_ao_fim_periodo BOOLEAN DEFAULT FALSE,
    cancelado_em TIMESTAMPTZ,
    metodo_pagamento_id TEXT,
    intent_pagamento_id TEXT,
    ultimo_pagamento TIMESTAMPTZ,
    proximo_pagamento TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assinaturas_usuario ON assinaturas(usuario_id);
CREATE INDEX idx_assinaturas_status ON assinaturas(status);

-- ============================================
-- 13. TABELA: PAGAMENTOS
-- ============================================
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assinatura_id UUID REFERENCES assinaturas(id),
    negocio_id UUID REFERENCES negocios(id),
    valor DECIMAL(10,2) NOT NULL,
    moeda TEXT DEFAULT 'BRL',
    status TEXT CHECK (status IN ('pendente', 'concluido', 'falhou', 'reembolsado')) DEFAULT 'pendente',
    metodo_pagamento TEXT CHECK (metodo_pagamento IN ('cartao_credito', 'cartao_debito', 'pix', 'boleto')),
    data_pagamento TIMESTAMPTZ,
    transacao_id TEXT,
    metadata JSONB DEFAULT '{}',
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. TABELA: LOGS DE ATIVIDADES
-- ============================================
CREATE TABLE logs_atividade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id),
    acao TEXT NOT NULL,
    entidade_tipo TEXT NOT NULL,
    entidade_id UUID,
    alteracoes JSONB,
    ip_address INET,
    user_agent TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_proposta ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_atividade ENABLE ROW LEVEL SECURITY;

-- Políticas para USUÁRIOS
CREATE POLICY "usuarios_select_own" ON usuarios
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "usuarios_update_own" ON usuarios
    FOR UPDATE USING (auth.uid() = id);

-- Políticas para NEGÓCIOS
CREATE POLICY "negocios_select_own" ON negocios
    FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "negocios_insert_own" ON negocios
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "negocios_update_own" ON negocios
    FOR UPDATE USING (auth.uid() = usuario_id);

CREATE POLICY "negocios_delete_own" ON negocios
    FOR DELETE USING (auth.uid() = usuario_id);

-- Políticas para CLIENTES
CREATE POLICY "clientes_select_own" ON clientes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = clientes.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "clientes_insert_own" ON clientes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = clientes.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "clientes_update_own" ON clientes
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = clientes.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "clientes_delete_own" ON clientes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = clientes.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para CATEGORIAS DE DESPESAS
CREATE POLICY "categorias_despesas_select_own" ON categorias_despesas
    FOR SELECT USING (
        negocio_id IS NULL OR EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = categorias_despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para DESPESAS
CREATE POLICY "despesas_select_own" ON despesas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "despesas_insert_own" ON despesas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "despesas_update_own" ON despesas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "despesas_delete_own" ON despesas
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = despesas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para SERVIÇOS
CREATE POLICY "servicos_select_own" ON servicos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = servicos.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "servicos_insert_own" ON servicos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = servicos.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "servicos_update_own" ON servicos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = servicos.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "servicos_delete_own" ON servicos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = servicos.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para RECEITAS
CREATE POLICY "receitas_select_own" ON receitas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = receitas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "receitas_insert_own" ON receitas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = receitas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "receitas_update_own" ON receitas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = receitas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "receitas_delete_own" ON receitas
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = receitas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para CONTAS BANCÁRIAS
CREATE POLICY "contas_bancarias_select_own" ON contas_bancarias
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = contas_bancarias.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "contas_bancarias_insert_own" ON contas_bancarias
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = contas_bancarias.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para PROPOSTAS
CREATE POLICY "propostas_select_own" ON propostas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = propostas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "propostas_insert_own" ON propostas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = propostas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "propostas_update_own" ON propostas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM negocios
            WHERE negocios.id = propostas.negocio_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para ITENS DE PROPOSTA
CREATE POLICY "itens_proposta_select_own" ON itens_proposta
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM propostas
            JOIN negocios ON negocios.id = propostas.negocio_id
            WHERE propostas.id = itens_proposta.proposta_id
            AND negocios.usuario_id = auth.uid()
        )
    );

CREATE POLICY "itens_proposta_insert_own" ON itens_proposta
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM propostas
            JOIN negocios ON negocios.id = propostas.negocio_id
            WHERE propostas.id = itens_proposta.proposta_id
            AND negocios.usuario_id = auth.uid()
        )
    );

-- Políticas para ASSINATURAS
CREATE POLICY "assinaturas_select_own" ON assinaturas
    FOR SELECT USING (auth.uid() = usuario_id);

-- Políticas para PAGAMENTOS
CREATE POLICY "pagamentos_select_own" ON pagamentos
    FOR SELECT USING (
        auth.uid() = (SELECT usuario_id FROM assinaturas WHERE assinaturas.id = pagamentos.assinatura_id)
    );

-- Políticas para LOGS DE ATIVIDADE
CREATE POLICY "logs_atividade_select_own" ON logs_atividade
    FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "logs_atividade_insert_own" ON logs_atividade
    FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Função para atualizar automaticamente o campo atualizado_em
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar timestamp
CREATE TRIGGER trigger_usuarios_atualizado
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_negocios_atualizado
    BEFORE UPDATE ON negocios
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_clientes_atualizado
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_despesas_atualizado
    BEFORE UPDATE ON despesas
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_servicos_atualizado
    BEFORE UPDATE ON servicos
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_receitas_atualizado
    BEFORE UPDATE ON receitas
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_contas_bancarias_atualizado
    BEFORE UPDATE ON contas_bancarias
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_propostas_atualizado
    BEFORE UPDATE ON propostas
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_assinaturas_atualizado
    BEFORE UPDATE ON assinaturas
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_pagamentos_atualizado
    BEFORE UPDATE ON pagamentos
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

-- ============================================
-- FUNÇÕES DE NECESSIDADE
-- ============================================

-- Criar negócio automaticamente quando usuário se cadastra
CREATE OR REPLACE FUNCTION criar_negocio_para_usuario()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO negocios (usuario_id, nome)
    VALUES (NEW.id, 'Meu Negócio');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_criar_negocio
    AFTER INSERT ON usuarios
    FOR EACH ROW EXECUTE FUNCTION criar_negocio_para_usuario();

-- Criar categorias padrão de despesas para novo negócio
CREATE OR REPLACE FUNCTION criar_categorias_padrao()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categorias_despesas (negocio_id, nome, icone, cor, tipo)
    VALUES
        (NEW.id, 'Combustível', '⛽', '#FF6B35', 'padrao'),
        (NEW.id, 'Alimentação', '🍔', '#4CAF50', 'padrao'),
        (NEW.id, 'Materiais', '📦', '#2196F3', 'padrao'),
        (NEW.id, 'Ferramentas', '🔧', '#9C27B0', 'padrao'),
        (NEW.id, 'Internet', '🌐', '#00BCD4', 'padrao'),
        (NEW.id, 'Água', '💧', '#03A9F4', 'padrao'),
        (NEW.id, 'Energia', '⚡', '#FFC107', 'padrao'),
        (NEW.id, 'Telefone', '📱', '#E91E63', 'padrao'),
        (NEW.id, 'Marketing', '📢', '#FF5722', 'padrao'),
        (NEW.id, 'Software', '💻', '#607D8B', 'padrao'),
        (NEW.id, 'Impostos', '📋', '#795548', 'padrao'),
        (NEW.id, 'Transporte', '🚗', '#3F51B5', 'padrao'),
        (NEW.id, 'Equipamentos', '🏗️', '#8BC34A', 'padrao'),
        (NEW.id, 'Outros', '📌', '#9E9E9E', 'padrao');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_criar_categorias
    AFTER INSERT ON negocios
    FOR EACH ROW EXECUTE FUNCTION criar_categorias_padrao();
