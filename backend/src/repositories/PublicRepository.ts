import { Injectable } from "@nestjs/common";
import { DataBaseService } from "../services/DataBaseService";

/**
 * Repositório responsável pela persistência e consulta de banners no banco de dados.
 */
@Injectable()
export class PublicRepository {
	constructor(private readonly dataBaseService: DataBaseService) {}

	public async getDatabase() {
		return await this.dataBaseService.getDatabase();
	}

	public async getBannersByType(type: string): Promise<any[]> {
		const db = await this.getDatabase();
		return await db.all(
			"SELECT * FROM banners WHERE type = ? ORDER BY order_index ASC",
			[type],
		);
	}

	public async getAllBannersByType(type: string): Promise<any[]> {
		const db = await this.getDatabase();
		return await db.all(
			"SELECT * FROM banners WHERE type = ? ORDER BY order_index ASC",
			[type],
		);
	}

	public async saveBanner(banner: {
		type: string;
		image_url: string;
		link_url: string;
		order_index: number;
	}): Promise<void> {
		const db = await this.getDatabase();
		await db.run(
			`INSERT INTO banners (type, image_url, link_url, order_index) 
       VALUES (?, ?, ?, ?)`,
			[banner.type, banner.image_url, banner.link_url, banner.order_index],
		);
	}

	public async saveBanners(banners: {
		type: string;
		image_url: string;
		link_url: string;
		order_index: number;
	}[]): Promise<void> {
		if (banners.length === 0) return;
		const db = await this.getDatabase();
		const placeholders = banners.map(() => "(?, ?, ?, ?)").join(", ");
		const values = banners.flatMap(b => [b.type, b.image_url, b.link_url, b.order_index]);
		await db.run(
			`INSERT INTO banners (type, image_url, link_url, order_index) VALUES ${placeholders}`,
			values
		);
	}

	public async deleteBanner(id: number): Promise<any> {
		const db = await this.getDatabase();
		const banner = await db.get("SELECT image_url FROM banners WHERE id = ?", [
			id,
		]);
		await db.run("DELETE FROM banners WHERE id = ?", [id]);
		return banner;
	}

	public async updateBannerLink(id: number, linkUrl: string): Promise<void> {
		const db = await this.getDatabase();
		await db.run("UPDATE banners SET link_url = ? WHERE id = ?", [linkUrl, id]);
	}

	public async updateBannerOrder(
		id: number,
		orderIndex: number,
	): Promise<void> {
		const db = await this.getDatabase();
		await db.run("UPDATE banners SET order_index = ? WHERE id = ?", [
			orderIndex,
			id,
		]);
	}

	public async getMaxOrder(type: string): Promise<number> {
		const db = await this.getDatabase();
		const result = await db.get(
			"SELECT MAX(order_index) as maxOrder FROM banners WHERE type = ?",
			[type],
		);
		return result?.maxOrder || 0;
	}

	/**
	 * Desloca os banners existentes para cima para abrir espaço para novos registros.
	 *
	 * @param type O contexto/tipo do banner.
	 * @param startOrder A posição a partir da qual os banners devem ser movidos.
	 * @param shiftAmount Quantas posições eles devem "pular" (geralmente a quantidade de novos banners).
	 */
	public async shiftOrderIndices(
		type: string,
		startOrder: number,
		shiftAmount: number,
	): Promise<void> {
		const db = await this.getDatabase();
		await db.run(
			`UPDATE banners SET order_index = order_index + ? WHERE type = ? AND order_index >= ?`,
			[shiftAmount, type, startOrder],
		);
	}

