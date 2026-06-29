import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { CreateProductDto } from "../../src/models/Product";
import { CatalogRepository } from "../../src/repositories/CatalogRepository";
import { ProductColorRepository } from "../../src/repositories/ProductColorRepository";
import { ProductRepository } from "../../src/repositories/ProductRepository";
import { PublicRepository } from "../../src/repositories/PublicRepository";
import { UserRepository } from "../../src/repositories/UserRepository";
import { ManagerService } from "./../../src/services/ManagerService";
import { SearchIndexService } from "../../src/services/SearchIndexService";


jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockImplementation(() => Promise.resolve({ ext: 'png', mime: 'image/png' })),
}), { virtual: true });

describe("ManagerService - validateProduct", () => {
	let service: ManagerService;
	let productRepo: jest.Mocked<ProductRepository>;
	let productColorRepo: jest.Mocked<ProductColorRepository>;
	let catalogRepo: jest.Mocked<CatalogRepository>;
	let searchService: jest.Mocked<SearchIndexService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ManagerService,
				{
					provide: ProductRepository,
					useValue: {
						addNewProduct: jest.fn(),
						postURL: jest.fn(),
						getColors: jest.fn(),
					},
				},
				{
					provide: ProductColorRepository,
					useValue: {
						addNewProductColor: jest.fn(),
					},
				},
				{
					provide: CatalogRepository,
					useValue: {
						getCategories: jest.fn(),
					},
				},
				{
					provide: PublicRepository,
					useValue: {},
				},
				{
					provide: SearchIndexService,
					useValue: {
						updateSearchIndex: jest.fn(),
					},
				},
				{
					provide: UserRepository,
					useValue: {},
				},
			],
		}).compile();

		service = module.get<ManagerService>(ManagerService);
		productRepo = module.get(ProductRepository);
		productColorRepo = module.get(ProductColorRepository);
		catalogRepo = module.get(CatalogRepository);
		searchService = module.get(SearchIndexService);
	});

	const mockDto: CreateProductDto = {
		nome: "Camisa Polo",
		preco: 89.9,
		descricao: "Camisa de algodão premium",
		categoria: 1,
		cores: "1 50 M, 2 30 G",
	};

	const mockFiles = [
		{
			originalname: "camisa.jpg",
			buffer: Buffer.from("fake-image"),
			mimetype: "image/jpeg",
		} as unknown as Express.Multer.File,
	];

	it("deve cadastrar um produto e indexar suas variantes com sucesso", async () => {
		// 1. Mock de Categorias
		catalogRepo.getCategories.mockResolvedValue([
			{ id: 1, item: "Moda Masculina" },
		]);

		// 2. Mock de processamento de imagens (Spy para evitar manipulação de FS real)
		jest.spyOn(service, "validateImages").mockResolvedValue({
			invalidImages: [],
			urlImages: ["/static/shared/camisa.webp"],
		});

		// 3. Mock de inserção do produto base
		productRepo.addNewProduct.mockResolvedValue(100); // genID

		// 4. Mock de cores disponíveis (usado na validação de variantes)
		productRepo.getColors.mockResolvedValue([
			{ id: 1, name: "Azul" },
			{ id: 2, name: "Branco" },
		]);

		// 5. Mock de inserção das variantes (product_colors)
		productColorRepo.addNewProductColor.mockResolvedValue({
			failResultPost: [],
			insertedIds: [500, 501],
		});

		const result = await service.validateProduct(mockDto, mockFiles);

		// Verificações de Orquestração
		expect(productRepo.addNewProduct).toHaveBeenCalled();
		expect(productRepo.postURL).toHaveBeenCalledWith(
			["/static/shared/camisa.webp"],
			100,
		);
		expect(productColorRepo.addNewProductColor).toHaveBeenCalled();

		// Verificação da Indexação (deve rodar para cada variantId retornado)
		expect(searchService.updateSearchIndex).toHaveBeenCalledTimes(2);
		expect(searchService.updateSearchIndex).toHaveBeenNthCalledWith(1, 500);
		expect(searchService.updateSearchIndex).toHaveBeenNthCalledWith(2, 501);

		expect(result).toContain("Produto Cadastrado");
	});

	it("deve lançar BadRequestException se a categoria não existir", async () => {
		// Mock para simular que a categoria do mockDto (ID 1) não existe
		catalogRepo.getCategories.mockResolvedValue([{ id: 99, item: "Outra" }]);

		// Mock validateImages para evitar erros relacionados a processamento de imagem
		jest.spyOn(service, "validateImages").mockResolvedValue({
			invalidImages: [],
			urlImages: [],
		});
		await expect(service.validateProduct(mockDto, mockFiles)).rejects.toThrow(
			BadRequestException,
		);
	});

	it("deve reportar falhas parciais se algumas variantes falharem no cadastro", async () => {
		catalogRepo.getCategories.mockResolvedValue([
			{ id: 1, item: "Moda Masculina" },
		]);
		jest
			.spyOn(service, "validateImages")
			.mockResolvedValue({ invalidImages: [], urlImages: [] });
		productRepo.addNewProduct.mockResolvedValue(100);
		productRepo.getColors.mockResolvedValue([
			{ id: 1, name: "Azul" },
			{ id: 2, name: "Branco" },
		]);

		productColorRepo.addNewProductColor.mockResolvedValue({
			failResultPost: [{ colorId: 2, error: "Erro de integridade" }],
			insertedIds: [500],
		});

		const result = await service.validateProduct(mockDto, mockFiles);

		expect(result).toContain("Houve alguns erros no cadastro");
		expect(searchService.updateSearchIndex).toHaveBeenCalledTimes(1);
	});

	it("deve lançar erro e interromper o processo se a indexação de busca falhar", async () => {
		// Arrange: Prepara o ambiente para chegar até a fase de indexação
		catalogRepo.getCategories.mockResolvedValue([
			{ id: 1, item: "Moda Masculina" },
		]);
		jest
			.spyOn(service, "validateImages")
			.mockResolvedValue({ invalidImages: [], urlImages: [] });
		productRepo.addNewProduct.mockResolvedValue(100);
		productRepo.getColors.mockResolvedValue([{ id: 1, name: "Azul" }]);
		productColorRepo.addNewProductColor.mockResolvedValue({
			failResultPost: [],
			insertedIds: [999], // Um ID que simula uma inserção bem sucedida
		});

		// Simula uma falha crítica no serviço de busca
		searchService.updateSearchIndex.mockRejectedValue(
			new Error("Falha no banco de dados FTS5"),
		);

		// Act & Assert: O ManagerService deve capturar o erro do SearchIndexService e lançar BadRequestException
		await expect(service.validateProduct(mockDto, mockFiles)).rejects.toThrow(
			BadRequestException,
		);
		await expect(service.validateProduct(mockDto, mockFiles)).rejects.toThrow(
			/Falha no banco de dados FTS5/,
		);
		expect(searchService.updateSearchIndex).toHaveBeenCalledWith(999);
	});

	it("deve chamar updateSearchIndex com sucesso para múltiplos IDs de variantes", async () => {
		// Arrange: Simula 3 variantes sendo inseridas com sucesso
		const idsInseridos = [700, 701, 702];
		catalogRepo.getCategories.mockResolvedValue([
			{ id: 1, item: "Moda Masculina" },
		]);
		jest
			.spyOn(service, "validateImages")
			.mockResolvedValue({ invalidImages: [], urlImages: [] });
		productRepo.addNewProduct.mockResolvedValue(100);
		productRepo.getColors.mockResolvedValue([{ id: 1, name: "Azul" }]);

		productColorRepo.addNewProductColor.mockResolvedValue({
			failResultPost: [],
			insertedIds: idsInseridos,
		});

		// Act
		await service.validateProduct(mockDto, mockFiles);

		// Assert: Verifica se o serviço de busca foi chamado para cada ID na ordem correta
		expect(searchService.updateSearchIndex).toHaveBeenCalledTimes(
			idsInseridos.length,
		);

		idsInseridos.forEach((id, index) => {
			expect(searchService.updateSearchIndex).toHaveBeenNthCalledWith(
				index + 1,
				id,
			);
		});

		expect(searchService.updateSearchIndex).toHaveBeenCalledWith(702);
	});
});
