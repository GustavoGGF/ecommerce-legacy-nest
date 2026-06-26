---

# ecommerce-legacy-nest - Ecossistema

Backend legado de um e-commerce responsável pelo gerenciamento de usuários, catálogo de produtos, categorias, descontos e vendas, fornecendo uma API robusta para a loja. O domínio core foca no Catálogo de Produtos e Vendas (com controle de estoque e mídia), suportado por gestão de Descontos, Banners Públicos e Autenticação.

🔗 **Sub-projetos:** [Backend README](./backend/README.md)

## 1. Visão Geral e Arquitetura do Ecossistema
- **Propósito do Produto:** Gerenciamento do coração do e-commerce (produtos, variações, controle de estoque) e operações transversais (autenticação, descontos, vitrine pública).
- **Modelo de Arquitetura:** Arquitetura MVC e Modular focada exclusivamente no backend.
- **Stack Global:**
  - Backend: Node.js v20+, NestJS v11, TypeScript v5.
  - Infraestrutura: Banco de Dados SQLite (embutido). Sem dependências externas de infraestrutura.
- **Hospedagem/Cloud:** Não aplicável no momento (projeto legado).

## 2. Topologia e Comunicação entre Serviços
- **Frontend ↔ Backend:** API REST com fluxo de autenticação por cabeçalho `Authorization: Bearer <token>`. O frontend (não presente neste repo) aponta tipicamente para a porta do backend.
- **Backend ↔ Banco de Dados:** SQLite embutido, interagindo através de repositories do ecossistema.
- **Mensageria/Eventos:** Cache em memória nativo e Cron jobs internos (utilizando `@nestjs/schedule` para processos de desconto e automações).
- **Serviços Externos:** Integração de envio de e-mails via SMTP/Nodemailer.

## 3. Estrutura do Repositório (Raiz)
```text
.
├── arquitetura/        # Documentação complementar (DDD e diagramas)
├── backend/            # API Principal (Código fonte legado)
└── README.md           # Este arquivo
```

## 4. Pré-requisitos Globais
Runtime: Node.js v20+ ou superior
Banco de Dados/Infra Local: Nenhuma (SQLite já embutido no projeto Node)
Gerenciador de Pacotes: npm

## 5. Setup e Execução Global

**Clonagem e Instalação**
```bash
cd backend
npm install
```

**Subindo o Ecossistema (Dev)**
```bash
npm run start:dev
```

**Acesso Local**
- Backend (API): http://localhost:[PORTA_BACKEND_CONF_ENV] (geralmente porta 3000)
- Swagger/Docs: http://localhost:[PORTA_BACKEND_CONF_ENV]/api (disponível quando não for ambiente de produção)

## 6. CI/CD, Deploy e Ambientes
- **Ambientes:** Não especificado / Não aplicável no momento.
- **Pipeline de CI:** Não aplicável no momento.
- **Estratégia de Deploy:** Não aplicável no momento.

## 7. Padrões Globais e Contribuição
- **Padrão de Código:** Prettier, ESLint, verificação estática.
- **Documentação de Decisões:** Link para a pasta [arquitetura/](./arquitetura/) contendo DDD.
