# LUCRIO - PROMPT DE DESENVOLVIMENTO

## Propósito do Sistema

Um sistema financeiro inteligente e profissional para prestadores de serviços autônomos, MEIs e pequenos empresários. O objetivo é criar um SaaS extremamente intuitivo para usuários leigos, permitindo que qualquer profissional autônomo (eletricista, encanador, designer, fotógrafo, jardineiro, etc.) controle sua empresa em poucos minutos.

**O sistema deve ser mobile-first, funcionando perfeitamente em smartphones e igualmente perfeito em desktops.**

---

# TECNOLOGIAS UTILIZADAS

Utilizar apenas tecnologias gratuitas sempre que possível.

## Frontend

* Next.js 14+
* React 18+
* TypeScript
* TailwindCSS 3+
* shadcn/ui
* Framer Motion

## Backend

* Next.js API Routes
* TypeScript

## Banco de Dados

* Supabase (Plano Gratuito)

## Autenticação

* Supabase Auth
* Login com Google
* Login com Email/Senha
* Recuperação de senha
* Verificação de email
* Estrutura preparada para Apple Login futuramente.

## Hospedagem

* Vercel (gratuito)

## IA

* OpenRouter
* Modelos gratuitos
* Arquitetura preparada para troca futura de modelos.

---

# APLICAÇÃO VIA NAVEGADOR (PWA)

Este sistema deve ser desenvolvido como um **SaaS acessado diretamente pelo navegador**, sem necessidade de aplicativos publicados na Play Store ou App Store.

Utilizar tecnologias Progressive Web App (PWA) para oferecer experiência praticamente idêntica à de um aplicativo nativo.

## Tutorial de Instalação

No primeiro acesso de cada usuário, exibir automaticamente um tutorial interativo ensinando como adicionar o sistema à tela inicial do smartphone.

### Detectar automaticamente o sistema operacional.

#### Para Android (Chrome):
* Mostrar passo a passo para utilizar "Adicionar à tela inicial".

#### Para iPhone (Safari):
* Mostrar passo a passo para utilizar "Adicionar à Tela de Início".

## Conteúdo do Tutorial

* Barra de progresso
* Botões: Próximo, Voltar e Pular
* Ilustrações e ícones
* Nunca aparecer novamente após concluído
* Opção para reabrir em Configurações > Ajuda

### Instalação Automática

Caso o navegador suporte beforeinstallprompt, exibir automaticamente um botão "Instalar Aplicativo".

Após instalado, abrir em modo standalone.

## Requisitos PWA

* Manifest completo
* Ícones completos (app icon, mask icon, apple icon)
* Splash Screen
* Atualização automática
* Cache inteligente
* Offline para consultas básicas
* Lighthouse acima de 95 em Performance, PWA, Acessibilidade e Boas Práticas.

## Regra de Ouro

O usuário nunca deverá ser obrigado a instalar um aplicativo pela loja.

---

# FUNCIONALIDADES PRINCIPAIS

## 1. LOGIN

* Login com Google
* Login com Email/Senha
* Recuperação de senha
* Verificação de email

## 2. TESTE GRATUITO

* 7 dias automaticamente
* Bloqueio automático após expirar
* Tela de assinatura mostrando os benefícios

## 3. ASSINATURAS

Integrar:

* Mercado Pago (preferencial)
* Arquitetura preparada para Asaas, AbacatePay e Stripe.
* Webhooks
* Plano mensal
* Plano anual
* Cancelamento
* Histórico

## 4. DASHBOARD

Mostrar:

* Receita
* Despesas
* Lucro líquido
* Fluxo de caixa
* Ticket médio
* Clientes ativos
* Clientes inativos
* Serviços realizados
* Valores pendentes
* Gráficos mensais e anuais
* Comparativos

## 5. CLIENTES

Cadastro completo:

* Nome
* Telefone
* WhatsApp
* Email
* CPF/CNPJ opcional
* Endereço
* Observações

