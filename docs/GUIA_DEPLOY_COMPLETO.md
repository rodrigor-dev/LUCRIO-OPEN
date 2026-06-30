# Guia Completo de Deploy - LUCRIO SaaS

Passo a passo detalhado para configurar o Supabase e fazer deploy na Vercel.

---

## PARTE 1: CONFIGURAÇÃO DO SUPABASE

### 1.1 Criar Conta no Supabase

1. Acesse **https://supabase.com**
2. Clique em **"Start your project"** ou **"Sign Up"**
3. Faça login com GitHub (recomendado) ou crie uma conta com email
4. Você será redirecionado ao **Dashboard do Supabase**

### 1.2 Criar Novo Projeto

1. No Dashboard, clique em **"New Project"** (botão verde no canto superior direito)
2. Preencha os campos:

| Campo | Valor |
|-------|-------|
| **Organization** | Selecione ou crie uma organização |
| **Project name** | `lucrio-saas` |
| **Database Password** | Gere uma senha forte e **ANOTE** |
| **Region** | **East US (Virginia)** ou **South America (São Paulo)** |

3. Clique em **"Create new project"**
4. Aguarde 1-2 minutos para o projeto ser criado

### 1.3 Obter Chaves do Projeto

Após o projeto ser criado:

1. No painel esquerdo, clique em **"Settings"** (engrenagem)
2. Clique em **"API"**
3. Copie e salve em local seguro:

```
Project URL: https://xxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **NUNCA exponha a `service_role key`**. Ela tem acesso total ao banco.

### 1.4 Criar as Tabelas do Banco

1. No painel esquerdo, clique em **"SQL Editor"**
2. Clique em **"New query"**
3. Cole **TODO** o conteúdo do arquivo:

```
C:\Users\rodri\OneDrive\Documentos\LUCRIO SaaS\supabase\migrations\001_criar_tabelas_iniciais.sql
```

4. Clique no botão **"Run"** (▶️) ou pressione `Ctrl + Enter`
5. Aguarde a mensagem de sucesso

### 1.5 Verificar as Tabelas

1. No painel esquerdo, clique em **"Table Editor"**
2. Você deve ver todas as 14 tabelas criadas:
   - `usuarios`
   - `planos`
   - `negocios`
   - `clientes`
   - `categorias_despesas`
   - `despesas`
   - `servicos`
   - `receitas`
   - `contas_bancarias`
   - `propostas`
   - `itens_proposta`
   - `assinaturas`
   - `pagamentos`
   - `logs_atividade`

### 1.6 Configurar Autenticação (Login Google)

1. No painel esquerdo, clique em **"Authentication"**
2. Clique em **"Providers"**
3. Procure **"Google"** e clique nele
4. Você verá um formulário pedindo **Client ID** e **Client Secret**

#### Criar Projeto no Google Cloud:

1. Acesse **https://console.cloud.google.com**
2. Clique em **"Select a project"** → **"New Project"**
3. Nome: `LUCRIO SaaS` → Clique em **"Create"**
4. No painel esquerdo, vá em **"APIs & Services"** → **"Credentials"**
5. Clique em **"+ Create Credentials"** → **"OAuth client ID"**
6. Se pedir, configure a tela de consentimento:
   - Tipo de usuário: **External**
   - App name: `LUCRIO`
   - Email de suporte: seu email
   - Scopes: adicione `email` e `profile`
   - Salve

7. Agora crie o **OAuth client ID**:
   - Application type: **Web application**
   - Name: `LUCRIO Web`
   - Authorized redirect URIs: adicione:
     ```
     https://xxxxxxxx.supabase.co/auth/v1/callback
     ```
     (substitua pelo URL do seu projeto Supabase)

8. Copie o **Client ID** e **Client Secret**

#### Voltar ao Supabase:

1. Cole o **Client ID** e **Client Secret** nos campos correspondentes
2. Clique em **"Save"**

### 1.7 Configurar URL de Redirecionamento

1. No Supabase, vá em **Authentication** → **URL Configuration**
2. Em **Site URL**, coloque:
   ```
   http://localhost:3000
   ```
   (depois atualize para o domínio da Vercel)

3. Em **Redirect URLs**, adicione:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/dashboard
   https://seu-app.vercel.app/auth/callback
   https://seu-app.vercel.app/dashboard
   ```

