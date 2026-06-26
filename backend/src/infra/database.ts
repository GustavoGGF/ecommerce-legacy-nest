import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

/**
 * Gerenciador de conexão Singleton para o banco de dados SQLite.
 *
 * @description
 * Esta classe centraliza o acesso ao banco de dados utilizando o padrão Singleton,
 * garantindo que apenas uma instância de conexão (`Database`) exista durante o
 * ciclo de vida da aplicação. Ao ser instanciada pela primeira vez, ela:
 * 1. Estabelece conexão com o arquivo local `database.sqlite`.
 * 2. Ativa o suporte a chaves estrangeiras (`PRAGMA foreign_keys = ON`).
 * 3. Executa a migração inicial do esquema (DDL).
 *
 * @category Infrastructure
 */
export class DatabaseConnection {
	private static instance: Database;

	private constructor() {}

	/**
	 * Recupera a instância ativa do banco de dados ou cria uma nova se inexistente.
	 *
	 * @returns {Promise<Database>} A instância da conexão pronta para uso.
	 * @example
	 * const db = await DatabaseConnection.getInstance();
	 */
	public static async getInstance(): Promise<Database> {
		if (!DatabaseConnection.instance) {
			// Abre a conexão com o arquivo
			DatabaseConnection.instance = await open({
				filename: "./database.sqlite",
				driver: sqlite3.Database,
			});

			await DatabaseConnection.instance.exec("PRAGMA foreign_keys = ON");

			await DatabaseConnection.initializeSchema();
		}
		return DatabaseConnection.instance;
	}

	/**
	 * Define e inicializa a estrutura de tabelas do sistema (Auto-Migration).
	 *
	 * @description
	 * Executa comandos `CREATE TABLE IF NOT EXISTS` para as entidades:
	 * - `users` & `addresses`: Gestão de clientes e logística.
	 * - `catalog` & `products`: Núcleo do e-commerce.
	 * - `colors`, `product_colors` & `product_urls`: Atributos e mídia dos produtos.
	 *
	 * @private
	 */
	private static async initializeSchema() {
		const schema = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mail TEXT UNIQUE NOT NULL,
        pass TEXT NOT NULL,
        username TEXT NOT NULL,
        phone TEXT,
        profile TEXT
      );
    
      CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label VARCHAR(50) NOT NULL,
      zip_code VARCHAR(8) NOT NULL,
      street VARCHAR(255) NOT NULL,
      number VARCHAR(20) NOT NULL,
      complement VARCHAR(100) NULL,
      neighborhood VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(2) NOT NULL,
      is_main BOOLEAN NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item VARCHAR(50) NOT NULL,
      url TEXT CHECK(url <> '')
      );
    
      CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      preco DECIMAL(10, 2) NOT NULL,
      categoria INTEGER NOT NULL,
      descricao TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria) REFERENCES catalog (id)
      );

      CREATE TABLE IF NOT EXISTS colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(50) NOT NULL,
      color VARCHAR(20) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS product_colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      color_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      tamanho TEXT NOT NULL, 
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES colors (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS product_urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        image_url TEXT NOT NULL,
        link_url TEXT,
        order_index INTEGER DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS discounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_color_id INTEGER NOT NULL,
        original_price DECIMAL(10, 2) NOT NULL,
        discount_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        FOREIGN KEY (product_color_id) REFERENCES product_colors (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS old_discounts (
        product_id INTEGER NOT NULL,
        data_desconto DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_color_id INTEGER NOT NULL,
        discount_id INTEGER,
        address_id INTEGER NOT NULL,
        product_url_id INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (product_color_id) REFERENCES product_colors (id),
        FOREIGN KEY (discount_id) REFERENCES discounts (id),
        FOREIGN KEY (address_id) REFERENCES addresses (id),
        FOREIGN KEY (product_url_id) REFERENCES product_urls (id)
      );

      CREATE TABLE IF NOT EXISTS best_sellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        ano_mes INTEGER NOT NULL,
        quantidade_vendida INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS products_search_index USING fts5(
        product_color_id UNINDEXED,
        product_id UNINDEXED,
        price UNINDEXED,
        nome,
        categoria,
        cor_nome,
        descricao,
        tamanho UNINDEXED,
        tokenize = 'unicode61'      
      );

      CREATE INDEX IF NOT EXISTS idx_best_sellers_product_id ON best_sellers (product_id);
      CREATE INDEX IF NOT EXISTS idx_best_sellers_ano_mes ON best_sellers (ano_mes);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER  NOT NULL,
        token_hash TEXT     NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
      `;

		await DatabaseConnection.instance.exec(schema);

		// Migração manual: Adiciona a coluna created_at caso a tabela products já existisse sem ela
		try {
			await DatabaseConnection.instance.exec(
				"ALTER TABLE products ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
			);
		} catch (e) {
			// Se a coluna já existir, o SQLite lançará um erro que podemos ignorar
		}

		// Migração manual: cria tabela refresh_tokens caso a aplicação já existisse sem ela
		try {
			await DatabaseConnection.instance.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id    INTEGER  NOT NULL,
          token_hash TEXT     NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
      `);
		} catch (e) {
			// Tabela ou índice já existem — ignorar
		}
	}
}
