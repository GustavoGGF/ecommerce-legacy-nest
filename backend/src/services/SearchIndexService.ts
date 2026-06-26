import { Injectable, Logger } from "@nestjs/common";
import { SearchIndexRepository } from "../repositories/SearchIndexRepository";

@Injectable()
export class SearchIndexService {
	constructor(private readonly searchIndexRepo: SearchIndexRepository) {}

	private readonly logger = new Logger(SearchIndexService.name);

	/**
	 * Updates or inserts an entry into the FTS5 search index for a given product color variant.
	 *
	 * @param {number} productColorId - The ID of the product color variant that was altered.
	 */
	public async updateSearchIndex(productColorId: number) {
		try {
			const productData =
				await this.searchIndexRepo.getVariantDetailsForIndex(productColorId);

			if (productData) {
				await this.searchIndexRepo.upsertSearchIndex(productData);
				this.logger.log(
					`Search index updated for product_color_id: ${productColorId}`,
				);
			} else {
				this.logger.warn(
					`No product data found for product_color_id: ${productColorId}. Search index not updated.`,
				);
			}
		} catch (error) {
			this.logger.error(
				`Error updating search index for product_color_id ${productColorId}: ${error.message}`,
			);
			throw error;
		}
	}
}
