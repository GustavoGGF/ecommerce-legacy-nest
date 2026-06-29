import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PublicBannerService } from "../services/PublicBannerService";

@ApiTags("Public Banners")
@Controller("/public/banner")
export class PublicBannersController {
  constructor(private readonly service: PublicBannerService) {}

  @ApiOperation({
    summary: "Obtém banners por tipo para exibição pública",
    description:
      "Retorna todos os banners de um tipo específico (ex: 'promotional'), ordenados pelo índice de exibição.",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de banners retornada com sucesso.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar os banners.",
  })
  @Get(":type")
  public async getBanners(@Param("type") type: string): Promise<any[]> {
    return await this.service.getBannersByType(type);
  }
}
