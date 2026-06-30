# LUCRIO - Sistema Financeiro para Prestadores de Serviços

Um SaaS completo e profissional para gestão financeira de prestadores de serviços autônomos, MEIs e pequenos empresários.

## Tecnologias

### Frontend
- Next.js 14+
- React 18+
- TypeScript
- TailwindCSS 3+
- shadcn/ui
- Framer Motion

### Backend
- Next.js API Routes
- TypeScript

### Banco de Dados
- Supabase (Plano Gratuito)
- PostgREST

### Autenticação
- Supabase Auth
- Google OAuth
- Email/Senha
- Recuperação de senha
- Verificação de email

### Hospedagem
- Vercel (Gratuito)

### PWA
- Progressive Web App
- Manifest completo
- Ícones e Splash Screen
- Tutorial de instalação (Android/iOS)

### IA
- OpenRouter (Modelos gratuitos)
- Assistente Financeiro

### Pagamentos
- Mercado Pago (preferencial)
- Webhooks

## Funcionalidades Principais

### Dashboard
- Controle de receitas e despesas
- Lucro líquido e fluxo de caixa
- Ticket médio e clientes ativos
- Gráficos mensais e comparativos

### Clientes
- Cadastro completo (nome, telefone, email, etc.)
- Tipo: Fixo ou Esporádico
- Replicação automática para clientes fixos

### Serviços
- Cadastro de clientes, serviços, categorias
- Controle de valores, datas e status
- Forma de pagamento e observações

### Receitas e Despesas
- CRUD completo
- Filtragem e busca
- Categorias padrão e personalizadas

### Fluxo de Caixa
- Visualização de entradas e saídas
- Saldo, lucro e acumulados

### Relatórios
- Exportação PDF, Excel, CSV
- Filtragem por cliente, categoria, mês, ano

### Propostas Comerciais
- Geração de PDF profissional
- Envio por WhatsApp e Email
- Template editável

### Administração
- Gestão de usuários
- Receita do SaaS
- Assinaturas, testes gratuitos, cancelamentos
- Dashboard administrativo

### Extras
- Agenda, Calendário, Metas
- Contas a pagar/receber
- Upload de comprovantes e fotos
- Tags e campos personalizados
- Multiempresa e backup
- API REST e internacionalização

## Arquitetura

```
LUCRIO/
├── src/
│   ├── pages/              # Rotas da aplicação
│   ├── components/        # Componentes UI
│   ├── lib/              # Funções auxiliares
│   ├── services/         # Integrações API
│   ├── types/            # Tipagens TypeScript
│   ├── hooks/            # Hooks personalizados
│   └── utils/            # Utilitários
├── supabase/              # Configuração DB
├── public/                # Assets estáticos
└── docs/                 # Documentação
```

## Estado Atual

- [x] Estrutura básica do projeto criada
- [x] Diretórios organizados
- [x] README inicial preparado

Projetos arquitetônicos, modelagem de dados e dados da base de dados que serão criados posteriormente no processo de desenvolvimento.

## Próximos Passos

1. Configurar Supabase e tabelas do banco
2. Implementar arquitetura de autenticação
3. Criar API Routes essenciais
4. Implementar componentes principais do UI
5. Adicionar sistema de tema claro/escuro
6. Configurar CI/CD e ambientes

## Requisitos

- Node.js 18+
- npm 9+

```bash
npm install
npm run dev
```