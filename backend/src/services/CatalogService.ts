import { Injectable, Logger } from "@nestjs/common";
import { CatalogRepository } from "../repositories/CatalogRepository";

@Injectable()
export class CatalogService {
	private readonly logger = new Logger(CatalogService.name);

	constructor(private readonly catalogRepository: CatalogRepository) {}

	/**
	 * Atualiza a URL da imagem de capa de uma categoria no catálogo.
	 * @param categoryId ID da categoria (ID no banco de dados).
	 * @param url URL da imagem selecionada para ser a capa.
	 */
	public async updateCategoryUrl(
		categoryId: string,
		url: string,
	): Promise<void> {
		return await this.catalogRepository.updateCategoryUrl(categoryId, url);
	}
}
