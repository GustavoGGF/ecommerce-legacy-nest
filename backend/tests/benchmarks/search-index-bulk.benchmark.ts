import { Test, TestingModule } from "@nestjs/testing";
import { SearchIndexService } from "../../src/services/SearchIndexService";
import { SearchIndexRepository } from "../../src/repositories/SearchIndexRepository";
import { DatabaseConnection } from "../../src/infra/database";

describe("SearchIndexService Performance Benchmark", () => {
	let searchIndexService: SearchIndexService;
	let searchIndexRepository: SearchIndexRepository;
	let db;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [SearchIndexService, SearchIndexRepository],
		}).compile();

		searchIndexService = module.get<SearchIndexService>(SearchIndexService);
		searchIndexRepository = module.get<SearchIndexRepository>(SearchIndexRepository);
		db = await DatabaseConnection.getInstance();

		// Cleanup before tests
		await db.run("DELETE FROM products_search_index");
		await db.run("DELETE FROM sales");
		await db.run("DELETE FROM discounts");
		await db.run("DELETE FROM best_sellers");
		await db.run("DELETE FROM product_urls");
		await db.run("DELETE FROM product_colors");
		await db.run("DELETE FROM products");
		await db.run("DELETE FROM colors");
		await db.run("DELETE FROM catalog");

		// Insert dummy data
		await db.run(`INSERT INTO catalog (id, item, url) VALUES (1, 'Test Category', 'http://example.com/cat')`);
		await db.run(`INSERT INTO colors (id, name, color) VALUES (1, 'Red', '#FF0000')`);

		for (let i = 1; i <= 50; i++) {
			await db.run(`INSERT INTO products (id, nome, preco, categoria, descricao) VALUES (?, 'Product ' || ?, 10.0, 1, 'Description')`, [i, i]);
		}
	});

	afterAll(async () => {
		await db.run("DELETE FROM products_search_index");
		await db.run("DELETE FROM product_colors");
		await db.run("DELETE FROM products");
		await db.run("DELETE FROM colors");
		await db.run("DELETE FROM catalog");
	});

	it("should measure performance of sequential search index updates", async () => {
		const NUM_VARIANTS = 200;
		const variantIds: number[] = [];

		// Insert 200 product colors
		for (let i = 1; i <= NUM_VARIANTS; i++) {
			const productId = (i % 50) + 1;
			const result = await db.run(
				`INSERT INTO product_colors (product_id, color_id, quantity, tamanho) VALUES (?, 1, 10, 'M')`,
				[productId]
			);
			variantIds.push(result.lastID);
		}

		const startTime = process.hrtime.bigint();

		for (const variantId of variantIds) {
			await searchIndexService.updateSearchIndex(variantId);
		}

		const endTime = process.hrtime.bigint();
		const executionTimeMs = Number(endTime - startTime) / 1000000;

		console.log(`\n\n[Benchmark] Sequential Update for ${NUM_VARIANTS} variants took ${executionTimeMs.toFixed(2)} ms`);

		expect(executionTimeMs).toBeGreaterThan(0);
	});

	it("should measure performance of bulk search index updates", async () => {
		const NUM_VARIANTS = 200;
		const variantIds: number[] = [];

		// Clean up previous test
		await db.run("DELETE FROM products_search_index");
		await db.run("DELETE FROM product_colors");

		// Insert 200 product colors
		for (let i = 1; i <= NUM_VARIANTS; i++) {
			const productId = (i % 50) + 1;
			const result = await db.run(
				`INSERT INTO product_colors (product_id, color_id, quantity, tamanho) VALUES (?, 1, 10, 'M')`,
				[productId]
			);
			variantIds.push(result.lastID);
		}

		const startTime = process.hrtime.bigint();

		await searchIndexService.updateSearchIndexBulk(variantIds);

		const endTime = process.hrtime.bigint();
		const executionTimeMs = Number(endTime - startTime) / 1000000;

		console.log(`\n\n[Benchmark] Bulk Update for ${NUM_VARIANTS} variants took ${executionTimeMs.toFixed(2)} ms`);

		expect(executionTimeMs).toBeGreaterThan(0);
	});
});
