import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	Logger,
} from "@nestjs/common";
import { ProductRepository } from "../repositories/ProductRepository";

/**
 * Serviço responsável pela gestão de descontos e promoções.
 *
 * @description
 * Este serviço aplica regras de negócio estritas para a concessão de descontos:
 * 1. Antiguidade: O produto deve ter pelo menos 60 dias de cadastro.
 * 2. Estoque: O produto deve possuir no mínimo 10 unidades em estoque total.
 * 3. Unicidade: Não é permitido aplicar desconto em produtos que já estejam em promoção.
 * 4. Limite Global: O sistema permite no máximo 15 produtos com desconto simultaneamente.
 */
@Injectable()
export class DiscountService {
	private readonly logger = new Logger(DiscountService.name);

	// Constantes de Regras de Negócio (Hardcoded ou via ConfigService)
	private readonly MAX_DISCOUNTED_PRODUCTS = 15;
	private readonly MIN_DAYS_OLD = 60;
	private readonly MIN_STOCK_REQUIRED = 10;
	private readonly DISCOUNT_RANGE = { min: 10, max: 15 }; // Desconto aleatório entre 10% e 15%

	constructor(private readonly productRepository: ProductRepository) {}

	/**
	 * Busca produtos elegíveis e aplica descontos automaticamente até atingir o limite de 15.
	 *
	 * @param isStartup - Se verdadeiro, a rotina só prossegue se a vitrine estiver vazia
	 *                    ou se os descontos atuais tiverem expirado (mais de 2 dias).
	 */
	public async processAutomaticDiscounts(isStartup: boolean = false) {
		this.logger.log(
			`Iniciando análise de descontos (Modo Startup: ${isStartup})`,
		);

		try {
			if (isStartup) {
				const hasActive = await this.productRepository.hasActiveDiscounts();
				const lastRotation = await this.productRepository.getLastRotationDate();

				// Se já existem descontos e a última rotação foi há menos de 2 dias, ignoramos o processamento
				if (hasActive && lastRotation && !this.isDateStale(lastRotation, 2)) {
					this.logger.log(
						"Promoções vigentes detectadas. Nenhuma rotação necessária no startup.",
					);
					return;
				}
			}

			this.logger.log("Executando rotação autônoma de descontos...");

			await this.removeExpiredDiscounts();

			// 1. Arquiva os descontos que estão expirando
			await this.productRepository.archiveCurrentDiscounts();

			// 2. Limpa a tabela atual para a nova rotação
			await this.productRepository.clearAllDiscounts();

			// Busca todos os produtos para triagem (agora incluindo o preço)
			const allProducts =
				await this.productRepository.getProductsEligibilityData();

			// Filtra candidatos que cumprem a regra de idade (60 dias)
			const candidates = allProducts.filter((p) =>
				this.isEligibleByAge(p.created_at),
			);

			const candidateIds = candidates.map((c) => c.id);
			// Busca histórico e estoques em lote para evitar N+1 queries
			const discountedProductsSet =
				await this.productRepository.getDiscountedProducts(candidateIds);
			const productsStockMap =
				await this.productRepository.getProductsTotalStock(candidateIds);

			const discountsToApply: {
				product_id: number;
				original_price: number;
				discount_price: number;
			}[] = [];

			for (const candidate of candidates) {
				// Primeiro verifica o limite global
				if (discountsToApply.length >= this.MAX_DISCOUNTED_PRODUCTS) break;
				// Valida histórico: se já esteve em promoção (true), ele "cai fora" (pula para o próximo)

				if (discountedProductsSet.has(candidate.id)) continue;
				const totalStock = productsStockMap.get(candidate.id) || 0;
				if (totalStock >= this.MIN_STOCK_REQUIRED) {
					const discountPercentage = this.generateRandomDiscount(
						this.DISCOUNT_RANGE.min,
						this.DISCOUNT_RANGE.max,
					);

					const discountedPrice = this.calculateDiscountedPrice(candidate.price, discountPercentage);

					discountsToApply.push({
						product_id: candidate.id,
						original_price: candidate.price,
						discount_price: discountedPrice,
					});

					this.logger.log(
						`Desconto calculado: ${discountPercentage}% no produto ${candidate.id}. De R$${candidate.price} para R$${discountedPrice}`,
					);
				}
			}

			// Persiste os descontos em lote
			if (discountsToApply.length > 0) {
				await this.productRepository.saveDiscountRecordsBatch(discountsToApply);
			}

			this.logger.log(
				`Processo finalizado. ${discountsToApply.length} novos descontos aplicados.`,
			);
		} catch (error) {
			this.logger.error(
				"Falha no processamento autônomo de descontos",
				error.stack,
			);
			throw error;
		}
	}

