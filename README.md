# Workflow: Backend E-commerce (Projeto Legado)

<div align="center">
  <a href="#português-br">🇧🇷 Português</a> | <a href="#english">🇺🇸 English</a>
</div>

---

<h2 id="português-br">🇧🇷 Português</h2>

## 1. Introdução

Este repositório contém o código-fonte do backend de um antigo projeto de e-commerce. O sistema **não está mais em produção** e este código foi aberto exclusivamente para fins de estudo, referência e demonstração técnica de portfólio. Não há desenvolvimento ativo ou adição de novas funcionalidades neste repositório.

## 2. Sobre o Projeto

O objetivo original do sistema era fornecer toda a base de dados, regras de negócio e infraestrutura de API para suportar um e-commerce completo (catálogo, gestão de usuários, carrinho, etc.).
O backend foi construído utilizando uma arquitetura modular baseada no padrão MVC (Model-View-Controller) orientada a serviços (Controllers, Services, Repositories), expondo uma API RESTful para o client.

## 3. Funcionalidades

O projeto possui as seguintes funcionalidades implementadas:
- **Autenticação:** Login, geração e validação de tokens JWT.
- **Gerenciamento de Usuários:** Cadastro e perfis de clientes.
- **Endereços:** Cadastro e gestão de múltiplos endereços por usuário (logística).
- **Catálogo e Produtos:** Gestão de itens de catálogo, detalhamento de produtos e busca.
- **Cores, Estoque e Imagens:** Associação de cores a produtos, controle de tamanhos e gestão de URLs de imagens.
- **Banners:** Controle de banners promocionais ativos para exibição.
- **Descontos:** Aplicação de descontos em itens específicos e controle de histórico.
- **Vendas:** Registro de vendas vinculando produto, cor, desconto e endereço.
- **Mais Vendidos:** Lógica de agregação de produtos mais vendidos por período.
- **Busca Avançada:** Utilização de FTS5 do SQLite para indexação e busca textual avançada em produtos.

## 4. Tecnologias

As principais tecnologias e bibliotecas identificadas no projeto são:
- **Linguagem:** TypeScript / Node.js
- **Framework:** NestJS
- **Banco de Dados:** SQLite (com suporte a chaves estrangeiras e FTS5 para busca)
- **Documentação de API:** Swagger (`@nestjs/swagger`)
- **Autenticação e Segurança:** JWT (`@nestjs/jwt`), Passport (`passport`, `passport-jwt`, `passport-local`), Bcrypt (`bcryptjs`)
- **Validação:** `class-validator`, `class-transformer`
- **Agendamento (Cron):** `@nestjs/schedule`
- **Upload / Arquivos:** `@nestjs/serve-static`, `multer`, `sharp`, `file-type`
- **Cache:** `@nestjs/cache-manager`, `cache-manager`
- **Ferramentas de Desenvolvimento e Testes:** Jest, Supertest, ESLint, Prettier, Biome

## 5. Estrutura do Projeto

A estrutura de diretórios foi pensada para isolar responsabilidades e facilitar a manutenção:

- `backend/src/`
  - `controllers/`: Recebem as requisições HTTP, realizam a validação de entrada (através de DTOs e Pipes) e retornam as respostas da API REST.
  - `services/`: Contêm a lógica de negócio da aplicação e orquestram a chamada aos repositórios.
  - `repositories/`: Camada de persistência. Isolam a comunicação direta com o banco de dados.
  - `models/`: Definições de DTOs e classes de estrutura de dados/validação.
  - `infra/`: Configuração de infraestrutura, incluindo o Singleton de conexão e Auto-Migration com o banco de dados (`database.ts`).
  - `rules/`: Contêm lógicas de negócio específicas e isoladas (como pipes ou validadores customizados).
- `backend/tests/`: Arquivos de testes unitários, testes de integração e benchmarks (`benchmarks/`).

## 6. Como Executar

