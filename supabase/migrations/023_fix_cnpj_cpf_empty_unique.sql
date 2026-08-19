-- =====================================================
-- Migration 023: Corrigir cnpj_cpf vazio conflitando UNIQUE
-- =====================================================
-- O campo cnpj_cpf tem UNIQUE constraint, mas múltiplos
-- negocios podem ter cnpj_cpf = '' (string vazia), o que viola.
-- Converte strings vazias para NULL (NULLs são permitidos em UNIQUE).
-- =====================================================>

UPDATE negocios SET cnpj_cpf = NULL WHERE cnpj_cpf = '' OR cnpj_cpf IS NULL;
