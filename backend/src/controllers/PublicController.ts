import { Controller, Get, Param, Query, Request, UseInterceptors } from "@nestjs/common";
import { PublicService } from "../services/PublicService";
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { ProductColorsService } from "../services/ProductColorsService";

@ApiTags("Public")
@Controller("public")
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly pcService: ProductColorsService,
  ) {}

  @ApiTags("Public")
  @ApiOperation({
    summary: "Busca global de produtos",
    description:
      "Pesquisa por termos no índice de busca (FTS5) abrangendo nome, descrição, categoria, cor e tamanho.",
  })
  @ApiResponse({
    status: 200,
    description: "Produtos encontrados com base no termo de pesquisa.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao realizar a busca.",
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @Get("search")
  public async search(@Query("q") q: string) {
    const query = q?.trim();
    if (!query || query.length < 2) {
      return [];
    }

    return await this.publicService.searchProducts(query);
  }

  @ApiTags("Public")
  @ApiOperation({
    summary: "Obtém a lista de banners por tipo",
    description:
      "Retorna todos os banners ativos para um tipo específico (ex: hero-slider), ordenados por índice de exibição.",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de banners retornada com sucesso.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar os banners.",
  })
  @Get("banners/:type")
  public async getBanners(@Param("type") type: string) {
    return await this.publicService.getBanners(type);
  }

  @ApiTags("Public")
  @ApiOperation({
    summary: "Obtém produtos por categoria com paginação",
    description:
      "Retorna uma lista de produtos filtrados por categoria, permitindo definir a página e a quantidade de itens por vez.",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de produtos e metadados de paginação.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar os produtos.",
  })
  @Get("products/category/:categoryType")
  public async getProductsByCategory(
    @Param("categoryType") category: string, // 'categoryType' é o nome do parâmetro na URL, 'category' é o nome da variável
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "20",
    @Query("colors") colors?: string,
    @Query("sizes") sizes?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string,
  ) {
    // Convertemos os parâmetros para número para garantir a segurança na lógica do serviço
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20)); // Travamos o máximo em 100 por segurança

    const colorsArray = colors ? colors.split(",") : [];
    const sizesArray = sizes ? sizes.split(",") : [];
    const min = minPrice ? parseFloat(minPrice) : null;
    const max = maxPrice ? parseFloat(maxPrice) : null;

    return await this.publicService.getProductsByCategory(
      category,
      pageNum,
      limitNum,
      colorsArray,
      sizesArray,
      min,
      max,
    );
  }

  @ApiTags("Public")
  @ApiOperation({
    summary: "Obtém os filtros disponíveis para uma categoria",
    description: "Retorna cores e contagens de produtos para popular o componente de filtro.",
  })
  @ApiResponse({ status: 200, description: "Filtros retornados com sucesso." })
  @ApiResponse({ status: 500, description: "Erro interno ao buscar filtros." })
  @Get("filters/category/:categoryType")
  public async getCategoryFilters(@Param("categoryType") category: string) {
    return await this.publicService.getCategoryFilters(category);
  }

  @ApiTags("Public")
  @ApiOperation({
    summary: "Obtém produtos com baixo estoque",
    description:
      "Retorna até 20 produtos com estoque abaixo do limite definido no ambiente, ordenados do menor para o maior.",
  })
  @ApiConsumes("application/json")
  @ApiResponse({
    status: 200,
    description: "Lista de produtos com baixo estoque.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar produtos com baixo estoque.",
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(900)
  @Get("products/low-stock")
  public async getLowStockProducts() {
    return await this.publicService.getLowStockProducts();
  }

  @ApiConsumes("application/json")
  @ApiOperation({
    summary: "Obtém os produtos mais vendidos",
    description: "Retorna o ranking dos produtos mais vendidos do mês vigente.",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de produtos mais vendidos retornada com sucesso.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar produtos mais vendidos.",
  })
  @Get("products/best-sellers")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3000)
  public async getBestSellers() {
    return await this.publicService.getBestSellers();
  }

  @ApiOperation({
    summary: "Obtém os lançamentos",
    description: "Retorna os 10 produtos mais recentes cadastrados no sistema.",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de novos produtos retornada com sucesso.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar novos produtos.",
  })
  @Get("products/new-arrivals")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(900)
  public async getNewArrivals() {
    return await this.publicService.getNewArrivals();
  }

  @ApiOperation({
    summary: "Obtém produtos em promoção",
    description: "Retorna uma lista de até 10 produtos que possuem descontos ativos.",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de promoções retornada com sucesso.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar promoções.",
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600)
  @Get("products/promotions")
  public async getPromotions() {
    return await this.publicService.getPromotions();
  }

  @ApiOperation({
    summary: "Obtém as categorias cadastradas",
    description: "Retorna uma lista de todas as categorias.",
  })
  @ApiResponse({
    status: 200,
    description: "Lista de categorias retornada com sucesso.",
  })
  @ApiResponse({
    status: 500,
    description: "Erro interno ao buscar categorias.",
  })
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @Get("get-category")
  public async getInfo(@Request() req: any): Promise<any[]> {
    return await this.publicService.getCategories();
  }

  @ApiOperation({
    summary: "Obtém categorias para o catálogo de marcas",
    description: "Retorna a lista de categorias para exibir as capas no catálogo.",
  })
  @ApiResponse({ status: 200, description: "Categoria retornada com sucesso." })
  @ApiResponse({ status: 500, description: "Erro ao obter a categoria" })
  @Get("get-category-selected/:categoryId")
  public async getCategorySelected(@Param("categoryId") categoryId: string) {
    return await this.publicService.getCategoryById(categoryId);
  }

  @ApiOperation({
    summary: "Obtém o estoque máximo de um produto ou de todos",
  })
  @ApiResponse({
    status: 200,
    description: "Quantidade máxima de estoque retornada.",
  })
  @Get(["get-max-stock", "get-max-stock/:productId"])
  public async getMaxStock(@Param("productId") productId?: string) {
    const id = productId ? parseInt(productId, 10) : undefined;
    return await this.pcService.getMaxStock(id);
  }
}
