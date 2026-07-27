-- Migration 018: Criar buckets para logos e avatars no Supabase Storage
-- Executar no painel do Supabase (SQL Editor)

-- Bucket para logotipos de negócios (aparece em PDFs de orçamento)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Bucket para avatares/fotos de perfil (aparece em vários lugares do app)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para logos (cada usuário só mexe no próprio)
CREATE POLICY "Usuários podem visualizar logos públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Usuários podem fazer upload da própria logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem atualizar a própria logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem deletar a própria logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Políticas de acesso para avatars (cada usuário só mexe no próprio)
CREATE POLICY "Usuários podem visualizar avatares públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Usuários podem fazer upload do próprio avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem atualizar o próprio avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Usuários podem deletar o próprio avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
