import { fileTypeFromBuffer } from 'file-type';
import { ManagerService } from '../../src/services/ManagerService';

// Mocking dependencies
const mockProductRepository = {} as any;
const mockProductColorRepo = {} as any;
const mockCatalogRepository = {} as any;
const mockPublicRepository = {} as any;
const mockSearch = {} as any;
const mockUserRepo = {} as any;

const service = new ManagerService(
  mockProductRepository,
  mockProductColorRepo,
  mockCatalogRepository,
  mockPublicRepository,
  mockSearch,
  mockUserRepo
);

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const smallBuffer = Buffer.from(pngBase64, 'base64');

// Create a large 10MB dummy buffer so allocating memory and making copies takes enough time to show on the benchmark
const dummyBuffer = Buffer.concat([smallBuffer, Buffer.alloc(1024 * 1024 * 10)]);

const generateImages = (count: number): Express.Multer.File[] => {
  return Array.from({ length: count }).map((_, i) => ({
    fieldname: 'image',
    originalname: `image-${i}.png`,
    encoding: '7bit',
    mimetype: 'image/png',
    size: dummyBuffer.length,
    destination: '',
    filename: `image-${i}.png`,
    path: '',
    buffer: dummyBuffer,
    stream: null as any,
  }));
};

async function runBenchmark() {
  const images = generateImages(100); // 100 images of 10MB each

  console.log('Starting benchmark for validateProductFiles with 100 10MB images...');

  // Warmup run
  try {
    await (service as any).validateProductFiles(images.slice(0, 5));
  } catch (error) {}

  const start = performance.now();

  try {
    const result = await (service as any).validateProductFiles(images);
    const end = performance.now();

    console.log(`Time taken: ${(end - start).toFixed(2)} ms`);
    console.log(`Valid images: ${result.validImages.length}`);
    console.log(`Invalid images: ${result.invalidImages.length}`);
  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}

runBenchmark();
