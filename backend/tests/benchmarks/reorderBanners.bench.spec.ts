import { ManagerService } from '../../src/services/ManagerService';
import { PublicRepository } from '../../src/repositories/PublicRepository';
import { ProductRepository } from '../../src/repositories/ProductRepository';
import { ProductColorRepository } from '../../src/repositories/ProductColorRepository';
import { CatalogRepository } from '../../src/repositories/CatalogRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { SearchIndexService } from '../../src/services/SearchIndexService';
import { SearchIndexRepository } from '../../src/repositories/SearchIndexRepository';
import { DataBaseService } from '../../src/services/DataBaseService';
import { DatabaseConnection } from '../../src/infra/database';
import { performance } from 'perf_hooks';

// Mock file-type to avoid ES module import issues in jest
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockImplementation(() => Promise.resolve({ ext: 'png', mime: 'image/png' })),
}), { virtual: true });

describe('ManagerService.reorderBanners Performance Benchmark', () => {
    let dbService: DataBaseService;
    let publicRepo: PublicRepository;
    let managerService: ManagerService;
    let db: any;

    beforeAll(async () => {
        dbService = new DataBaseService();
        publicRepo = new PublicRepository(dbService);
        const productRepo = new ProductRepository();
        const productColorRepo = new ProductColorRepository(dbService);
        const catalogRepo = new CatalogRepository();
        const userRepo = new UserRepository();
        const searchIndexRepo = new SearchIndexRepository();
        const searchIndexService = new SearchIndexService(searchIndexRepo);

        managerService = new ManagerService(
            productRepo,
            productColorRepo,
            catalogRepo,
            publicRepo,
            searchIndexService,
            userRepo
        );

        db = await DatabaseConnection.getInstance();

        await db.run("CREATE TABLE IF NOT EXISTS banners (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, image_url TEXT NOT NULL, link_url TEXT, order_index INTEGER DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT 1)");

        await db.run("DELETE FROM banners");

        for (let i = 1; i <= 100; i++) {
            await db.run("INSERT INTO banners (id, type, image_url, order_index) VALUES (?, ?, ?, ?)", [i, 'test_banner', `url${i}`, i]);
        }
    });

    afterAll(async () => {
        if (db) {
            await db.run("DELETE FROM banners");
        }
    });

    it('benchmarks reorderBanners execution time', async () => {
        const bannersToReorder: { id: number; order_index: number }[] = [];
        for (let i = 1; i <= 100; i++) {
            bannersToReorder.push({ id: i, order_index: 100 - i });
        }

        // Warmup
        await managerService.reorderBanners(bannersToReorder);

        const ITERATIONS = 10;
        const start = performance.now();

        for (let i = 0; i < ITERATIONS; i++) {
            await managerService.reorderBanners(bannersToReorder);
        }

        const end = performance.now();
        const duration = (end - start) / ITERATIONS;

        console.log(`reorderBanners took on average ${duration.toFixed(2)}ms over ${ITERATIONS} iterations.`);
    });
});