**Aviso:** Este projeto é disponibilizado unicamente para análise de codificação. Não possui passos de execução configurados para uso, visto que não há frontend acoplado ou manutenção contínua.

## 7. API

O sistema originalmente utilizava o Swagger para documentação de endpoints acessível via rota `/api`.

## 8. Status

> **Status:** Projeto legado.
>
> Este backend foi desenvolvido para um projeto de e-commerce que não é mais utilizado. O código permanece público como referência técnica e demonstração da arquitetura e das soluções implementadas.

## 9. Licença

Este projeto está sob a licença MIT. (Veja a seção de Licença abaixo para mais detalhes).

---

<h2 id="english">🇺🇸 English</h2>

## 1. Introduction

This repository contains the backend source code for a legacy e-commerce project. The system is **no longer in production** and this code has been open-sourced exclusively for study, technical reference, and portfolio demonstration purposes. There is no active development or addition of new features in this repository.

## 2. About the Project

The original goal of the system was to provide the entire database structure, business rules, and API infrastructure to support a complete e-commerce platform (catalog, user management, shopping cart, etc.).
The backend was built using a modular MVC (Model-View-Controller) architecture oriented around services (Controllers, Services, Repositories), exposing a RESTful API for the client.

## 3. Features

The project has the following implemented features:
- **Authentication:** Login, JWT token generation and validation.
- **User Management:** Customer registration and profile management.
- **Addresses:** Registration and management of multiple addresses per user (logistics).
- **Catalog and Products:** Management of catalog items, product details, and search.
- **Colors, Stock, and Images:** Association of colors to products, size control, and image URL management.
- **Banners:** Control of active promotional banners for display.
- **Discounts:** Application of discounts to specific items and history tracking.
- **Sales:** Sales registration linking product, color, discount, and address.
- **Best Sellers:** Aggregation logic for best-selling products by period.
- **Advanced Search:** Utilization of SQLite FTS5 for advanced full-text search on products.

## 4. Technologies

The main technologies and libraries identified in the project are:
- **Language:** TypeScript / Node.js
- **Framework:** NestJS
- **Database:** SQLite (with foreign key support and FTS5 for searching)
- **API Documentation:** Swagger (`@nestjs/swagger`)
- **Authentication & Security:** JWT (`@nestjs/jwt`), Passport (`passport`, `passport-jwt`, `passport-local`), Bcrypt (`bcryptjs`)
- **Validation:** `class-validator`, `class-transformer`
- **Scheduling (Cron):** `@nestjs/schedule`
- **Uploads / Files:** `@nestjs/serve-static`, `multer`, `sharp`, `file-type`
- **Cache:** `@nestjs/cache-manager`, `cache-manager`
- **Development & Testing Tools:** Jest, Supertest, ESLint, Prettier, Biome

## 5. Project Structure

The directory structure was designed to isolate responsibilities and facilitate maintenance:

- `backend/src/`
  - `controllers/`: Receive HTTP requests, perform input validation (via DTOs and Pipes), and return REST API responses.
  - `services/`: Contain application business logic and orchestrate repository calls.
  - `repositories/`: Persistence layer. Isolate direct database communication.
  - `models/`: DTO definitions and data structure/validation classes.
  - `infra/`: Infrastructure configuration, including database connection Singleton and Auto-Migration (`database.ts`).
  - `rules/`: Contain isolated specific business logic (like pipes or custom validators).
- `backend/tests/`: Unit test files, integration tests, and benchmarks (`benchmarks/`).

## 6. How to Run

**Note:** This project is provided solely for coding analysis. There are no execution steps configured for use, as there is no coupled frontend or ongoing maintenance.

## 7. API

The system originally utilized Swagger for endpoint documentation accessible via the `/api` route.

## 8. Status

> **Status:** Legacy project.
>
> This backend was developed for an e-commerce project that is no longer used. The code remains public as a technical reference and demonstration of the architecture and implemented solutions.

## 9. License

This project is licensed under the MIT License.

---

## License (MIT)

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