### Tipos:

* Cliente Fixo
* Cliente Esporádico

**Clientes fixos deverão ser automaticamente replicados para os meses seguintes mantendo valores, serviços e periodicidade.**

## 6. SERVIÇOS

Cadastrar:

* Cliente
* Serviço
* Categoria
* Valor
* Data
* Status
* Forma de pagamento
* Observações

## 7. RECEITAS

Cadastrar, editar, excluir, pesquisar, filtrar e duplicar.

## 8. DESPESAS

### Categorias padrão:

* Combustível
* Alimentação
* Materiais
* Ferramentas
* Internet
* Água
* Energia
* Telefone
* Marketing
* Software
* Impostos
* Transporte
* Equipamentos
* Outros

### Permitir categorias personalizadas.

## 9. FLUXO DE CAIXA

Mostrar:

* Entradas
* Saídas
* Saldo
* Lucro
* Acumulados

## 10. RELATÓRIOS

Exportar:

* PDF
* Excel
* CSV

Relatórios por:

* Cliente
* Categoria
* Mês
* Ano
* Período

## 11. PROPOSTAS COMERCIAIS

Campos:

* Logo
* Empresa
* Cliente (opcional)
* Telefone
* Email
* Data
* Validade
* Número
* Itens
* Quantidade
* Valor Unitário
* Valor Total
* Desconto
* Frete
* Observações
* Assinatura

### Funcionalidades:

* Gerar PDF profissional
* Enviar por WhatsApp e Email
* Duplicar propostas

## 12. ASSISTENTE IA FINANCEIRA

Assistente financeiro com OpenRouter.

Capaz de:

* Analisar despesas
* Dar dicas para economizar
* Analisar lucro
* Sugerir reajustes
* Mostrar clientes mais lucrativos
* Criar metas
* Explicar gráficos
* Planejamento financeiro

## 13. ADMINISTRAÇÃO

Painel administrativo mostrando:

* Usuários
* Receita do SaaS
* Assinaturas
* Testes gratuitos
* Cancelamentos
* Cupons
* Logs
* Dashboard do negócio

---

# DIFERENCIAIS ADICIONAIS

### Funcionalidades Extras:

* Agenda
* Calendário
* Metas
* Contas a pagar
* Contas a receber
* Lembretes
* Busca global
* Upload de comprovantes
* Upload de fotos
* Histórico de alterações
* Tags
* Campos personalizados
* Importação CSV
* Exportação
* Multiempresa
* Backup
* Sistema de suporte
* FAQ
* Equipe
* Controle de permissões
* API REST
* Estrutura preparada para aplicativo React Native
* Internacionalização

---

# QUALIDADE DO CÓDIGO

Todo código deverá ser:

* Limpo
* Escalável
* Bem documentado
* Sem bugs
* Sem código duplicado
* Sem TODOs
* Todos os cálculos financeiros matematicamente corretos
* Todos os fluxos testados
* Segurança implementada
* Responsividade perfeita
* Excelente UX
* Excelente desempenho

---

# PLANEJAMENTO OBRIGATÓRIO

**Antes de gerar qualquer código:**

1. Arquitetura.
2. Estrutura de pastas.
3. Banco de dados.
4. Modelagem.
5. Fluxos.
6. Pagamentos.
7. Teste gratuito.
8. Roadmap.
9. Checklist.
10. Estratégia de testes.
11. Segurança.

A implementação deve ser feita em etapas completas, integradas e funcionais, validando que nenhuma funcionalidade anterior foi quebrada.

**Somente após minha aprovação iniciar a implementação.**

---

# RESULTADO FINAL

O resultado final deverá ser um SaaS comercial de altíssimo nível, pronto para produção, altamente escalável, otimizado para smartphones, tablets e desktops, funcionando perfeitamente no navegador através de PWA e oferecendo experiência equivalente à de um aplicativo nativo.