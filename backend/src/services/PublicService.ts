import {
	Injectable,
	Logger,
	InternalServerErrorException,
} from "@nestjs/common";
import { PublicRepository } from "../repositories/PublicRepository";
import { CatalogRepository } from "../repositories/CatalogRepository";
import { SearchIndexRepository } from "../repositories/SearchIndexRepository";
import { ProductColorRepository } from "../repositories/ProductColorRepository";

@Injectable()
export class PublicService {
	private readonly logger = new Logger(PublicService.name);

	constructor(
		private readonly catalogRepository: CatalogRepository,
		private readonly publicRepository: PublicRepository,
		private readonly searchIndexRepository: SearchIndexRepository, // Injetando o SearchIndexRepository
		private readonly productColorRepository: ProductColorRepository,
	) {}

	/**
	 * Realiza uma busca de produtos no índice FTS5.
	 *
	 * @param query O termo de busca fornecido pelo usuário.
	 * @returns Uma lista de produtos que correspondem ao termo de busca.
	 */
	public async searchProducts(query: string): Promise<any[]> {
		try {
			// Delega a responsabilidade de construção e execução da query ao repositório
			const results = await this.searchIndexRepository.searchProducts(query);

			return results;
		} catch (error) {
			this.logger.error(
				`Erro ao realizar busca de produtos para a query "${query}": ${error}`,
			);
			throw new InternalServerErrorException(
				"Erro ao realizar a busca de produtos.",
			);
		}
	}

	/**
	 * Obtém a quantidade máxima de estoque disponível para um produto específico ou para todo o catálogo.
	 *
	 * @description
	 * Esta função atua como uma ponte para o repositório, solicitando o maior valor de estoque
	 * encontrado entre as variações (cores/tamanhos) de um produto específico (caso o ID seja informado)
	 * ou retornando o estoque máximo de todos os produtos cadastrados.
	 *
	 * @param {number} [productId] - (Opcional) O identificador único do produto para filtrar a consulta.
	 * @returns {Promise<any>} Uma promessa que resolve com os dados de estoque máximo.
	 * Retorna um objeto único se o ID for passado, ou um array caso contrário.
	 */
	public async getMaxStock(productId?: number) {
		return await this.productColorRepository.getMaxStock(productId);
	}

	/**
	 * Obtém os banners ativos filtrados por tipo.
	 */
	public async getBanners(type: string): Promise<any[]> {
		try {
			return await this.publicRepository.getBannersByType(type);
		} catch (error) {
			this.logger.error(`Erro ao obter banners: ${error}`);
			throw new InternalServerErrorException("Erro ao buscar banners.");
		}
	}

	/**
	 * Obtém produtos de uma categoria específica com metadados de paginação.
	 */
	public async getProductsByCategory(
		categoryType: string,
		page: number,
		limit: number,
		colors: string[] = [],
		sizes: string[] = [],
		minPrice: number | null = null,
		maxPrice: number | null = null,
	) {
		try {
			const offset = (page - 1) * limit;

			// Executamos a busca dos produtos e a contagem total em paralelo para otimizar o tempo de resposta
			const [products, totalItems] = await Promise.all([
				this.publicRepository.getProductsByCategory(
					categoryType,
					limit,
					offset,
					colors,
					sizes,
					minPrice,
					maxPrice,
				),
				this.publicRepository.countProductsByCategory(
					categoryType,
					colors,
					sizes,
					minPrice,
					maxPrice,
				),
			]);

			// Formata a string de cores vinda do banco para um array real
			const formattedProducts = products.map((p) => ({
				...p,
				availableColors: p.availableColors ? p.availableColors.split(",") : [],
				availableSizes: p.availableSizes ? p.availableSizes.split(",") : [],
			}));

			return {
				items: formattedProducts,
				meta: {
					totalItems,
					itemsPerPage: limit,
					currentPage: page,
					totalPages: Math.ceil(totalItems / limit),
					hasNextPage: page * limit < totalItems,
				},
			};
		} catch (error) {
			this.logger.error(
				`Erro ao buscar produtos da categoria ${categoryType}: ${error}`,
			);
			throw new InternalServerErrorException(
				"Erro ao processar a listagem de produtos.",
			);
		}
	}

	/**
	 * Obtém os metadados de filtros (cores, tamanhos, etc) para uma categoria.
	 */
	public async getCategoryFilters(categoryType: string) {
		try {
			const [colors, sizes] = await Promise.all([
				this.publicRepository.getCategoryColors(categoryType),
				this.publicRepository.getCategorySizes(categoryType),
			]);
			return { colors, sizes };
		} catch (error) {
			this.logger.error(
				`Erro ao buscar filtros da categoria ${categoryType}: ${error}`,
			);
			throw new InternalServerErrorException("Erro ao buscar filtros.");
		}
	}

	/**
	 * Orquestra a busca de produtos com estoque crítico baseando-se em configurações de ambiente.
	 *
	 * @description
	 * Recupera o limite de estoque (threshold) das variáveis de ambiente e solicita ao
	 * repositório os produtos que atingiram ou estão abaixo deste valor.
	 *
	 * @returns Promessa com a lista de produtos formatada para exibição em vitrines de urgência.
	 */
	public async getLowStockProducts() {
		try {
			const threshold = Number(process.env.LOW_STOCK_THRESHOLD) || 10;

			return await this.publicRepository.getLowStockProducts(threshold, 20);
		} catch (error) {
			this.logger.error(`Erro ao buscar produtos com baixo estoque: ${error}`);
			throw new InternalServerErrorException(
				"Erro ao buscar produtos com baixo estoque.",
			);
		}
	}