	/**
	 * Busca produtos vinculados a uma categoria específica com suporte a paginação.
	 */
	public async getProductsByCategory(
		categoryType: string,
		limit: number,
		offset: number,
		colors: string[] = [],
		sizes: string[] = [],
		minPrice: number | null = null,
		maxPrice: number | null = null,
	): Promise<any[]> {
		const db = await this.getDatabase();

		let colorFilter = "";
		let sizeFilter = "";
		let priceFilter = "";
		const params: any[] = [categoryType];

		if (colors.length > 0) {
			const placeholders = colors.map(() => "?").join(",");
			colorFilter = `AND EXISTS (
        SELECT 1 FROM product_colors pc_f 
        JOIN colors col_f ON pc_f.color_id = col_f.id 
        WHERE pc_f.product_id = p.id AND col_f.color IN (${placeholders})
      )`;
			params.push(...colors);
		}

		if (sizes.length > 0) {
			const placeholders = sizes.map(() => "?").join(",");
			sizeFilter = `AND EXISTS (
        SELECT 1 FROM product_colors pc_s 
        WHERE pc_s.product_id = p.id AND pc_s.tamanho IN (${placeholders})
      )`;
			params.push(...sizes);
		}

		if (minPrice !== null) {
			priceFilter += " AND p.preco >= ?";
			params.push(minPrice);
		}

		if (maxPrice !== null) {
			priceFilter += " AND p.preco <= ?";
			params.push(maxPrice);
		}

		params.push(limit, offset);

		const query = `SELECT
        p.id,
        p.nome AS name,
        p.preco AS price,
        p.descricao,
        c.item AS category, -- Adiciona o nome da categoria ao resultado
        p.categoria AS categoryId, -- Mantém o ID da categoria, se necessário
        (SELECT url FROM product_urls WHERE product_id = p.id ORDER BY id LIMIT 1) AS imageUrl,
        (SELECT GROUP_CONCAT(DISTINCT col.color) 
         FROM product_colors pc 
         INNER JOIN colors col ON pc.color_id = col.id 
         WHERE pc.product_id = p.id) AS availableColors,
        (SELECT GROUP_CONCAT(DISTINCT pc_s.tamanho) 
         FROM product_colors pc_s 
         WHERE pc_s.product_id = p.id) AS availableSizes
       FROM products p
       INNER JOIN catalog c ON p.categoria = c.id
       WHERE c.item = ? ${colorFilter} ${sizeFilter} ${priceFilter}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`;

		return await db.all(query, params);
	}

	/**
	 * Conta o total de produtos em uma categoria para cálculo de páginas.
	 */
	public async countProductsByCategory(
		categoryType: string,
		colors: string[] = [],
		sizes: string[] = [],
		minPrice: number | null = null,
		maxPrice: number | null = null,
	): Promise<number> {
		const db = await this.getDatabase();

		let colorFilter = "";
		let sizeFilter = "";
		let priceFilter = "";
		const params: any[] = [categoryType];

		if (colors.length > 0) {
			const placeholders = colors.map(() => "?").join(",");
			colorFilter = `AND EXISTS (
        SELECT 1 FROM product_colors pc_f 
        JOIN colors col_f ON pc_f.color_id = col_f.id 
        WHERE pc_f.product_id = p.id AND col_f.color IN (${placeholders})
      )`;
			params.push(...colors);
		}

		if (sizes.length > 0) {
			const placeholders = sizes.map(() => "?").join(",");
			sizeFilter = `AND EXISTS (
        SELECT 1 FROM product_colors pc_s 
        WHERE pc_s.product_id = p.id AND pc_s.tamanho IN (${placeholders})
      )`;
			params.push(...sizes);
		}

		if (minPrice !== null) {
			priceFilter += " AND p.preco >= ?";
			params.push(minPrice);
		}

		if (maxPrice !== null) {
			priceFilter += " AND p.preco <= ?";
			params.push(maxPrice);
		}

		const query = `SELECT COUNT(*) as total 
       FROM products p
       INNER JOIN catalog c ON p.categoria = c.id
       WHERE c.item = ? ${colorFilter} ${sizeFilter} ${priceFilter}`;

		const result = await db.get(query, params);
		return result?.total || 0;
	}

	/**
	 * Obtém as cores disponíveis em uma categoria e a contagem de produtos para cada uma.
	 */
	public async getCategoryColors(categoryType: string): Promise<any[]> {
		const db = await this.getDatabase();
		return await db.all(
			`SELECT 
        col.name, 
        col.color as hex, 
        COUNT(DISTINCT p.id) as count
       FROM catalog c
       JOIN products p ON p.categoria = c.id
       JOIN product_colors pc ON pc.product_id = p.id
       JOIN colors col ON col.id = pc.color_id
       WHERE c.item = ?
       GROUP BY col.id`,
			[categoryType],
		);
	}

