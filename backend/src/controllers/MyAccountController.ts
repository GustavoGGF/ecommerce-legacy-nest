import {
	Controller,
	UseGuards,
	Get,
	Logger,
	Post,
	Body,
	UseInterceptors,
	Put,
	Res,
	Param,
	ParseIntPipe,
	UploadedFiles,
} from "@nestjs/common";
import { JwtManagerGuard } from "../rules/JwtManagerGuard";
import { ManagerService } from "../services/ManagerService";
import { CatalogService } from "../services/CatalogService";
import { Response } from "express";
import { CreateProductDto } from "../models/Product";
import * as path from "path";
import {
	ApiBearerAuth,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../rules/JwtAuthGuard";
import { FilesInterceptor } from "@nestjs/platform-express";

@ApiTags("My Account")
@ApiBearerAuth()
@Controller("my-account")
export class MyAccountController {
	constructor(
		private readonly service: ManagerService,
		private readonly catalogService: CatalogService,
	) {}

	private readonly logger = new Logger(MyAccountController.name);

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Valida o token para retornar o HTML",
		description:
			"Retorna vazio, apenas para o HTML ser gerado no interceptor/pipe",
	})
	@ApiResponse({
		status: 200,
		description: "Token válido, prossegue com a geração.",
	})
	@ApiResponse({ status: 401, description: "Token inválido." })
	@UseGuards(JwtManagerGuard)
	@Get("my-account")
	public async getValidationMyAccount(): Promise<void> {}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Valida o token para retornar o HTML",
		description:
			"Retorna vazio, apenas para o HTML ser gerado no interceptor/pipe",
	})
	@ApiResponse({
		status: 200,
		description: "Token válido, prossegue com a geração.",
	})
	@ApiResponse({ status: 401, description: "Token inválido." })
	@UseGuards(JwtManagerGuard)
	@Get("management")
	public async getValidationManagement(@Res() res: Response): Promise<any> {
		const indexPath = path.join(
			process.cwd(),
			"client",
			"browser",
			"index.csr.html",
		);

		res.sendFile(indexPath, (err) => {
			if (err && !res.headersSent) {
				this.logger.error(`Erro ao enviar index.csr.html: ${err.message}`);
				res
					.status(404)
					.send(
						"Template Base (CSR) não encontrado. Verifique o build do frontend.",
					);
			}
		});
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Obtém a lista de cores cadastradas",
		description: "Retorna todos os cores cadastrados no sistema.",
	})
	@ApiResponse({
		status: 200,
		description: "Lista de cores retornada com sucesso.",
	})
	@ApiResponse({
		status: 401,
		description: "Não autorizado. Token JWT inválido ou ausente.",
	})
	@ApiResponse({ status: 500, description: "Erro ao obter as cores." })
	@UseGuards(JwtManagerGuard)
	@Get("management/get-colors")
	public async getColors(): Promise<any[]> {
		return await this.service.getColors();
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Realiza o Cadastro de Novos Produtos",
		description:
			"Valida os dados do produto e processa até 5 arquivos de imagem simultaneamente.",
	})
	@ApiConsumes("multipart/form-data")
	@ApiResponse({
		status: 201,
		description: "Produto cadastrado com sucesso.",
		type: String,
	})
	@ApiResponse({
		status: 400,
		description: "Algum campo é inválido./Erro não tratado.",
		type: String,
	})
	@ApiResponse({
		status: 502,
		description: "Erro ao salvar as imagens.",
		type: String,
	})
	@ApiBearerAuth("JwtManagerGuard")
	@UseGuards(JwtManagerGuard)
	@UseInterceptors(FilesInterceptor("files", 5))
	@Post("management/post-product")
	public async postProduct(
		@UploadedFiles() files: Express.Multer.File[],
		@Body() body: CreateProductDto,
	): Promise<string> {
		const message = await this.service.validateProduct(body, files);

		return message;
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Atualiza um Produto Existente",
		description:
			"Atualiza os metadados do produto, reconstrói as mídias e vincula cores/tamanhos.",
	})
	@ApiResponse({
		status: 200,
		description: "Produto atualizado com sucesso.",
		type: String,
	})
	@ApiBearerAuth("JwtManagerGuard")
	@UseGuards(JwtManagerGuard)
	@UseInterceptors(FilesInterceptor("files", 5))
	@Put("management/update-product/:id")
	public async updateProduct(
		@Param("id", ParseIntPipe) id: number,
		@UploadedFiles() files: Express.Multer.File[],
		@Body() body: any,
	): Promise<string> {
		const message = await this.service.updateProduct(id, body, files);

		return message;
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Realiza o Cadastro de Novas Categorias",
		description:
			"Valida os dados da categoria e processa até 5 arquivos de imagem simultaneamente.",
	})
	@ApiConsumes("multipart/form-data")
	@ApiResponse({
		status: 201,
		description: "Categoria cadastrada com sucesso.",
		type: String,
	})
	@ApiResponse({
		status: 400,
		description: "Algum campo é inválido./Erro não tratado.",
		type: String,
	})
	@ApiResponse({
		status: 409,
		description: "A categoria já foi cadastrada.",
		type: String,
	})
	@ApiResponse({
		status: 502,
		description: "Erro ao salvar as imagens.",
		type: String,
	})
	@ApiBearerAuth("JwtManagerGuard")
	@UseGuards(JwtManagerGuard)
	@UseInterceptors(FilesInterceptor("files", 5))
	@Post("management/add-category")
	public async postCategory(@Body() body: { name: string }): Promise<any> {
		return await this.service.postCategory(body.name);
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Realiza o Cadastro de Novas Cores",
		description:
			"Valida os dados da cor e processa até 5 arquivos de imagem simultaneamente.",
	})
	@ApiConsumes("multipart/form-data")
	@ApiResponse({
		status: 201,
		description: "Cor cadastrada com sucesso.",
		type: String,
	})
	@ApiResponse({
		status: 400,
		description: "Algum campo é inválido./Erro não tratado.",
		type: String,
	})
	@ApiResponse({
		status: 502,
		description: "Erro ao salvar as imagens.",
		type: String,
	})
	@ApiBearerAuth("JwtManagerGuard")
	@UseGuards(JwtManagerGuard)
	@Post("management/add-color")
	public async postColor(
		@Body() body: { name: string; color: string },
	): Promise<any> {
		return await this.service.postColor(body);
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Obtém a lista de produtos",
		description:
			"Retorna todos os produtos cadastrados no sistema, incluindo a URL da imagem principal.",
	})
	@ApiResponse({
		status: 200,
		description: "Lista de produtos retornada com sucesso.",
	})
	@ApiResponse({
		status: 401,
		description: "Não autorizado. Token JWT inválido ou ausente.",
	})
	@ApiResponse({ status: 500, description: "Erro ao obter os produtos." })
	@Get("management/get-products")
	@UseGuards(JwtAuthGuard)
	public async getProducts(): Promise<any[]> {
		return await this.service.getProducts();
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Atualiza a imagem de capa de uma categoria",
		description:
			"Vincula uma URL de imagem a uma categoria específica no catálogo.",
	})
	@ApiResponse({
		status: 200,
		description: "URL da categoria atualizada com sucesso.",
	})
	@ApiResponse({
		status: 401,
		description: "Não autorizado. Token JWT inválido ou ausente.",
	})
	@ApiResponse({
		status: 500,
		description: "Erro ao atualizar a URL da categoria.",
	})
	@Put("management/roll-brand-catalog/:categoryItem/:categoryId")
	@UseGuards(JwtManagerGuard)
	public async updateCategoryUrl(
		@Param("categoryId") categoryId: string,
		@Body("url") url: string,
	) {
		return await this.catalogService.updateCategoryUrl(categoryId, url);
	}

	@ApiTags("My Account")
	@ApiOperation({
		summary: "Lista clientes cadastrados (sem dados sensíveis)",
		description:
			"Retorna id, username, perfil e quantidade de endereços de cada cliente. Nenhum dado sensível (e-mail, senha, telefone) é exposto.",
	})
	@ApiResponse({
		status: 200,
		description: "Lista de clientes retornada com sucesso.",
	})
	@Get("management/get-clients")
	@UseGuards(JwtManagerGuard)
	public async getClients(): Promise<any[]> {
		return await this.service.getClients();
	}
}