	/**
	 * Obtém o ranking dos produtos mais vendidos do período mais recente disponível.
	 * Se não houver produtos mais vendidos ou se a quantidade for insuficiente (menos de 20),
	 * produtos de fallback com imagens são gerados para completar a lista.
	 *
	 * @returns Promessa contendo um array de objetos com dados dos produtos mais vendidos ou de fallback.
	 */
	public async getBestSellers() {
		try {
			const bestSellers = await this.publicRepository.getBestSellers();

			// Se não houver nenhum item, gera 20 produtos automaticamente
			if (!bestSellers || bestSellers.length === 0) {
				return await this.generateProducts(20);
			}

			const validProducts: any[] = [];

			// Obtém a contagem de imagens para todos os produtos mais vendidos de uma só vez
			const productIds = bestSellers.map((product) => product.productId);
			const imageCounts = await this.publicRepository.getProductImageCounts(productIds);

			// Valida quais produtos possuem mídias cadastradas
			for (const product of bestSellers) {
				const imageCount = imageCounts[product.productId] || 0;
				if (imageCount >= 1) {
					validProducts.push(product);
				}
			}

			const difference = 20 - validProducts.length;

			// Se faltarem produtos para completar 20, busca o restante via fallback
			if (difference !== 0) {
				const generated = await this.generateProducts(difference);
				return [...validProducts, ...generated];
			}

			return validProducts;
		} catch (error) {
			this.logger.error(`Erro ao buscar produtos mais vendidos: ${error}`);
			throw new InternalServerErrorException(
				"Erro ao buscar produtos mais vendidos.",
			);
		}
	}

	/**
	 * Gera uma lista de produtos de fallback com imagens, ordenados aleatoriamente,
	 * para preencher vitrines ou seções quando não há produtos específicos disponíveis.
	 *
	 * @param count - O número de produtos de fallback a serem gerados.
	 * @returns Promessa contendo um array de objetos com dados dos produtos de fallback.
	 */
	private async generateProducts(count: number): Promise<any[]> {
		try {
			return await this.publicRepository.getFallbackProducts(count);
		} catch (error) {
			this.logger.error(`Erro ao gerar produtos de fallback: ${error}`);
			return [];
		}
	}

	/**
	 * Obtém a lista dos lançamentos mais recentes do catálogo.
	 *
	 * @description
	 * Solicita ao repositório os 10 produtos mais recentemente cadastrados que possuem mídias válidas.
	 *
	 * @returns Promessa com a lista de produtos formatada para a vitrine de novidades.
	 */
	public async getNewArrivals() {
		try {
			return await this.publicRepository.getNewArrivals(10);
		} catch (error) {
			this.logger.error(`Erro ao buscar novos produtos: ${error}`);
			throw new InternalServerErrorException("Erro ao buscar novos produtos.");
		}
	}

	/**
	 * Obtém a lista de produtos que possuem descontos ativos no catálogo.
	 *
	 * @description
	 * Solicita ao repositório os 10 produtos em oferta que possuem pelo menos uma mídia
	 * associada, garantindo a integridade visual da vitrine de promoções.
	 *
	 * @returns Promessa com a lista de produtos em promoção formatada para exibição.
	 */
	public async getPromotions() {
		try {
			return await this.publicRepository.getPromotions(10);
		} catch (error) {
			this.logger.error(`Erro ao buscar produtos em promoção: ${error}`);
			throw new InternalServerErrorException(
				"Erro ao buscar produtos em promoção.",
			);
		}
	}

	/**
	 * Obtém a lista de categorias cadastradas no catálogo de produtos.
	 *
	 * @description
	 * Solicita ao repositório todas as categorias disponíveis para utilização
	 * em componentes públicos do e-commerce, como menus, filtros e navegação
	 * entre seções de produtos.
	 *
	 * @returns Promessa com a lista de categorias cadastradas.
	 */
	public async getCategories(): Promise<any[]> {
		try {
			return await this.catalogRepository.getCategories();
		} catch (error) {
			this.logger.error(`Erro ao obter as categorias dos produtos: ${error}`);
			throw new InternalServerErrorException("Erro ao obter as categorias");
		}
	}

	/**
	 * Obtém os detalhes de uma categoria específica pelo seu ID.
	 *
	 * @param categoryId O ID da categoria a ser buscada.
	 * @returns Promessa com os detalhes da categoria (id, item, url).
	 */
	public async getCategoryById(categoryId: string): Promise<any> {
		try {
			return await this.catalogRepository.getCategoryById(categoryId);
		} catch (error) {
			this.logger.error(
				`Erro ao obter a categoria com ID ${categoryId}: ${error}`,
			);
			throw new InternalServerErrorException(
				`Erro ao obter a categoria com ID ${categoryId}`,
			);
		}
	}

	/**
	 * Obtém os detalhes de um produto específico pelo identificador.
	 *
	 * @description
	 * Solicita ao repositório os dados completos de um produto com base
	 * no identificador informado. O retorno pode incluir informações como
	 * dados básicos, imagens, variantes e descontos associados ao produto.
	 *
	 * Em caso de falha durante a consulta, registra o erro no logger e
	 * lança uma exceção interna para tratamento pela aplicação.
	 *
	 * @param id Identificador do produto a ser consultado.
	 * @returns Promessa contendo os dados completos do produto.
	 */
	public async getProductById(id: number): Promise<any> {
		try {
			return await this.publicRepository.getProductById(id);
		} catch (error) {
			this.logger.error(`Erro ao obter produto por ID ${id}: ${error}`);
			throw new InternalServerErrorException(
				"Erro ao buscar dados do produto.",
			);
		}
	}
}
