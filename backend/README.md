ecommerce-legacy-nest - Backend
Backend de e-commerce responsável pelo gerenciamento de usuários, catálogo de produtos, categorias, descontos e vendas, fornecendo uma API robusta para a loja.

🔗 Ecossistema: [README Principal](../README.md) | [Backend](../backend/)

## 1. Visão Geral e Arquitetura
Stack: Node.js v20+, NestJS v11, TypeScript v5, SQLite
Arquitetura: MVC e Modular (Controllers, Services, Repositories)
Estilo de API: REST
Autenticação/Autorização: JWT, Passport, Estratégia Local e RBAC (Gerentes/Usuários)

## 2. Módulos e Domínios
Auth e Usuários: Gerenciamento de usuários, perfis, endereços e autenticação JWT (com refresh tokens).
Catálogo e Produtos: Catálogo central, variação por cores, tamanhos, URLs de mídia e controle de quantidade (estoque).
Vendas e Descontos: Gestão de descontos e acompanhamento de histórico de vendas.
Público e Banners: Gerenciamento de banners públicos e endpoints abertos para acesso não autenticado pelo frontend.
Integrações Externas: Nodemailer (Envio de e-mails - em desenvolvimento).
Mensageria/Background Jobs: `@nestjs/schedule` utilizado para jobs internos agendados (como processamento de descontos).

## 3. Estrutura de Pastas
```markdown
backend/
├── src/
│   ├── controllers/
│   │   ├── AuthController.ts
│   │   ├── BannerController.ts
│   │   ├── MyAccountController.ts
│   │   ├── ProductController.ts
│   │   ├── PublicBannersController.ts
│   │   ├── PublicController.ts
│   │   └── UserController.ts
│   ├── infra/
│   │   └── database.ts
│   ├── models/
│   │   ├── Product.ts
│   │   ├── address.ts
│   │   ├── fallback.ts
│   │   ├── login.ts
│   │   ├── register.ts
│   │   └── user.ts
│   ├── repositories/
│   │   ├── AddressesRepository.ts
│   │   ├── CatalogRepository.ts
│   │   ├── ProductColorRepository.ts
│   │   ├── ProductRepository.ts
│   │   ├── PublicBannerRepository.ts
│   │   ├── PublicRepository.ts
│   │   ├── RefreshTokenRepository.ts
│   │   ├── SearchIndexRepository.ts
│   │   └── UserRepository.ts
│   ├── rules/
│   │   ├── JwtAuthGuard.ts
│   │   ├── JwtManagerGuard.ts
│   │   ├── JwtUserData.ts
│   │   └── LocalStrategy.ts
│   ├── services/
│   │   ├── AdressesService.ts
│   │   ├── AuthService.ts
│   │   ├── CatalogService.ts
│   │   ├── DataBaseService.ts
│   │   ├── DiscountCronTask.ts
│   │   ├── DiscountService.ts
│   │   ├── EmailService.ts
│   │   ├── ManagerService.ts
│   │   ├── ProductColorsService.ts
│   │   ├── PublicBannerService.ts
│   │   ├── PublicService.ts
│   │   ├── SearchIndexService.ts
│   │   └── UserService.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── tests/
├── .env
├── package.json
└── tsconfig.json
```

## 4. Pré-requisitos e Infraestrutura
Runtime/SDK: Node.js v20+ ou superior
Infra/DevOps: Nenhuma (execução local direta via Node)
Banco de Dados: SQLite (Embutido)
Mensageria/Cache: Cache em memória nativo e Cron jobs internos

## 5. Configuração de Variáveis de Ambiente (.env)

| Variável | Descrição | Exemplo |
|---|---|---|
| JWT_SECRET | Chave para assinatura de tokens JWT | fzJ9?ZM1A_;n5T\|]0"[oiH<x3jP\ga |
| LOW_STOCK_THRESHOLD | Limiar numérico para alerta de estoque baixo | 10 |
| SMTP_HOST | Host do servidor SMTP para envio de e-mails | smtp.hostinger.com |
| SMTP_PORT | Porta do servidor SMTP | 465 |
| SMTP_SECURE | Define se a conexão SMTP é segura | true |
| SMTP_USER | Usuário de autenticação SMTP | contato@seudominio.com.br |
| SMTP_PASS | Senha de autenticação SMTP | sua_senha_do_email_aqui |
| FRONTEND_URL | URL do frontend para permissões de CORS | http://localhost:4200 |
| NODE_ENV | Define o ambiente de execução | development |
| PORT | Porta opcional para execução da aplicação | 3000 |

## 6. Setup e Execução
```bash
# Acesse o diretório do backend
cd backend

# Instale todas as dependências do projeto
npm install

# Inicie a aplicação no modo de desenvolvimento com hot-reload
npm run start:dev
```

## 7. Documentação da API
Swagger/OpenAPI: /api (disponível apenas quando NODE_ENV não for production)
Coleção Postman/Insomnia: Não disponível no momento.
Fluxo de Auth: Header `Authorization: Bearer <token>` (após realizar o login)

## 8. Performance Optimizations

*   **Public Repository:** Added `getProductImageCounts` to handle bulk fetching of image counts.
*   **Public Service:** Removed N+1 query issue in `getBestSellers` method by using `getProductImageCounts` instead of querying the count for each item iteratively. This results in significant query reduction.

## 9. Scripts e Comandos de Rotina

| Comando | Descrição |
|---|---|
| npm run build | Gera o artefato compilado para produção. |
| npm run lint | Executa a verificação estática de código. |
| npm run format | Formata o código com base nas regras do Prettier. |
| npm run test | Roda a suíte de testes unitários. |
| npm run test:e2e | Roda testes de integração/E2E. |
| npm run start:dev | Inicia a aplicação para ambiente de desenvolvimento. |
| npm run start:prod | Roda a aplicação final compilada. |