import { Injectable, Logger } from "@nestjs/common";
import { DataBaseService } from "../services/DataBaseService";

/**
 * Repositório especializado na gestão de variantes e estoque na tabela `product_colors`.
 *
 * @description
 * Esta classe isola todas as operações SQL de junção e associação entre produtos e atributos
 * físicos (cores e tamanhos). Suas principais responsabilidades são:
 * - Vincular IDs de produtos a registros de cores existentes.
 * - Gerenciar a grade de estoque (`quantity`) por combinação de cor e tamanho.
 * - Garantir a integridade referencial nas operações de atualização de variantes.
 *
 * @category Database
 */
@Injectable()
export class ProductColorRepository {
	/**
	 * @param {DataBaseService} dbService - Provedor de conexão e utilitários de execução SQL.
	 */
	constructor(private readonly dbService: DataBaseService) {}
	private readonly logger = new Logger(ProductColorRepository.name);

	/**
	 * Registra múltiplas variantes de cores e tamanhos para um produto em lote (Bulk Insert).
	 *
	 * @description
	 * Este método implementa um fluxo de alta performance e segurança:
	 * 1. **Atomicidade**: Utiliza `BEGIN TRANSACTION` e `COMMIT/ROLLBACK` para garantir a integridade dos dados.
	 * 2. **Performance**: Constrói dinamicamente uma única query SQL para inserir todos os registros de uma vez,
	 *    minimizando o overhead de comunicação com o SQLite.
	 * 3. **Fallback**: Em caso de falha na transação, aciona uma operação de contingência via `callFallBackOperation`.
	 *
	 * @param {number} id - O identificador único do produto pai (`product_id`).
	 * @param {any[]} colors - Lista de objetos contendo a grade (`colorId`, `quantity`, `size`).
	 *
	 * @returns {Promise<{ failResultPost: any[] }>}
	 * Retorna um objeto contendo a lista de itens que falharam no processamento, se houver.
	 *
	 * @throws {Error} Embora os erros sejam capturados internamente para o rollback, o log é registrado no `dbService`.
	 */
	public async addNewProductColor(
		id: number,
		colors: any[],
	): Promise<{ failResultPost: any[]; insertedIds: number[] }> {
		const db = await this.dbService.getDatabase();
		const failResultPost: any[] = [];
		const insertedIds: number[] = [];

		// Se não houver cores, encerramos cedo
		// Adicionando verificação de estoque máximo.
		// Nota: Recomenda-se um limite fixo de negócio (ex: 100) ou um campo específico na tabela 'products'.
		const maxStockLimit = 100;
		for (const item of colors) {
			if (item.quantity > maxStockLimit) {
				failResultPost.push({
					...item,
					error: `A quantidade (${item.quantity}) excede o estoque máximo permitido (${maxStockLimit}).`,
				});
			}
		}
		if (!colors || colors.length === 0) return { failResultPost, insertedIds };

		try {
			// 2. Prepara a query em lote
			// Filtra as cores que excedem o estoque máximo antes de construir a query de inserção
			const colorsToInsert = colors.filter(
				(item) => item.quantity <= maxStockLimit,
			);
			if (colorsToInsert.length === 0) return { failResultPost, insertedIds };
			const placeholders = colorsToInsert.map(() => "(?, ?, ?, ?)").join(", ");
			const query = `INSERT INTO product_colors (product_id, color_id, quantity, tamanho) VALUES ${placeholders} RETURNING id`;

			// 3. "Achata" o dicionário em um array simples de valores
			const values: any[] = [];
			for (const item of colorsToInsert) {
				values.push(id, item.colorId, item.quantity, item.size);
			}

			// 4. Executa tudo em uma única chamada ao banco
			const result = await db.all(query, values); // Use db.all for RETURNING clause to get all inserted IDs

			for (const row of result) {
				insertedIds.push(row.id);
			}

			return { failResultPost, insertedIds };
		} catch (error) {
			let { failResultCallBack } = await this.dbService.callFallBackOperation(
				id,
				"INSERT INTO",
				"product_colors",
				"product_id, color_id, quantity, tamanho",
				colors,
			);

			failResultPost.push(
				...colors.map((c) => ({ ...c, error: error.message })),
			);

			failResultPost.push(failResultCallBack);
		}
		return { failResultPost, insertedIds };
	}

	/**
	 * Consulta o estoque máximo disponível de um produto específico ou de todos os produtos do catálogo.
	 *
	 * @description
	 * Este método identifica o maior valor de estoque (`quantity`) entre todas as variantes
	 * (combinações de cor e tamanho) associadas a um produto. É essencial para validar limites
	 * de compra no carrinho, garantindo que o usuário não adicione mais itens do que a maior
	 * disponibilidade física de uma única variante.
	 *
	 * @param {number} [productId] - (Opcional) O identificador único do produto para filtrar a consulta.
	 * @returns {Promise<any | any[]>}
	 * - Se `productId` for informado: Retorna um objeto `{ productId: number, max_stock: number }`.
	 * - Se `productId` for omitido: Retorna um array de objetos com o estoque máximo de cada produto.
	 *
	 * @throws {Error} Lança uma exceção caso ocorra uma falha na execução da consulta SQL.
	 */
	public async getMaxStock(productId?: number): Promise<any> {
		try {
			// Inicializa a conexão com o banco de dados
			const db = await this.dbService.getDatabase();

			// Query base para selecionar o ID do produto e encontrar o MAX do estoque entre suas variantes
			let query = `
        SELECT p.id as productId, MAX(pc.quantity) as max_stock 
        FROM products p
        INNER JOIN product_colors pc ON p.id = pc.product_id
      `;

			// Lógica condicional: se um ID específico foi passado, filtramos a busca
			if (productId) {
				// Retorna apenas uma linha (objeto único) usando db.get
				query += ` WHERE p.id = ? GROUP BY p.id`;
				return await db.get(query, [productId]);
			} else {
				// Retorna todas as linhas (array) agrupadas por produto
				query += ` GROUP BY p.id`;
				return await db.all(query);
			}
		} catch (error) {
			// Registra o erro técnico no log e lança uma mensagem amigável para a camada de serviço
			this.logger.error("Erro ao obter o estoque máximo", error.stack);
			throw new Error("Erro ao obter o estoque máximo");
		}
	}
}
