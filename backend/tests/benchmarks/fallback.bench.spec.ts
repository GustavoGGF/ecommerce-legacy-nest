import { DataBaseService } from '../../src/services/DataBaseService';
import { DatabaseConnection } from '../../src/infra/database';
import { ColorVariant } from '../../src/models/Product';
import { performance } from 'perf_hooks';

describe('Fallback Performance Benchmark', () => {
    let dbService: DataBaseService;

    beforeAll(async () => {
        dbService = new DataBaseService();
        const db = await DatabaseConnection.getInstance();

        // Setup initial schema
        await db.run("CREATE TABLE IF NOT EXISTS fallback_test_table (id INTEGER, color TEXT, quantity INTEGER, size TEXT, UNIQUE(id, color, size))");
        // Clear table
        await db.run("DELETE FROM fallback_test_table");

        // Insert a duplicate to force failure
        await db.run("INSERT INTO fallback_test_table (id, color, quantity, size) VALUES (1, 'Red', 10, 'M')");
    });

    afterAll(async () => {
        const db = await DatabaseConnection.getInstance();
        await db.run("DROP TABLE fallback_test_table");
    });

    it('benchmarks callFallBackOperation', async () => {
        // Generate a large number of colors
        const colors: ColorVariant[] = [];
        for (let i = 0; i < 500; i++) {
            colors.push({ color: `Color-${i}`, quantity: i, size: 'L' });
        }

        // Include one duplicate at the beginning
        colors.unshift({ color: 'Red', quantity: 10, size: 'M' });

        // Include another duplicate inside the array
        colors.push({ color: 'Color-100', quantity: 100, size: 'L' });

        const start = performance.now();

        const result = await dbService.callFallBackOperation(
            1,
            'INSERT INTO',
            'fallback_test_table',
            'id, color, quantity, size',
            colors
        );

        const end = performance.now();
        const duration = end - start;

        console.log(`callFallBackOperation took ${duration.toFixed(2)}ms for ${colors.length} items.`);

        expect(result.failResultCallBack.length).toBeGreaterThan(0);
        // 500 valid items were inserted, but we passed 502 total.
        // 1 was already in DB (Red).
        // 1 was a duplicate of what we inserted (Color-100).
        expect(result.successResultCallBack.length).toBe(500);
        expect(result.failResultCallBack.length).toBe(2);
    });
});
