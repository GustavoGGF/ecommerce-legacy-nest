import { Injectable, Logger } from "@nestjs/common";
import { ProductColorRepository } from "../repositories/ProductColorRepository";

@Injectable()
export class ProductColorsService {
	constructor(private readonly pcRepo: ProductColorRepository) {}

	private readonly logger = new Logger(ProductColorsService.name);

	/**
	 * Obtém a quantidade máxima de estoque disponível para um produto ou para todo o catálogo.
	 *
	 * @description
	 * Esta função atua como uma ponte para o repositório, solicitando o maior valor de estoque
	 * encontrado entre as variações (cores/tamanhos) de um produto específico ou de todos.
	 *
	 * @param {number} [productId] - (Opcional) O identificador único do produto para filtrar a consulta.
	 * @returns {Promise<any>} Uma promessa que resolve com os dados de estoque máximo (objeto único ou array).
	 * @throws {Error} Lança uma exceção caso ocorra uma falha na comunicação com o banco de dados.
	 */
	public async getMaxStock(productId?: number) {
		try {
			return await this.pcRepo.getMaxStock(productId);
		} catch (error) {
			this.logger.error("Erro ao obter o estoque máximo", error.stack);
			throw new Error("Erro ao obter o estoque máximo");
		}
	}
}