	/**
	 * Orquestra a aplicação de desconto a um produto.
	 *
	 * @param productId Identificador único do produto.
	 * @param discountPercentage Valor do desconto (ex: 20 para 20% de redução).
	 */
	public async applyDiscount(productId: number, discountPercentage: number) {
		try {
			// 2. Recuperação de dados do produto
			const product = await this.productRepository.getProductById(productId);
			if (!product) {
				throw new BadRequestException("Produto não encontrado.");
			}

			// 6. Cálculo do novo preço e persistência
			const discountedPrice = this.calculateDiscountedPrice(product.price, discountPercentage);

			// Salva o registro na tabela de descontos ativos
			await this.productRepository.saveDiscountRecord({
				product_id: productId,
				original_price: product.price,
				discount_price: discountedPrice,
			});

			this.logger.log(
				`Sucesso: Desconto de ${discountPercentage}% no produto ${productId}. De R$${product.price} para R$${discountedPrice}`,
			);

			return {
				message: "Desconto aplicado com sucesso",
				productId,
				originalPrice: product.price,
				discountedPrice: discountedPrice,
			};
		} catch (error) {
			if (error instanceof BadRequestException) throw error;

			this.logger.error(
				`Erro ao aplicar desconto no produto ${productId}: ${error.message}`,
			);
			throw new InternalServerErrorException(
				"Erro interno ao processar a regra de desconto.",
			);
		}
	}

	/**
	 * Acessa o histórico e garante que apenas as últimas 2 rotações sejam mantidas.
	 */
	private async removeExpiredDiscounts() {
		this.logger.log("Verificando expiração de histórico de descontos...");
		await this.productRepository.cleanupOldDiscountsHistory();
	}

	/**
	 * Calcula o preço com desconto aplicado.
	 *
	 * @param price Preço original do produto.
	 * @param discountPercentage Porcentagem de desconto a ser aplicada.
	 * @returns Preço final com o desconto calculado e arredondado para duas casas decimais.
	 */
	private calculateDiscountedPrice(price: number, discountPercentage: number): number {
		const discountFactor = 1 - discountPercentage / 100;
		return parseFloat((price * discountFactor).toFixed(2));
	}

	/**
	 * Sorteia (escolhe) um valor de desconto aleatório dentro de um intervalo.
	 * @param min Valor mínimo (inclusive)
	 * @param max Valor máximo (inclusive)
	 * @returns Número sorteado.
	 */
	private generateRandomDiscount(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private isEligibleByAge(createdAt: string | Date): boolean {
		const creationDate = new Date(createdAt).getTime();
		const now = Date.now();
		const diffInDays = (now - creationDate) / (1000 * 60 * 60 * 24);

		return diffInDays >= this.MIN_DAYS_OLD;
	}

	/**
	 * Valida se uma data ultrapassou o limite de dias definido.
	 *
	 * @param date - Data de referência (ISO ou Objeto Date).
	 * @param daysThreshold - Quantidade de dias para considerar como 'expirado'.
	 */
	private isDateStale(date: string | Date, daysThreshold: number): boolean {
		const lastDate = new Date(date).getTime();
		const now = Date.now();
		const diffInDays = (now - lastDate) / (1000 * 60 * 60 * 24);

		return diffInDays >= daysThreshold;
	}
}