4. Clique em **"Save"**

### 1.8 Obter Credenciais Finais

Acesse **Settings → API** e copie:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## PARTE 2: CONFIGURAÇÃO LOCAL (ANTES DO DEPLOY)

### 2.1 Inicializar Git

Abra o terminal na pasta do projeto:

```powershell
cd "C:\Users\rodri\OneDrive\Documentos\LUCRIO SaaS"
git init
git add .
git commit -m "feat: projeto inicial LUCRIO SaaS"
```

### 2.2 Criar Repositório no GitHub

1. Acesse **https://github.com/new**
2. Nome: `LUCRIO-OPEN`
3. **NÃO** marque "Add a README" (já temos um)
4. Clique em **"Create repository"**
5. Copie a URL do repositório

### 2.3 Conectar ao GitHub

```powershell
git remote add origin https://github.com/SEU-USER/LUCRIO-OPEN.git
git branch -M main
git push -u origin main
```

### 2.4 Criar Arquivo .env.local

Copie o arquivo `.env.local.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
OPENROUTER_API_KEY=sua-chave-openrouter
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
MERCADO_PAGO_ACCESS_TOKEN=seu-token
MERCADO_PAGO_PUBLIC_KEY=sua-public-key
MERCADO_PAGO_WEBHOOK_SECRET=seu-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=LUCRIO
```

### 2.5 Testar Localmente

```powershell
npm install
npm run dev
```

Acesse **http://localhost:3000** e teste o cadastro/login.

---

## PARTE 3: DEPLOY NA VERCEL

### 3.1 Criar Conta no Vercel

1. Acesse **https://vercel.com**
2. Clique em **"Sign Up"**
3. Faça login com GitHub (recomendado)

### 3.2 Importar Projeto

1. No Dashboard, clique em **"Add New..."** → **"Project"**
2. Na seção **"Import Git Repository"**, selecione `LUCRIO-OPEN`
3. Clique em **"Import"**

### 3.3 Configurar o Projeto

Na tela de configuração:

| Campo | Valor |
|-------|-------|
| **Framework Preset** | Next.js (detectado automaticamente) |
| **Root Directory** | `./` |
| **Build Command** | `next build` |
| **Output Directory** | `.next` |

### 3.4 Adicionar Variáveis de Ambiente

Clique em **"Environment Variables"** e adicione **UMA POR UMA**:

```
NEXT_PUBLIC_SUPABASE_URL
→ https://xxxxxxxx.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
→ eyJhbGciOiJIUzI1NiIs...

OPENROUTER_API_KEY
→ sk-or-v1-...

OPENROUTER_MODEL
→ meta-llama/llama-3.1-8b-instruct:free

MERCADO_PAGO_ACCESS_TOKEN
→ TEST-xxx ou APP_USR-xxx

MERCADO_PAGO_PUBLIC_KEY
→ APP_USR-xxx

MERCADO_PAGO_WEBHOOK_SECRET
→ seu-webhook-secret

NEXT_PUBLIC_APP_URL
→ https://seu-app.vercel.app

NEXT_PUBLIC_APP_NAME
→ LUCRIO
```

> ⚠️ **Importante:** Marque `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` como **"Available in Preview"** e **"Production"**.

### 3.5 Fazer Deploy

1. Clique em **"Deploy"**
2. Aguarde o build (geralmente 1-3 minutos)
3. Veja os logs em tempo real
4. Quando terminar, clique no link azul para acessar

### 3.6 Configurar Domínio (Opcional)

