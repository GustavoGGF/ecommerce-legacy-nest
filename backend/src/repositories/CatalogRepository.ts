import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { DatabaseConnection } from "../infra/database";

/**
 * Repositório especializado na persistência e consulta de dados da tabela `catalog`.
 *
 * @description
 * Esta classe é a única responsável por executar operações SQL (CRUD) relacionadas a categorias.
 * Centraliza o acesso ao banco de dados para garantir que todas as regras de esquema
 * e transações sejam respeitadas para o catálogo.
 *
 * @category Database
 */
@Injectable()
export class CatalogRepository {
  private readonly logger = new Logger(CatalogRepository.name);

  private async getDatabase() {
    const db = await DatabaseConnection.getInstance();
    return db;
  }

  /**
   * Obtém todas as categorias do catálogo.
   * @returns Uma lista de todas as categorias (id, item).
   */
  public async getCategories(): Promise<any[]> {
    const db = await this.getDatabase();
    const query = `SELECT id, item, url from catalog`;
    try {
      return db.all(query);
    } catch (error) {
      this.logger.error(`Erro ao buscar o catálogo: ${error}`);
      throw new InternalServerErrorException(`Erro ao buscar o catálogo: ${error}`);
    }
  }

  /**
   * Obtém uma categoria específica pelo seu ID, incluindo a URL.
   * @param categoryId O ID da categoria a ser buscada.
   * @returns Os detalhes da categoria (id, item, url).
   */
  public async getCategoryById(categoryId: string): Promise<any> {
    const db = await this.getDatabase();
    const query = `SELECT id, item, url FROM catalog WHERE id = ?`;
    try {
      return await db.get(query, [categoryId]);
    } catch (error) {
      this.logger.error(`Erro ao buscar categoria por ID ${categoryId}: ${error}`);
      throw new InternalServerErrorException(`Erro ao buscar categoria por ID ${categoryId}`);
    }
  }

  /**
   * Cadastra uma nova categoria no catálogo.
   *
   * @description
   * Realiza a inserção de uma nova categoria na base de dados utilizando
   * o nome informado. A categoria é persistida na tabela de catálogo,
   * permitindo sua utilização em filtros, navegação e organização
   * dos produtos do e-commerce.
   *
   * Em caso de falha durante a operação, registra o erro no logger
   * e lança uma exceção interna para tratamento da aplicação.
   *
   * @param name Nome da categoria a ser cadastrada.
   * @returns Promessa resolvida após a persistência da categoria.
   */
  public async postCategory(name: string): Promise<any> {
    const db = await this.getDatabase();
    const query = `INSERT INTO catalog (item) VALUES (?)`;
    try {
      await db.run(query, [name]);
    } catch (error) {
      this.logger.error(`Erro ao cadastrar a categoria: ${error}`);
      throw new InternalServerErrorException(`Erro ao cadastrar a categoria: ${error}`);
    }
  }

  /**
   * Atualiza a URL da imagem associada a uma categoria do catálogo.
   *
   * @description
   * Realiza a persistência da URL de imagem vinculada a uma categoria
   * específica na base de dados, permitindo a personalização visual
   * da capa exibida no catálogo do e-commerce.
   *
   * Em caso de falha durante a atualização, registra o erro no logger
   * e lança uma exceção interna para tratamento da aplicação.
   *
   * @param id Identificador da categoria a ser atualizada.
   * @param url URL da imagem que será associada à categoria.
   * @returns Promessa resolvida após a atualização da categoria.
   */
  public async updateCategoryUrl(id: string, url: string): Promise<void> {
    const db = await this.getDatabase();
    const query = `UPDATE catalog SET url = ? WHERE id = ?`;
    try {
      await db.run(query, [url, id]);
    } catch (error) {
      this.logger.error(`Erro ao atualizar URL da categoria no banco: ${error}`);
      throw new InternalServerErrorException(`Erro ao atualizar URL da categoria: ${error}`);
    }
  }
}
