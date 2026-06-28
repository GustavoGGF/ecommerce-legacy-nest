import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	Logger,
	UnprocessableEntityException,
} from "@nestjs/common";
import { ProductRepository } from "../repositories/ProductRepository";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";
import { Multer } from "multer";
import { CreateProductDto } from "../models/Product";
import { PublicRepository } from "../repositories/PublicRepository";
import { CatalogRepository } from "../repositories/CatalogRepository";
import { ProductColorRepository } from "../repositories/ProductColorRepository";
import { SearchIndexService } from "./SearchIndexService";
import { UserRepository } from "../repositories/UserRepository";

interface ValidateProductFilesResult {
	validImages: Express.Multer.File[];
	invalidImages: string[]; // só os nomes, já que são inválidos
}

/**
 * Serviço responsável pela gestão de operações administrativas de produtos.
 *
 * @description
 * O `ManagerService` atua como a camada de lógica de negócio para o painel administrativo (Management).
 * Suas principais responsabilidades incluem:
 * - Validação rigorosa de integridade de dados de produtos.
 * - Orquestração do pipeline de processamento de mídia (Imagens/WebP).
 * - Tratamento de regras de negócio complexas como vinculação de cores e categorias.
 *
 * @injectable
 */
@Injectable()
export class ManagerService {
	constructor(
		private readonly productRepository: ProductRepository,
		private readonly productColorRepo: ProductColorRepository,
		private readonly catalogRepository: CatalogRepository,
		private readonly publicRepository: PublicRepository,
		private readonly search: SearchIndexService,
		private readonly userRepo: UserRepository,
	) {}

	private readonly logger = new Logger(ManagerService.name);

	/**
	 * Recupera todos os banners (ativos e inativos) para o painel de gestão.
	 *
	 * @param type - O contexto do banner (ex: hero-slider).
	 * @returns Lista completa de banners.
	 */
	public async getBanners(type: string): Promise<any[]> {
		try {
			return await this.publicRepository.getAllBannersByType(type);
		} catch (error) {
			this.logger.error(`Erro ao obter banners para gestão: ${error}`);
			throw new InternalServerErrorException(
				"Erro ao buscar a lista de banners.",
			);
		}
	}

	/**
	 * Remove um banner do sistema, limpando o banco e o arquivo físico.
	 * @param {number} id - ID do banner.
	 */
	public async deleteBanner(id: number): Promise<void> {
		try {
			const banner = await this.publicRepository.deleteBanner(id);
			if (banner && banner.image_url) {
				const relativePath = banner.image_url.replace(/^\/+/, "");
				const filePath = path.join(process.cwd(), relativePath);
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			}
		} catch (error) {
			this.logger.error(`Erro ao deletar banner: ${error}`);
			throw new InternalServerErrorException("Erro ao deletar o banner.");
		}
	}

	/**
	 * Atualiza o link de redirecionamento de um banner.
	 * @param {number} id - ID do banner.
	 * @param {string} linkUrl - Novo link.
	 */
	public async updateBannerLink(id: number, linkUrl: string): Promise<void> {
		try {
			await this.publicRepository.updateBannerLink(id, linkUrl);
		} catch (error) {
			this.logger.error(`Erro ao atualizar link do banner: ${error}`);
			throw new InternalServerErrorException(
				"Erro ao atualizar o link do banner.",
			);
		}
	}

	/**
	 * Atualiza a ordenação de múltiplos banners em lote.
	 *
	 * @param banners - Lista de objetos contendo ID e o novo índice de ordem.
	 */
	public async reorderBanners(
		banners: { id: number; order_index: number }[],
	): Promise<void> {
		const db = await this.publicRepository.getDatabase();
		try {
			await db.run("BEGIN TRANSACTION");

			for (const banner of banners) {
				await this.publicRepository.updateBannerOrder(
					banner.id,
					banner.order_index,
				);
			}

			await db.run("COMMIT");
		} catch (error) {
			await db.run("ROLLBACK");
			this.logger.error(`Erro ao reordenar banners: ${error}`);
			throw new InternalServerErrorException(
				"Erro ao salvar a nova ordem dos banners.",
			);
		}
	}