1. No Dashboard do projeto, vá em **"Settings"** → **"Domains"**
2. Digite seu domínio (ex: `lucrio.com.br`)
3. Siga as instruções para configurar DNS

### 3.7 Atualizar URLs no Supabase

Após o deploy, volte ao Supabase e atualize:

1. **Authentication → URL Configuration**
   - Site URL: `https://seu-app.vercel.app`
   - Redirect URLs: adicione `https://seu-app.vercel.app/auth/callback`

2. **Google Cloud Console** (se usou Google Login):
   - Adicione `https://seu-app.vercel.app` nos **Authorized JavaScript origins**
   - Adicione `https://seu-app.vercel.app/auth/callback` nos **Authorized redirect URIs**

---

## PARTE 4: CONFIGURAÇÃO DO OPENROUTER (IA)

### 4.1 Criar Conta

1. Acesse **https://openrouter.ai**
2. Clique em **"Sign In"** e faça login com GitHub/Google

### 4.2 Obter Chave da API

1. Vá em **"Keys"** no menu
2. Clique em **"Create Key"**
3. Nome: `LUCRIO`
4. Copie a chave e salve no `.env.local`

> O plano gratuito inclui modelos como Llama 3.1, Mistral, etc.

---

## PARTE 5: CONFIGURAÇÃO DO MERCADO PAGO (PAGAMENTOS)

### 5.1 Criar Conta

1. Acesse **https://www.mercadopago.com.br**
2. Clique em **"Criar conta"** ou **"Cadastrar"**
3. Preencha seus dados

### 5.2 Obter Credenciais

#### Para Testes (Sandbox):
1. No Dashboard, vá em **"Seu negócio"** → **"Credenciais"**
2. Copie:
   - **Access Token (produção)**
   - **Public Key (produção)**

#### Para Produção:
1. Complete a verificação de identidade
2. As credenciais serão liberadas automaticamente

### 5.3 Webhooks (Produção)

1. No Dashboard, vá em **"Seu negócio"** → **"Webhooks"**
2. Clique em **"Adicionar webhook"**
3. URL: `https://seu-app.vercel.app/api/webhooks/mercopag`
4. Eventos: marque **"Pagamentos"**
5. Salve

---

## PARTE 6: CHECKLIST PÓS-DEPLOY

- [ ] Supabase: Todas as 14 tabelas criadas
- [ ] Supabase: Google OAuth configurado
- [ ] Supabase: Redirect URLs atualizadas
- [ ] Vercel: Todas as variáveis de ambiente configuradas
- [ ] Vercel: Build realizado com sucesso
- [ ] OpenRouter: Chave da API configurada
- [ ] Mercado Pago: Credenciais configuradas (se aplicável)
- [ ] Teste: Login com email/senha funcionando
- [ ] Teste: Login com Google funcionando
- [ ] Teste: Cadastro de clientes funcionando
- [ ] Teste: Receitas e despesas funcionando
- [ ] PWA: App instalável no celular

---

## SOLUÇÃO DE PROBLEMAS

### Build falha na Vercel
- Verifique se todas as variáveis de ambiente estão configuradas
- Verifique os logs de build no Dashboard da Vercel

### Login Google não funciona
- Verifique se o Client ID e Secret estão corretos no Supabase
- Verifique se as URLs de redirecionamento estão corretas
- Verifique se o app está em modo "Testing" no Google Cloud

### Tabelas não existem
- Execute novamente a migration SQL no Supabase SQL Editor
- Verifique se não houve erro na execução

### PWA não instala
- Verifique se o manifest.json está acessível
- Verifique se o service worker está registrado
- Teste em HTTPS (a Vercel fornece automaticamente)

---

## COMANDOS ÚTEIS

```powershell
# Rodar localmente
npm run dev

# Build de produção
npm run build

# Lint
npm run lint

# Typecheck
npm run typecheck

# Deploy via CLI (opcional)
npx vercel --prod
```

---

**Parabéns!** Seu SaaS LUCRIO está agora rodando em produção! 🚀
