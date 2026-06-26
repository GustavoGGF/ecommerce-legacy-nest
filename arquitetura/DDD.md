# Especificação de Domínio (DDD) - ecommerce-legacy-nest

## 1. Linguagem Ubíqua (Glossário)
* **Usuário / User:** Ator que interage com o sistema (pode ter perfil de Gerente ou Cliente).
* **Catálogo:** Coleção central de todos os produtos disponíveis na loja.
* **Produto / Product:** Item vendido no e-commerce, com controle de estoque (quantidade) e URLs de mídia.
* **Variação por Cores (ProductColor):** Características específicas de um produto que define suas opções de cor e tamanho.
* **Desconto / Discount:** Redução de preço aplicada aos produtos, muitas vezes processada em background.
* **Estoque:** Controle de quantidade disponível de um produto.
* **Banner Público (PublicBanner):** Imagens e banners promocionais exibidos abertamente para acesso não autenticado pelo frontend.
* **Endereço (Address):** Localização vinculada a um usuário para fins de perfil e entrega.

## 2. Visão Geral do Domínio e Subdomínios
* **Core Domain:** Catálogo de Produtos e Vendas (Gerenciamento do coração do e-commerce: produtos, variações, controle de estoque).
* **Supporting Domain:** Gestão de Descontos e Banners Públicos (Apoio às vendas e vitrine da loja).
* **Generic Domain:** Autenticação e Usuários, Notificações por E-mail (Infraestrutura de suporte transversal de acesso e comunicação).

## 3. Contextos Delimitados (Bounded Contexts)
### 3.1. Contexto de Autenticação e Usuários
* **Responsabilidade:** Gerenciamento de usuários, perfis, endereços, autenticação JWT (com refresh tokens) e controle de acesso baseado em funções (RBAC).
* **Agregados e Entidades:** `User`, `Address`.
* **Objetos de Valor (Value Objects):** `Login`, `Register`, `JwtUserData`.

### 3.2. Contexto de Catálogo e Produtos
* **Responsabilidade:** Catálogo central, variação por cores, tamanhos, URLs de mídia, controle de quantidade (estoque) e indexação de buscas.
* **Agregados e Entidades:** `Product`, `ProductColor`.
* **Objetos de Valor (Value Objects):** `SearchIndex`.

### 3.3. Contexto de Vendas e Descontos
* **Responsabilidade:** Gestão de descontos através de rotinas automáticas (cron jobs) e acompanhamento de histórico de vendas.
* **Agregados e Entidades:** Entidades gerenciadas via `DiscountCronTask` e Serviços.
* **Objetos de Valor (Value Objects):** Regras de Desconto.

### 3.4. Contexto Público e Banners
* **Responsabilidade:** Gerenciamento de banners públicos e endpoints abertos para acesso não autenticado pelo frontend.
* **Agregados e Entidades:** `PublicBanner`.
* **Objetos de Valor (Value Objects):** Configurações Públicas (`Public`).

## 4. Componentes de Infraestrutura e Serviços
*Mapeamento técnico de bancos de dados, mensageria e serviços vinculados aos contextos.*
* **Componente:** Serviço de Banco de Dados SQLite (Embutido)
    * **Contexto Vinculado:** Todos os Contextos (Usuários, Catálogo, Descontos, Banners)
    * **Entidades Persistidas:** `User`, `Address`, `Product`, `ProductColor`, `PublicBanner`, `RefreshToken`, etc.
* **Componente:** Agendador de Tarefas Interno (`@nestjs/schedule`)
    * **Contexto Vinculado:** Contexto de Vendas e Descontos
    * **Entidades Persistidas:** Não aplica diretamente (modifica entidades do Catálogo).
* **Componente:** Serviço de E-mail (Nodemailer / SMTP)
    * **Contexto Vinculado:** Contexto Genérico (Comunicações)
    * **Entidades Persistidas:** Não aplica (integração externa).
* **Componente:** Autenticação e Sessão (Passport e JWT)
    * **Contexto Vinculado:** Contexto de Autenticação e Usuários
    * **Entidades Persistidas:** `RefreshToken`.

## 5. Fluxos de Aplicação (Engineers/Agent View)
*Mapeamento sequencial estrito para o gerador de diagramas de fluxo.*

### Fluxo: Autenticação de Usuário (Login)
1. **[Usuário]** dispara a ação/comando enviando credenciais (Login).
2. **[Contexto de Autenticação / AuthService]** processa a informação e verifica via Estratégia Local (LocalStrategy).
3. **[Banco de Dados SQLite]** persiste ou recupera os dados do usuário (`UserRepository`) e gera/valida o Token.
4. **[Evento]** Retorna o Token JWT de acesso e refresh token.

### Fluxo: Inclusão ou Consulta de Produto no Catálogo
1. **[Gerente/Usuário]** dispara a ação/comando para adicionar ou visualizar produto.
2. **[Contexto de Catálogo e Produtos / ProductService]** processa a informação, incluindo controle de estoque e mídia.
3. **[Banco de Dados SQLite]** persiste ou recupera os dados (`ProductRepository`, `ProductColorRepository`, `CatalogRepository`).

### Fluxo: Processamento Automático de Descontos
1. **[@nestjs/schedule (Cron Job)]** dispara a ação/comando periodicamente.
2. **[Contexto de Vendas e Descontos / DiscountCronTask]** processa a informação das regras de desconto aplicáveis.
3. **[Banco de Dados SQLite]** persiste ou recupera os dados de catálogo atualizados (`CatalogRepository` ou serviço relacionado).