	/**
	 * Orquestra o upload de banners, validando a presença de arquivos e organizando as pastas.
	 *
	 * @param files - Lista de arquivos enviados.
	 * @param type - O tipo/contexto do banner (ex: hero-slider).
	 * @param body - Objeto contendo link e ordem (opcional).
	 * @returns Resultado do processamento de imagens.
	 */
	public async postBanner(
		files: Express.Multer.File[],
		type: string,
		body: any,
	): Promise<{ invalidImages: string[]; urlImages: string[]; failedUrls?: string[] }> {
		if (!files || files.length === 0) {
			throw new UnprocessableEntityException(
				"Nenhum arquivo de imagem foi enviado.",
			);
		}

		const folder = `shared/${type}`;
		const validationResult = await this.validateImages(files, folder);
		const result: { invalidImages: string[]; urlImages: string[]; failedUrls?: string[] } = validationResult;

		// Se houver imagens salvas com sucesso, persiste no banco de dados
		if (result.urlImages.length > 0) {
			const db = await this.publicRepository.getDatabase();
			try {
				await db.run("BEGIN TRANSACTION");

				const numNewBanners = result.urlImages.length;
				let currentOrder: number;

				if (body.order) {
					currentOrder = parseInt(body.order, 10);
					// Aqui o shiftOrderIndices é usado para "abrir espaço" de forma atômica
					await this.publicRepository.shiftOrderIndices(
						type,
						currentOrder,
						numNewBanners,
					);
				} else {
					currentOrder = (await this.publicRepository.getMaxOrder(type)) + 1;
				}

				const bannersToInsert = result.urlImages.map((url) => ({
					type,
					image_url: url,
					link_url: body.link,
					order_index: currentOrder++,
				}));

				try {
					await this.publicRepository.saveBanners(bannersToInsert);
					await db.run("COMMIT");
				} catch (bulkError) {
					this.logger.error(`Erro ao persistir banners em massa: ${bulkError}. Tentando fallback um a um.`);

					const failedUrls: string[] = [];
					for (const banner of bannersToInsert) {
						try {
							await this.publicRepository.saveBanner(banner);
						} catch (singleError) {
							this.logger.error(`Erro ao salvar o banner ${banner.image_url}: ${singleError}`);
							failedUrls.push(banner.image_url);
						}
					}
					await db.run("COMMIT");

					// Return the failedUrls so they can be processed by frontend as requested.
					result.failedUrls = failedUrls;
				}
			} catch (error) {
				await db.run("ROLLBACK");
				this.logger.error(`Erro ao persistir banners: ${error}`);
				throw new InternalServerErrorException(
					"Erro ao salvar dados dos banners.",
				);
			}
		}

		return result;
	}

	/**
	 * Coordena o pipeline de processamento de imagens do produto.
	 *
	 * @description
	 * O fluxo consiste em:
	 * 1. Filtragem: Separa arquivos válidos de inválidos via `validateProductFiles`.
	 * 2. Otimização: Converte imagens válidas para o formato WebP para reduzir o consumo de banda.
	 * 3. Persistência: Salva as imagens convertidas no storage e recupera as URLs públicas.
	 *
	 * @param {Express.Multer.File[]} images - Lista de arquivos binários recebidos na requisição.
	 * @param {string} folder - Nome da pasta dentro de 'static' onde as imagens serão salvas (padrão: 'shared').
	 * @returns {Promise<{ invalidImages: string[], urlImages: string[] }>}
	 * Objeto contendo a lista de nomes de arquivos inválidos e as URLs públicas das imagens salvas.
	 *
	 * @throws {InternalServerErrorException} Caso ocorra falha na conversão ou no upload das imagens.
	 */
	public async validateImages(
		images: Express.Multer.File[],
		folder: string = "shared",
	): Promise<{ invalidImages: string[]; urlImages: string[] }> {
		try {
			const { validImages, invalidImages } =
				await this.validateProductFiles(images);

			let urlImages: string[] = [];
			if (validImages.length > 0) {
				const convertedImages = await this.convertToWebp(validImages);
				urlImages = await this.saveImage(convertedImages, folder);
			}
			return { invalidImages, urlImages };
		} catch (error) {
			this.logger.error(`Erro ao processar imagens: ${error}`);
			throw new InternalServerErrorException("Erro ao processar imagens");
		}
	}

	/**
	 * Converte imagens compatíveis para o formato WebP.
	 *
	 * @description
	 * Processa a lista de imagens recebidas e converte para WebP todos os
	 * arquivos suportados, preservando a orientação original através da
	 * leitura dos metadados da imagem.
	 *
	 * Arquivos nos formatos AVIF, HEIF e HEIC são mantidos sem alterações,
	 * permitindo que sejam tratados posteriormente por fluxos específicos.
	 *
	 * Durante a conversão, o buffer da imagem é substituído pelo conteúdo
	 * gerado em WebP e o nome do arquivo é ajustado para refletir a nova
	 * extensão quando necessário.
	 *
	 * @param images Lista de imagens recebidas para processamento.
	 * @returns Promessa contendo a lista de arquivos convertidos para WebP.
	 */
	private async convertToWebp(
		images: Express.Multer.File[],
	): Promise<Express.Multer.File[]> {
		return Promise.all(
			images.map(async (image) => {
				if (
					["image/avif", "image/heif", "image/heic"].includes(image.mimetype)
				) {
					return image;
				}

				const isWebp = image.mimetype === "image/webp";

				const webpBuffer = await sharp(image.buffer, { failOnError: false })
					.rotate()
					.webp()
					.toBuffer();

				const originalNameWithoutExt = image.originalname.replace(
					/\.[^/.]+$/,
					"",
				);
				const finalName = isWebp
					? image.originalname
					: `${originalNameWithoutExt}.webp`;

				return {
					...image,
					buffer: webpBuffer,
					originalname: finalName,
					mimetype: "image/webp",
				};
			}),
		);
	}

