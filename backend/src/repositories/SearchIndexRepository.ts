import { Injectable, Logger } from "@nestjs/common";
import { DatabaseConnection } from "../infra/database";
import { Database } from "sqlite";

@Injectable()
export class SearchIndexRepository {
	private readonly logger = new Logger(SearchIndexRepository.name);

	private async getDatabase(): Promise<Database> {
		return await DatabaseConnection.getInstance();
	}

	/**
	 * Obtém os detalhes de uma variante de produto para indexação.
	 */
	public async getVariantDetailsForIndex(
		productColorId: number,
	): Promise<any | null> {
		const db = await this.getDatabase();
		const sql = `
      SELECT 
        pc.id AS product_color_id,
        p.id AS product_id,
        p.preco AS price,
        p.nome AS nome,
        cat.item AS categoria,
        c.name AS cor_nome,
        p.descricao AS descricao,
        pc.tamanho AS tamanho
      FROM product_colors pc
      JOIN products p ON pc.product_id = p.id
      JOIN catalog cat ON p.categoria = cat.id
      JOIN colors c ON pc.color_id = c.id
      WHERE pc.id = ?;
    `;
		return await db.get(sql, [productColorId]);
	}

	/**
	 * Insere ou atualiza um registro no índice de busca FTS5.
	 */
	public async upsertSearchIndex(data: any): Promise<void> {
		const db = await this.getDatabase();

		await db.run(
			"DELETE FROM products_search_index WHERE product_color_id = ?",
			[data.product_color_id],
		);

		await db.run(
			`INSERT INTO products_search_index (product_color_id, product_id, price, nome, categoria, cor_nome, descricao, tamanho)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				data.product_color_id,
				data.product_id,
				data.price,
				data.nome,
				data.categoria,
				data.cor_nome,
				data.descricao,
				data.tamanho,
			],
		);
	}

	/**
	 * Realiza uma busca no índice FTS5, formatando o termo para busca por prefixo.
	 */
	public async searchProducts(query: string): Promise<any[]> {
		const db = await this.getDatabase();

		// Centralizamos aqui a regra de formatação da query MATCH do FTS5
		const formattedQuery = query
			.trim()
			.split(/\s+/)
			.map((word) => `${word}*`)
			.join(" ");

		const sql = `
      SELECT 
        product_color_id as id,
        product_id,
        nome,
        price as preco,
        categoria,
        cor_nome,
        descricao,
        tamanho,
        (SELECT url FROM product_urls WHERE product_id = psi.product_id LIMIT 1) as image_url
      FROM products_search_index psi
      WHERE products_search_index MATCH ?
      ORDER BY rank
      LIMIT 50;
    `;
		return await db.all(sql, [formattedQuery]);
	}
}