	/**
	 * Obtém os tamanhos disponíveis em uma categoria e a contagem de produtos para cada um.
	 */
	public async getCategorySizes(categoryType: string): Promise<any[]> {
		const db = await this.getDatabase();
		return await db.all(
			`SELECT 
        pc.tamanho as name, 
        COUNT(DISTINCT p.id) as count
       FROM catalog c
       JOIN products p ON p.categoria = c.id
       JOIN product_colors pc ON pc.product_id = p.id
       WHERE c.item = ?
       GROUP BY pc.tamanho`,
			[categoryType],
		);
	}

	/**
	 * Consulta produtos com níveis de estoque iguais ou inferiores ao limite definido.
	 *
	 * @param threshold - Limite máximo de quantidade para filtragem de estoque baixo.
	 * @param limit - Quantidade máxima de registros para retorno na consulta.
	 * @returns Promessa contendo array de objetos com dados do produto, variante e mídia.
	 */
	public async getLowStockProducts(
		threshold: number,
		limit: number,
	): Promise<any[]> {
		const db = await this.getDatabase();

		const query = `
      SELECT 
        p.id as productId,
        p.nome as name,
        p.preco as price,
        c.item as category,
        p.categoria as categoryId,
        pc.quantity,
        pc.tamanho as size,
        col.name as colorName,
        (SELECT url FROM product_urls WHERE product_id = p.id ORDER BY id LIMIT 1) AS imageUrl
      FROM product_colors pc
      INNER JOIN products p ON pc.product_id = p.id
      INNER JOIN colors col ON pc.color_id = col.id
      INNER JOIN catalog c ON p.categoria = c.id
      WHERE pc.quantity <= ?
      AND p.created_at <= datetime('now', '-60 days')
      ORDER BY pc.quantity ASC
      LIMIT ?`;

		return await db.all(query, [threshold, limit]);
	}

	/**
	 * Obtém os produtos mais vendidos do mês vigente, limitando a 20 resultados.
	 *
	 * @returns Promessa contendo um array de objetos com dados dos produtos mais vendidos, incluindo ID, nome, preço, quantidade vendida e URL da imagem.
	 */
	public async getBestSellers(): Promise<any[]> {
		const db = await this.getDatabase();

		const query = `
      SELECT 
        p.id AS productId,
        p.nome AS name,
        p.preco AS price,
        c.item AS category,
        p.categoria AS categoryId,
        bs.quantidade_vendida AS quantity,
        (SELECT url FROM product_urls pu WHERE pu.product_id = p.id LIMIT 1) AS imageUrl
      FROM best_sellers bs
      INNER JOIN products p ON bs.product_id = p.id
      INNER JOIN catalog c ON p.categoria = c.id
      WHERE bs.ano_mes = (SELECT MAX(ano_mes) FROM best_sellers)
      ORDER BY bs.quantidade_vendida DESC
      LIMIT 20
    `;

		return await db.all(query);
	}

	/**
	 * Obtém a contagem de imagens associadas a um produto específico.
	 *
	 * @param productId - O ID do produto.
	 * @returns Promessa contendo o número total de imagens para o produto.
	 */
	public async getProductImageCount(productId: number): Promise<number> {
		const db = await this.getDatabase();
		const result = await db.get(
			"SELECT COUNT(*) as total FROM product_urls WHERE product_id = ?",
			[productId],
		);
		return result?.total || 0;
	}

	/**
	 * Obtém uma lista de produtos de fallback com imagens, ordenados aleatoriamente.
	 * Utilizado para preencher vitrines ou seções quando não há produtos específicos disponíveis.
	 *
	 * @param limit - O número máximo de produtos de fallback a serem retornados.
	 * @returns Promessa contendo um array de objetos com dados do produto (ID, nome, preço, quantidade 0, URL da imagem).
	 */
	public async getFallbackProducts(limit: number): Promise<any[]> {
		const db = await this.getDatabase();
		const query = `
      SELECT 
        p.id AS productId,
        p.nome AS name,
        p.preco AS price,
        c.item AS category,
        p.categoria AS categoryId,
        (SELECT SUM(pc.quantity) FROM product_colors pc WHERE pc.product_id = p.id) AS quantity,
        (SELECT url FROM product_urls pu WHERE pu.product_id = p.id LIMIT 1) AS imageUrl
      FROM products p
      INNER JOIN catalog c ON p.categoria = c.id
      WHERE (SELECT COUNT(*) FROM product_urls pu WHERE pu.product_id = p.id) >= 1
      ORDER BY RANDOM()
      LIMIT ?
    `;
		return await db.all(query, [limit]);
	}

