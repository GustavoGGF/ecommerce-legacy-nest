import { Injectable, Logger } from "@nestjs/common";
import { SearchIndexRepository } from "../repositories/SearchIndexRepository";

@Injectable()
export class SearchIndexService {
  constructor(private readonly searchIndexRepo: SearchIndexRepository) {}

  private readonly logger = new Logger(SearchIndexService.name);

  /**
   * Updates or inserts entries into the FTS5 search index in bulk.
   *
   * @param {number[]} productColorIds - The IDs of the product color variants that were altered.
   */
  public async updateSearchIndexBulk(productColorIds: number[]) {
    try {
      if (!productColorIds || productColorIds.length === 0) {
        return;
      }

      const productsData =
        await this.searchIndexRepo.getVariantDetailsForIndexBulk(productColorIds);

      if (productsData && productsData.length > 0) {
        await this.searchIndexRepo.upsertSearchIndexBulk(productsData);
        this.logger.log(`Search index updated in bulk for ${productsData.length} variants`);

        // Log warnings for any IDs that weren't found
        const foundIds = new Set(productsData.map((d) => d.product_color_id));
        for (const id of productColorIds) {
          if (!foundIds.has(id)) {
            this.logger.warn(
              `No product data found for product_color_id: ${id}. Search index not updated.`,
            );
          }
        }
      } else {
        this.logger.warn(
          `No product data found for any of the provided product_color_ids. Search index not updated.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating search index in bulk for ${productColorIds.length} variants: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Updates or inserts an entry into the FTS5 search index for a given product color variant.
   *
   * @param {number} productColorId - The ID of the product color variant that was altered.
   */
  public async updateSearchIndex(productColorId: number) {
    try {
      const productData = await this.searchIndexRepo.getVariantDetailsForIndex(productColorId);

      if (productData) {
        await this.searchIndexRepo.upsertSearchIndex(productData);
        this.logger.log(`Search index updated for product_color_id: ${productColorId}`);
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
