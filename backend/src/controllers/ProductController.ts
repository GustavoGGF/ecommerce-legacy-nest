import { Controller, Get, Param, ParseIntPipe, NotFoundException } from "@nestjs/common";
import { PublicService } from "../services/PublicService";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("Products")
@Controller("public/products")
export class ProductController {
  constructor(private readonly publicService: PublicService) {}

  @ApiOperation({
    summary: "Obtém detalhes de um produto específico pelo ID",
  })
  @ApiResponse({
    status: 200,
    description: "Detalhes do produto retornados com sucesso.",
  })
  @ApiResponse({ status: 404, description: "Produto não encontrado." })
  @ApiResponse({ status: 500, description: "Erro ao buscar dados do produto" })
  @Get(":id")
  public async getProductById(@Param("id", ParseIntPipe) id: number) {
    const product = await this.publicService.getProductById(id);
    if (!product) {
      throw new NotFoundException("Produto não encontrado.");
    }
    return product;
  }
}
