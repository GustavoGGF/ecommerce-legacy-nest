import { PublicService } from '../../src/services/PublicService';
import { PublicRepository } from '../../src/repositories/PublicRepository';
import { DataBaseService } from '../../src/services/DataBaseService';
import { CatalogRepository } from '../../src/repositories/CatalogRepository';
import { SearchIndexRepository } from '../../src/repositories/SearchIndexRepository';
import { ProductColorRepository } from '../../src/repositories/ProductColorRepository';
import { DatabaseConnection } from '../../src/infra/database';
import { performance } from 'perf_hooks';

describe('PublicService.getBestSellers Performance Benchmark', () => {
    let dbService: DataBaseService;
    let publicRepo: PublicRepository;
    let publicService: PublicService;
    let db: any;

    beforeAll(async () => {
        dbService = new DataBaseService();
        publicRepo = new PublicRepository(dbService);
        const catalogRepo = new CatalogRepository();
        const searchIndexRepo = new SearchIndexRepository();
        const productColorRepo = new ProductColorRepository(dbService);

        publicService = new PublicService(
            catalogRepo,
            publicRepo,
            searchIndexRepo,
            productColorRepo
        );

        db = await DatabaseConnection.getInstance();

        // Use transaction or specific temporary prefixed table names to avoid corrupting standard tables
        // However, tests here usually run on test db, but to be completely safe, we'll simply mock or use a separate connection if needed.
        // For simplicity and safety we'll use a transaction, insert data, and rollback.
        await db.run("BEGIN TRANSACTION");

        await db.run("CREATE TABLE IF NOT EXISTS best_sellers (product_id INTEGER, quantidade_vendida INTEGER, ano_mes TEXT)");
        await db.run("CREATE TABLE IF NOT EXISTS products (id INTEGER, nome TEXT, preco REAL, categoria INTEGER, created_at TEXT)");
        await db.run("CREATE TABLE IF NOT EXISTS catalog (id INTEGER, item TEXT)");
        await db.run("CREATE TABLE IF NOT EXISTS product_urls (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER, url TEXT)");

        await db.run("DELETE FROM best_sellers");
        await db.run("DELETE FROM products");
        await db.run("DELETE FROM catalog");
        await db.run("DELETE FROM product_urls");

        // Insert category
        await db.run("INSERT INTO catalog (id, item) VALUES (1, 'TestCategory')");

        // Insert products and best sellers
        const currentMonth = '2023-10'; // any test month
        for (let i = 1; i <= 50; i++) {
            await db.run("INSERT INTO products (id, nome, preco, categoria) VALUES (?, ?, ?, ?)", [i, `Product ${i}`, 100, 1]);
            await db.run("INSERT INTO best_sellers (product_id, quantidade_vendida, ano_mes) VALUES (?, ?, ?)", [i, 100 - i, currentMonth]);
            // Insert 2 images per product
            await db.run("INSERT INTO product_urls (product_id, url) VALUES (?, ?)", [i, `url1-${i}`]);
            await db.run("INSERT INTO product_urls (product_id, url) VALUES (?, ?)", [i, `url2-${i}`]);
        }
    });

    afterAll(async () => {
        // Rollback any changes we made during the test.
        await db.run("ROLLBACK");
    });

    it('benchmarks getBestSellers execution time', async () => {
        // Warmup
        await publicService.getBestSellers();

        const ITERATIONS = 10;
        const start = performance.now();

        for (let i = 0; i < ITERATIONS; i++) {
            await publicService.getBestSellers();
        }

        const end = performance.now();
        const duration = (end - start) / ITERATIONS;

        console.log(`getBestSellers took on average ${duration.toFixed(2)}ms over ${ITERATIONS} iterations.`);
    });
});