	/**
	 * Persiste os buffers de imagem no sistema de arquivos local.
	 *
	 * @description
	 * Este método realiza a gestão de armazenamento local:
	 * 1. Define o diretório de destino (`static/[folder]`) de forma absoluta.
	 * 2. Garante a existência da estrutura de pastas de forma recursiva.
	 * 3. Gera nomes únicos para cada arquivo utilizando `Date.now()` e um hash randômico para evitar colisões.
	 * 4. Salva os arquivos de forma assíncrona e em paralelo.
	 *
	 * @param {Express.Multer.File[]} images - Lista de arquivos (preferencialmente convertidos para WebP).
	 * @param {string} folder - Subpasta dentro de 'static' onde as imagens serão armazenadas (padrão: 'shared').
	 * @returns {Promise<string[]>} Array de caminhos relativos (URLs) para acesso público das imagens.
	 *
	 * @private
	 */
	private async saveImage(
		images: Express.Multer.File[],
		folder: string = "shared",
	): Promise<string[]> {
		const uploadDir = path.join(process.cwd(), "static", folder);

		// Cria a pasta se não existir
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}

		// Salva todas as imagens em paralelo
		const savePromises = images.map(async (image) => {
			const ext = path.extname(image.originalname);

			const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}${ext}`;
			const filePath = path.join(uploadDir, uniqueName);

			// Usa writeFile assíncrono para não bloquear
			await fs.promises.writeFile(filePath, image.buffer);

			return `/static/${folder}/${uniqueName}`;
		});

		const urls = await Promise.all(savePromises);
		return urls;
	}

	/**
	 * Realiza a validação técnica de MIME type dos arquivos enviados.
	 *
	 * @description
	 * Diferente de uma validação superficial, este método utiliza o buffer do arquivo
	 * para identificar o tipo real (através de magic numbers).
	 * Apenas arquivos cujo MIME type inicia com "image/" são aceitos.
	 *
	 * @param {Express.Multer.File[]} images - Array de arquivos interceptados pelo Multer.
	 * @returns {Promise<ValidateProductFilesResult>} Objeto contendo:
	 * - `validImages`: Arquivos confirmados como imagens.
	 * - `invalidImages`: Lista de nomes dos arquivos que falharam na validação.
	 *
	 * @throws {BadRequestException} Se o array de imagens estiver vazio.
	 * @private
	 */
	private async validateProductFiles(
		images: Express.Multer.File[],
	): Promise<ValidateProductFilesResult> {
		if (!images.length) {
			this.logger.error("Nenhum arquivo de imagem encontrado");
			throw new BadRequestException("Nenhum arquivo de imagem encontrado");
		}

		const invalidImages: string[] = [];
		const validImages: Express.Multer.File[] = [];
		for (const image of images) {
			const result = await fileTypeFromBuffer(image.buffer);

			if (!result || !result.mime.startsWith("image/")) {
				invalidImages.push(image.originalname);
			} else {
				validImages.push(image);
			}
		}

		return { validImages, invalidImages };
	}

	/**
	 * Obtém a lista de cores cadastradas para os produtos.
	 *
	 * @description
	 * Solicita ao repositório a relação de cores disponíveis no sistema,
	 * utilizadas na composição das variações de produtos e em processos
	 * de cadastro, edição e exibição do catálogo.
	 *
	 * O método abstrai o acesso à camada de persistência e centraliza
	 * o tratamento de falhas relacionadas à consulta das cores.
	 *
	 * Em caso de erro durante a operação, registra a ocorrência no logger
	 * e lança uma exceção interna para tratamento pela aplicação.
	 *
	 * @returns Promessa contendo a lista de cores cadastradas.
	 */
	public async getColors() {
		try {
			return await this.productRepository.getColors();
		} catch (error) {
			this.logger.error(`Erro ao obter as cores dos produtos: ${error}`);
			throw new InternalServerErrorException("Erro ao obter as cores");
		}
	}

	/**
	 * Obtém a lista de clientes cadastrados no sistema.
	 *
	 * @description
	 * Solicita ao repositório a relação de usuários classificados como
	 * clientes, retornando informações básicas de identificação e dados
	 * agregados utilizados pela área administrativa, como a quantidade
	 * de endereços vinculados a cada cadastro.
	 *
	 * O método abstrai o acesso à camada de persistência e centraliza
	 * o tratamento de falhas relacionadas à consulta dos clientes.
	 *
	 * Em caso de erro durante a operação, registra a ocorrência no logger
	 * e lança uma exceção interna para tratamento pela aplicação.
	 *
	 * @returns Promessa contendo a lista de clientes cadastrados.
	 */
	public async getClients(): Promise<any[]> {
		try {
			return await this.userRepo.getClients();
		} catch (error) {
			this.logger.error(`Erro ao obter a lista de clientes: ${error}`);
			throw new InternalServerErrorException("Erro ao buscar clientes.");
		}
	}

	/**
	 * Valida se a quantidade informada é um número operacional válido.
	 *
	 * @description
	 * Realiza uma triagem rigorosa do input para garantir que a quantidade:
	 * 1. Seja conversível para o tipo `Number`.
	 * 2. Seja um valor positivo (maior que zero).
	 * 3. Não seja `NaN` ou `Infinity`.
	 *
	 * Esta validação é crucial antes de operações de persistência na tabela `product_colors`
	 * para evitar inconsistências no controle de estoque.
	 *
	 * @param {string} qtd - O valor da quantidade recebido (geralmente via payload de formulário).
	 * @returns {Promise<boolean>} Retorna `true` se a quantidade for um número finito e positivo.
	 *
	 * @private
	 */
	private async validateQtd(qtd: string): Promise<boolean> {
		const num = Number(qtd);

		return !isNaN(num) && num > 0 && Number.isFinite(num);
	}

	/**
	 * Valida e triagem a existência de um identificador de cor.
	 *
	 * @description
	 * Este método é uma função auxiliar (helper) utilizada durante o processamento em lote.
	 * Ele encapsula a chamada de validação no banco de dados e formata o resultado
	 * em um padrão de sucesso/falha, permitindo que o orquestrador identifique
	 * rapidamente quais IDs devem ser descartados ou logados.
	 *
	 * @param {string} id - O identificador da cor a ser validado.
	 * @returns {Promise<{ failsId: string | null, sucessId: string | null }>}
	 * Objeto de status contendo o ID no campo de falha ou sucesso, conforme o resultado da validação.
	 *
	 * @private
	 */
	processId = async (id: string) => {
		const isValidColor = await this.validateColors(id);
		if (!isValidColor) {
			this.logger.error(`Cor Inválida: ${id}`);
			return { failsId: id, sucessId: null };
		}
		return { failsId: null, sucessId: id };
	};

	/**
	 * Valida e formata o status da quantidade de um item para processamento em lote.
	 *
	 * @description
	 * Este método helper atua na camada de transformação de dados. Ele:
	 * 1. Invoca a validação lógica de quantidade (`validadeQtd`).
	 * 2. Caso o valor seja inválido (ex: não numérico, negativo ou infinito), registra um erro no Logger.
	 * 3. Retorna um objeto padronizado para que o orquestrador possa separar quantidades válidas de falhas.
	 *
	 * @param {string} qtd - A string representativa da quantidade a ser processada.
	 * @returns {{ failsQtd: string | null, sucessQtd: string | null }}
	 * Objeto contendo o valor original no campo de falha ou sucesso.
	 *
	 * @private
	 */
	processQtd = (qtd: string) => {
		const isValidQtd = this.validateQtd(qtd);
		if (!isValidQtd) {
			this.logger.error(`quantidade do produto inválido: ${qtd}`);
			return { failsQtd: qtd, sucessQtd: null };
		}
		return { failsQtd: null, sucessQtd: qtd };
	};

	/**
	 * Valida e triagem o tamanho de um item para processamento em lote.
	 *
	 * @description
	 * Este método helper integra a validação lógica de tamanhos (`validateSize`) ao
	 * fluxo de processamento de variantes. Ele permite que o orquestrador identifique
	 * rapidamente itens com grade fora do padrão (ex: tamanhos não mapeados ou erros de digitação)
	 * e os separe para o relatório de falhas.
	 *
	 * @param {string} size - A string representativa do tamanho (Ex: "M", "G").
	 * @returns {{ failsSize: string | null, successSize: string | null }}
	 * Objeto padronizado contendo o valor no campo de erro ou sucesso.
	 *
	 * @private
	 */
	processSize = (size: string) => {
		const isValidSize = this.validateSize(size);
		if (!isValidSize) {
			this.logger.error(`Tamanho do produto inválido: ${size}`);
			return { failsSize: size, successSize: null };
		}
		return { failsSize: null, successSize: size };
	};

	/**
	 * Converte a string bruta de variantes em um dicionário de objetos estruturados.
	 *
	 * @description
	 * Este método realiza o parsing de uma string composta por trios de informações
	 * (ID da Cor, Quantidade e Tamanho), separados por vírgula.
	 * Exemplo de entrada: `"1 10 M, 2 5 G"`
	 *
	 * O processo envolve:
	 * 1. Divisão da string principal por vírgulas.
	 * 2. Limpeza de espaços sobressalentes (`trim`).
	 * 3. Extração dos componentes de cada variante (ID, Qtd, Size).
	 * 4. Tipagem manual dos valores numéricos.
	 *
	 * @param {string} color - String serializada contendo a grade de variações.
	 * @returns {Promise<any[]>} Array de objetos contendo `{ color: number, quantity: number, size: string }`.
	 */
	public async processProdutos(color: string): Promise<any[]> {
		const listaCores = color.split(",");
		const dicionarioCores = new Array(listaCores.length);

		for (let i = 0; i < listaCores.length; i++) {
			const par = listaCores[i].trim();
			const espacoIdx = par.split(" ");

			if (espacoIdx.length === 3) {
				dicionarioCores[i] = {
					color: parseInt(espacoIdx[0], 10),
					quantity: parseInt(espacoIdx[1], 10),
					size: espacoIdx[2],
				};
			}
		}

		return dicionarioCores;
	}

	/**
	 * Orquestra a validação em lote das variantes de um produto.
	 *
	 * @description
	 * Este método percorre a lista de variantes processadas e aplica as regras de negócio
	 * para cada atributo (Cor, Quantidade e Tamanho). Ele atua como um filtro bidirecional:
	 * - Itens que passam em todas as validações críticas são enviados para `successResultValidation`.
	 * - Itens com inconsistências são movidos para `failResultValidation` para reporte de erros.
	 *
	 * @param {any[]} colors - Array de objetos estruturados `{ color, quantity, size }`.
	 * @returns {Promise<{ successResultValidation: any[]; failResultValidation: any[] }>}
	 * Um objeto contendo dois arrays: um com os dados validados e outro com as falhas encontradas.
	 *
	 * @private
	 */
	private async validateColorsForProduct(
		colors: any,
	): Promise<{ successResultValidation: any[]; failResultValidation: any[] }> {
		const failResultValidation: any[] = [];
		const successResultValidation: any = [];
		const batchSize = 50;

		for (let i = 0; i < colors.length; i += batchSize) {
			const batch = colors.slice(i, i + batchSize);
			const batchPromises = batch.map(async (item: any) => {
				const { color, quantity, size } = item;
				const [idResult, qtdResult, sizeResult] = await Promise.all([
					this.processId(color),
					this.processQtd(quantity),
					this.processSize(size)
				]);

				const { failsId, sucessId } = idResult;
				const { failsQtd, sucessQtd } = qtdResult;
				const { failsSize, successSize } = sizeResult;

				let successItem: any = null;
				let failItem: any = null;

				if (sucessId && sucessQtd) {
					successItem = {
						id: color,
						colorId: sucessId,
						quantity: sucessQtd,
						size: successSize,
					};
				}

				if (failsId && failsQtd) {
					failItem = {
						id: color,
						colorId: failsId,
						quantity: failsQtd,
						size: failsSize,
					};
				}
				return { successItem, failItem };
			});

			const results = await Promise.all(batchPromises);

			for (const res of results) {
				if (res.successItem) {
					successResultValidation.push(res.successItem);
				}
				if (res.failItem) {
					failResultValidation.push(res.failItem);
				}
			}
		}

		return { successResultValidation, failResultValidation };
	}

	/**
	 * Valida e coordena o fluxo de cadastro de um novo produto.
	 *
	 * @description
	 * O processo segue a ordem:
	 * 1. Validação de categoria;
	 * 2. Sanitização do nome;
	 * 3. Processamento de imagens (separando válidas de inválidas);
	 * 4. Persistência do produto;
	 * 5. Processamento e vínculo de cores/variantes.
	 *
	 * @param productData Objeto contendo os dados estruturados do produto (DTO).
	 * @param files Array de arquivos de imagem enviados via multipart.
	 *
	 * @returns {Promise<string>} Uma mensagem de status detalhando o sucesso ou avisos parciais.
	 *
	 * @throws {BadRequestException} Se a categoria for inexistente ou o nome estiver fora dos limites.
	 * @throws {InternalServerErrorException} Se houver falha crítica no repositório ou processamento.
	 */
	public async validateProduct(
		productData: CreateProductDto,
		files: Express.Multer.File[],
	): Promise<string> {
		try {
			// Tenta encontrar o ID da categoria pelo nome ou confirma se o ID existe
			const categories = await this.catalogRepository.getCategories();
			const foundCategory = categories.find(
				(cat) =>
					cat.id === Number(productData.categoria) ||
					cat.item.toLowerCase() ===
						String(productData.categoria).toLowerCase(),
			);

			if (!foundCategory) {
				this.logger.error(`Categoria não encontrada: ${productData.categoria}`);
				throw new BadRequestException("Categoria inválida");
			}

			// Atribui o ID numérico correto para satisfazer a constraint do banco
			productData.categoria = foundCategory.id;

			let invalidImages: string[] = [],
				urlImages: string[] = [];

			// Realiza a validação das imagens
			if (files && files.length > 0) {
				({ invalidImages, urlImages } = await this.validateImages(files));
			}

			let genID = await this.productRepository.addNewProduct(productData);

			// Faz o Post do produto
			if (urlImages && urlImages.length > 0) {
				await this.productRepository.postURL(urlImages, genID);
			}

			// Inicia uma variavel nova
			let dictColors: any[] = [];

			// Tramsforma os dados em um dicionario
			if (productData.cores) {
				dictColors = await this.processProdutos(productData.cores);
			}

			// Valida Cor, Quantidade e Tamanho
			let { successResultValidation, failResultValidation } =
				await this.validateColorsForProduct(dictColors);

			let failResultPost: any[] = [];
			let insertedIds: number[] = [];

			if (successResultValidation.length != 0) {
				const result = await this.productColorRepo.addNewProductColor(
					genID,
					successResultValidation,
				);

				failResultPost = result.failResultPost;
				insertedIds = result.insertedIds;
			}

			for (const variantId of insertedIds) {
				await this.search.updateSearchIndex(variantId);
			}

			// Inicia uma variavel nova
			let message: string = "";

			// Caso tenha alguma imagem inválida, monta mensagem e avisa o front
			if (invalidImages.length != 0) {
				message += `Houve algumas imagens inválidas: ${invalidImages}`;
			}

			// Caso tenha alguma validação inválida, monta mensagem e avisa o front
			if (failResultValidation.length != 0) {
				message += ` Alguns parâmetros estavam incorretos: ${failResultValidation}`;
			}

			// Caso tenha algum cadastro que deu erro, monta mensagem e avisa o front
			if (failResultPost && failResultPost.length != 0) {
				message += ` Houve alguns erros no cadastro: ${JSON.stringify(failResultPost)}`;
			}

			// Caso tenha alguma cor/quantidade/tamanho inválida, monta mensagem e avisa o front
			if (successResultValidation.length !== 0) {
				message = `Produto Cadastrado. ${message}`;
			}

			return message;
		} catch (error) {
			this.logger.error(`Erro ao postar produto: ${error}`);
			throw new BadRequestException(`Erro ao postar produto: ${error}`);
		}
	}

	/**
	 * Verifica a existência de uma categoria na base de dados.
	 *
	 * @description
	 * Este método recupera a lista completa de categorias através do `productRepository`
	 * e realiza uma busca linear para confirmar se o ID fornecido é válido.
	 *
	 * @param {number} category - O identificador único (ID) da categoria a ser validada.
	 * @returns {Promise<boolean>} Retorna `true` se a categoria existir, caso contrário `false`.
	 *
	 * @private
	 */
	private async validateCategory(category: number): Promise<boolean> {
		const categories = await this.catalogRepository.getCategories();
		return categories.some((cat) => cat.id === category);
	}

	private async validateColors(colorIdReceived: any): Promise<boolean> {
		const colorsList = await this.productRepository.getColors();

		const idToCompare = Number(colorIdReceived);

		return colorsList.some((color) => color.id === idToCompare);
	}

	/**
	 * Valida se o tamanho fornecido pertence à grade padrão da loja.
	 *
	 * @description
	 * Este método atua como um filtro de integridade para a grade de produtos.
	 * Os tamanhos aceitos seguem o padrão brasileiro de moda feminina:
	 * `PP`, `P`, `M`, `G`, `GG`.
	 *
	 * @param {string} size - A sigla do tamanho a ser validada (case-sensitive).
	 * @returns {boolean} Retorna `true` se o tamanho for válido, caso contrário `false`.
	 *
	 * @private
	 */
	private validateSize(size: string): boolean {
		const validSizes = ["PP", "P", "M", "G", "GG"];

		const sanitizedSize = size.trim().toUpperCase();

		return validSizes.includes(sanitizedSize);
	}

	public async postCategory(category: string): Promise<any> {
		let valid = await this.validateCategoryForPost(category);
		if (!valid) {
			throw new BadRequestException(
				"Categoria inválida, deve ser uma string com pelo menos 2 caracteres",
			);
		}

		try {
			return this.catalogRepository.postCategory(category);
		} catch (error) {
			throw new InternalServerErrorException(
				`Erro ao adicionar categoria: ${error}`,
			);
		}
	}

	private async validateCategoryForPost(category: string): Promise<boolean> {
		// 1. Limpeza e validação básica
		const normalizedCategory = category?.trim();

		if (!normalizedCategory || normalizedCategory.length < 2) {
			throw new BadRequestException(
				"A categoria deve ser um texto com pelo menos 2 caracteres.",
			);
		}

		// 2. Busca as categorias do banco
		const categories = await this.catalogRepository.getCategories();

		// 3. Verifica existência ignorando Maiúsculas/Minúsculas
		const alreadyExists = categories.some(
			(cat) => cat.item.toLowerCase() === normalizedCategory.toLowerCase(),
		);

		if (alreadyExists) {
			throw new ConflictException(
				`A categoria "${normalizedCategory}" já está cadastrada.`,
			);
		}

		return true; // Se chegou aqui, é válida e não existe duplicata
	}

	/**
	 * Cadastra uma nova cor no sistema.
	 *
	 * @description
	 * Realiza a validação dos dados informados para garantir que a cor
	 * atenda aos critérios mínimos exigidos pela aplicação antes de
	 * efetuar a persistência no banco de dados.
	 *
	 * Após a validação bem-sucedida, delega ao repositório a criação do
	 * registro da nova cor, que poderá ser utilizada na composição de
	 * variações e atributos dos produtos.
	 *
	 * Caso os dados informados sejam inválidos, lança uma exceção de
	 * requisição inválida. Em caso de falha durante a persistência,
	 * lança uma exceção interna para tratamento pela aplicação.
	 *
	 * @param body Dados da cor a ser cadastrada, incluindo nome e código da cor.
	 * @returns Promessa contendo o resultado da operação de cadastro.
	 */
	public async postColor(body: any): Promise<any> {
		let valid = await this.validateColorForPost(body.name, body.color);
		if (!valid) {
			throw new BadRequestException(
				"A cor deve ser um texto com pelo menos 2 caracteres.",
			);
		}

		try {
			return this.productRepository.postColor(body);
		} catch (error) {
			throw new InternalServerErrorException(`Erro ao adicionar cor: ${error}`);
		}
	}

	/**
	 * Valida a integridade e unicidade de uma nova cor antes do cadastro.
	 *
	 * @description
	 * Este método realiza uma validação em três etapas para garantir dados de alta qualidade:
	 * 1. **Normalização**: Remove espaços desnecessários e valida o comprimento mínimo do nome.
	 * 2. **Unicidade de Nome**: Verifica se o nome da cor (ex: "Vermelho") já existe, ignorando Case-Sensitivity.
	 * 3. **Unicidade de Valor**: Verifica se o valor representativo (ex: Hexadecimal "#FF0000") já foi vinculado a outra cor.
	 *
	 * @param {string} name - Nome amigável da cor (ex: "Azul Marinho").
	 * @param {string} color - Valor técnico da cor (ex: Código Hexadecimal ou classe CSS).
	 *
	 * @returns {Promise<boolean>} Retorna `true` se a cor for válida para cadastro.
	 *
	 * @throws {BadRequestException} Quando o nome fornecido é inválido ou curto demais.
	 * @throws {ConflictException} Quando o nome ou o código da cor já existem no banco de dados.
	 *
	 * @private
	 */
	private async validateColorForPost(
		name: string,
		color: string,
	): Promise<boolean> {
		// 1. Limpeza e validação básica
		const normalizedName = name?.trim();

		if (!normalizedName || normalizedName.length < 2) {
			throw new BadRequestException(
				"O nome da cor deve ser um texto com pelo menos 2 caracteres.",
			);
		}

		// 2. Busca as cores do banco
		const colors = await this.productRepository.getColors();

		// 3. Verifica existência ignorando Maiúsculas/Minúsculas
		const alreadyExists1 = colors.some(
			(c) => c.name.toLowerCase() === normalizedName.toLowerCase(),
		);

		if (alreadyExists1) {
			throw new ConflictException(
				`A cor com o nome "${normalizedName}" já está cadastrada.`,
			);
		}

		const alreadyExists2 = colors.some(
			(c) => c.color.toLowerCase() === color.toLowerCase(),
		);

		if (alreadyExists2) {
			throw new ConflictException(
				`A cor com a cor "${color}" já está cadastrada.`,
			);
		}

		return true;
	}

	/**
	 * Recupera a listagem completa de produtos com suas respectivas imagens principais.
	 * @returns {Promise<any[]>} Lista de produtos formatada para o catálogo.
	 * @throws {InternalServerErrorException} Caso ocorra uma falha na consulta ao banco de dados.
	 */
	public async getProducts(): Promise<any[]> {
		try {
			return await this.productRepository.getProducts();
		} catch (error) {
			this.logger.error(`Erro ao obter os produtos: ${error}`);
			throw new InternalServerErrorException("Erro ao obter os produtos");
		}
	}

	/**
	 * Atualiza um produto existente, incluindo dados básicos, mídias e variantes.
	 *
	 * @description
	 * Executa o fluxo completo de atualização de um produto, validando a categoria
	 * informada, atualizando os dados principais do cadastro, processando imagens,
	 * recriando as mídias associadas e substituindo todas as variações cadastradas.
	 *
	 * A operação é executada dentro de uma transação para garantir a consistência
	 * dos dados. Caso ocorra qualquer falha durante o processo, todas as alterações
	 * realizadas são revertidas através de rollback.
	 *
	 * Durante a atualização, também realiza validações de imagens e variantes,
	 * persiste novas combinações de cor e tamanho e atualiza o índice de busca
	 * para as novas variações cadastradas.
	 *
	 * Ao final da operação, retorna uma mensagem contendo eventuais avisos
	 * relacionados a imagens inválidas, inconsistências de validação ou erros
	 * pontuais ocorridos durante o processamento das variantes.
	 *
	 * @param productId Identificador do produto que será atualizado.
	 * @param productData Dados atualizados do produto, incluindo categoria, descrição, imagens e variantes.
	 * @param files Arquivos de imagem enviados para atualização das mídias do produto.
	 * @returns Mensagem indicando o resultado da operação e possíveis avisos de processamento.
	 */
	public async updateProduct(
		productId: number,
		productData: any,
		files: Express.Multer.File[],
	): Promise<string> {
		try {
			// Tenta encontrar a categoria pelo ID ou nome
			const categories = await this.catalogRepository.getCategories();
			const foundCategory = categories.find(
				(cat) =>
					cat.id === Number(productData.categoria) ||
					cat.item.toLowerCase() ===
						String(productData.categoria).toLowerCase(),
			);

			if (!foundCategory) {
				this.logger.error(`Categoria não encontrada: ${productData.categoria}`);
				throw new BadRequestException("Categoria inválida");
			}

			const categoryId = foundCategory.id;
			const parsedPrice = parseFloat(String(productData.preco));

			// Gerencia transação através do repositório
			await this.productRepository.beginTransaction();

			// 1. Atualiza dados básicos do produto usando o repositório
			await this.productRepository.updateProductBasicInfo(
				productId,
				productData.nome,
				parsedPrice,
				categoryId,
				productData.descricao || "",
			);

			// 2. Processamento das novas imagens
			let invalidImages: string[] = [],
				urlImages: string[] = [];
			if (files && files.length > 0) {
				({ invalidImages, urlImages } = await this.validateImages(files));
			}

			// 3. Atualizar imagens do produto (product_urls) usando o repositório
			await this.productRepository.deleteProductUrls(productId);

			const existingUrls: string[] = productData.existingImages
				? productData.existingImages
						.split(",")
						.filter((url: string) => url.trim().length > 0)
				: [];

			const finalUrls = [...existingUrls, ...urlImages];
			if (finalUrls.length > 0) {
				await this.productRepository.postURL(finalUrls, productId);
			}

			// 4. Atualizar cores/tamanhos (product_colors) usando o repositório
			await this.productRepository.deleteProductColors(productId);

			let dictColors: any[] = [];
			if (productData.cores) {
				dictColors = await this.processProdutos(productData.cores);
			}

			const { successResultValidation, failResultValidation } =
				await this.validateColorsForProduct(dictColors);

			let failResultPost: any[] = [];
			let insertedIds: number[] = [];

			if (successResultValidation.length !== 0) {
				const result = await this.productColorRepo.addNewProductColor(
					productId,
					successResultValidation,
				);
				failResultPost = result.failResultPost;
				insertedIds = result.insertedIds;
			}

			for (const variantId of insertedIds) {
				await this.search.updateSearchIndex(variantId);
			}

			await this.productRepository.commit();

			let message: string = "";
			if (invalidImages.length !== 0) {
				message += `Houve algumas imagens inválidas: ${invalidImages}`;
			}
			if (failResultValidation.length !== 0) {
				message += ` Alguns parâmetros estavam incorretos: ${failResultValidation}`;
			}
			if (failResultPost && failResultPost.length !== 0) {
				message += ` Houve alguns erros no cadastro: ${JSON.stringify(failResultPost)}`;
			}

			return message || "Produto atualizado com sucesso.";
		} catch (error) {
			try {
				await this.productRepository.rollback();
			} catch (e) {}
			this.logger.error(`Erro ao atualizar produto: ${error}`);
			throw new BadRequestException(`Erro ao atualizar produto: ${error}`);
		}
	}
}