	/**
	 * Consulta os produtos mais recentes cadastrados que possuem pelo menos uma imagem associada.
	 *
	 * @param limit - Quantidade máxima de registros para retorno na consulta.
	 * @returns Promessa contendo array de objetos com dados básicos do produto e sua imagem principal.
	 */
	public async getNewArrivals(limit: number): Promise<any[]> {
		const db = await this.getDatabase();
		const query = `
      SELECT 
        p.id AS productId,
        p.nome AS name,
        p.preco AS price,
        c.item AS category,
        p.categoria AS categoryId,
        (SELECT SUM(pc.quantity) FROM product_colors pc WHERE pc.product_id = p.id) AS quantity,
        (SELECT url FROM product_urls pu WHERE pu.product_id = p.id LIMIT 1) AS imageUrl
      FROM products p
      INNER JOIN catalog c ON p.categoria = c.id
      WHERE (SELECT COUNT(*) FROM product_urls pu WHERE pu.product_id = p.id) >= 1
      ORDER BY p.id DESC
      LIMIT ?
    `;
		return await db.all(query, [limit]);
	}

	public async getPromotions(limit: number): Promise<any[]> {
		const db = await this.getDatabase();
		const query = `
      SELECT
        p.id AS productId,
        p.nome AS name,
        c.item AS category,
        p.categoria AS categoryId,
        d.original_price AS originalPrice,
        d.discount_price AS price,
        (SELECT url FROM product_urls pu WHERE pu.product_id = p.id LIMIT 1) AS imageUrl
      FROM discounts d
      INNER JOIN products p ON d.product_id = p.id
      INNER JOIN catalog c ON p.categoria = c.id
      WHERE (SELECT COUNT(*) FROM product_urls pu WHERE pu.product_id = p.id) >= 1
      LIMIT ?
    `;
		return await db.all(query, [limit]);
	}

	/**
	 * Obtém os detalhes completos de um produto pelo identificador.
	 *
	 * @description
	 * Realiza a consulta das informações principais do produto, incluindo
	 * nome, preço, descrição e categoria associada. Além dos dados básicos,
	 * também recupera as mídias cadastradas, as variações disponíveis
	 * (cores, tamanhos e quantidades) e eventuais informações de desconto.
	 *
	 * Os dados são consolidados em um único objeto, facilitando sua utilização
	 * em fluxos de edição, exibição detalhada do produto ou integração com
	 * outras funcionalidades do sistema.
	 *
	 * Caso o produto não seja encontrado, retorna `null`.
	 *
	 * @param id Identificador do produto a ser consultado.
	 * @returns Promessa contendo os dados completos do produto ou `null` caso não exista.
	 */
	public async getProductById(id: number): Promise<any> {
		const db = await this.getDatabase();

		const product = await db.get(
			`SELECT p.id, p.nome AS name, p.preco AS price, p.descricao, c.item AS category
       FROM products p
       INNER JOIN catalog c ON p.categoria = c.id
       WHERE p.id = ?`,
			[id],
		);

		if (!product) {
			return null;
		}

		const images = await db.all(
			`SELECT url FROM product_urls WHERE product_id = ? ORDER BY id`,
			[id],
		);

		const variants = await db.all(
			`SELECT pc.tamanho AS size, pc.quantity, col.id AS colorId, col.name AS colorName, col.color AS colorHex
       FROM product_colors pc
       INNER JOIN colors col ON pc.color_id = col.id
       WHERE pc.product_id = ?`,
			[id],
		);

		const discount = await db.get(
			`SELECT original_price AS originalPrice, discount_price AS discountPrice 
       FROM discounts WHERE product_id = ? LIMIT 1`,
			[id],
		);

		return {
			...product,
			photos: images.map((img: any) => img.url),
			variants,
			discount: discount || null,
		};
	}
}
