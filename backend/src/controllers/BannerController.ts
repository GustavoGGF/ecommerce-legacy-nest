import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Param,
	Body,
	UseGuards,
	UseInterceptors,
	UploadedFiles,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
	ApiBearerAuth,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { JwtManagerGuard } from "../rules/JwtManagerGuard";
import { ManagerService } from "../services/ManagerService";

@ApiTags("Banners")
@ApiBearerAuth()
@UseGuards(JwtManagerGuard)
@Controller("my-account/management/banners")
export class BannerController {
	constructor(private readonly service: ManagerService) {}

	@ApiOperation({
		summary: "Realiza o upload e configuração de banners",
		description:
			"Processa imagens para carrosséis dinâmicos (ex: hero-slider), converte para WebP e armazena metadados como link e ordem.",
	})
	@ApiConsumes("multipart/form-data")
	@ApiResponse({
		status: 201,
		description: "Banners processados e salvos com sucesso.",
	})
	@ApiResponse({
		status: 422,
		description: "Nenhum arquivo enviado ou validação de imagem falhou.",
	})
	@ApiResponse({
		status: 500,
		description: "Erro interno ao processar imagens.",
	})
	@Post(":type")
	@UseInterceptors(FilesInterceptor("banners", 5))
	public async postBanner(
		@Param("type") type: string,
		@UploadedFiles() files: Express.Multer.File[],
		@Body() body: any,
	) {
		return await this.service.postBanner(files, type, body);
	}

	@ApiOperation({
		summary: "Obtém todos os banners de um tipo para gestão",
		description:
			"Retorna banners ativos e inativos para listagem no painel administrativo.",
	})
	@ApiConsumes("application/json")
	@ApiResponse({
		status: 200,
		description: "Lista de banners retornada com sucesso.",
	})
	@ApiResponse({
		status: 500,
		description: "Erro ao buscar a lista de banners.",
	})
	@Get(":type")
	public async getBanners(@Param("type") type: string): Promise<any[]> {
		return await this.service.getBanners(type);
	}

	@ApiOperation({
		summary: "Remove um banner do sistema",
		description: "Deleta o registro do banco e o arquivo físico associado.",
	})
	@ApiConsumes("application/json")
	@ApiResponse({ status: 200, description: "Banner removido com sucesso." })
	@ApiResponse({ status: 500, description: "Erro ao deletar o banner." })
	@Delete(":id")
	public async deleteBanner(@Param("id") id: number) {
		return await this.service.deleteBanner(id);
	}

	@ApiOperation({
		summary: "Atualiza o link de redirecionamento de um banner",
		description: "Altera o campo link_url do banner no banco de dados.",
	})
	@ApiConsumes("application/json")
	@ApiResponse({ status: 200, description: "Link atualizado com sucesso." })
	@ApiResponse({
		status: 500,
		description: "Erro ao atualizar o link do banner.",
	})
	@Put("link/:id")
	public async updateBannerLink(
		@Param("id") id: number,
		@Body("link_url") linkUrl: string,
	) {
		return await this.service.updateBannerLink(id, linkUrl);
	}

	@ApiOperation({
		summary: "Reordena a lista de banners",
		description:
			"Recebe uma lista de banners com seus novos índices de ordenação.",
	})
	@ApiResponse({
		status: 200,
		description: "Ordenação atualizada com sucesso.",
	})
	@ApiResponse({ status: 500, description: "Erro ao reordenar os banners." })
	@Put("reorder")
	public async reorderBanners(
		@Body() banners: { id: number; order_index: number }[],
	) {
		return await this.service.reorderBanners(banners);
	}
}
