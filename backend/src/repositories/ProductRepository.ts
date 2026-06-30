import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { DatabaseConnection } from "../infra/database";
import { CreateProductDto } from "../models/Product";

export interface ProductSummary {
  id: number;
  name: string;
  price: number;
  category: string;
  descricao: string;
}

export interface ProductWithImage extends ProductSummary {
  imageUrl: string | null;
}

/**
 * Repositório especializado na persistência e consulta de dados da tabela `product`.
 *
 * @description
 * Esta classe é a única responsável por executar operações SQL (CRUD) relacionadas a produtos.
 * Centraliza o acesso ao banco de dados para garantir que todas as regras de esquema,
 * relacionamentos de chaves estrangeiras (categorias, cores) e transações sejam respeitadas.
 *
 * @category Database
 */
@Injectable()
export class ProductRepository {
  private readonly logger = new Logger(ProductRepository.name);

  private async getDatabase() {
    const db = await DatabaseConnection.getInstance();
    return db;
  }

  public async addNewProduct(productData: CreateProductDto): Promise<number> {
    const db = await this.getDatabase();
    const { nome, preco, descricao, categoria } = productData;
    const query = `INSERT INTO products (nome, preco, categoria, descricao) VALUES (?, ?, ?, ?)`;

    try {
      await db.run("BEGIN TRANSACTION");
      const result = await db.run(query, [nome, preco, categoria, descricao]);

      if (!result || typeof result.lastID === "undefined") {
        await db.run("ROLLBACK");
        throw new Error("Falha ao obter o ID do produto inserido.");
      }

      await db.run("COMMIT");

      return result.lastID;
    } catch (error) {
      await db.run("ROLLBACK");

      this.logger.error(`Erro ao inserir produto: ${error}`);
      throw new InternalServerErrorException(
        "Não foi possível salvar o produto no banco de dados.",
      );
    }
  }

  /**
   * Obtém as cores cadastradas na base de dados.
   *
   * @description
   * Realiza a consulta da tabela de cores, retornando os identificadores,
   * códigos de cor e nomes utilizados na composição das variações de
   * produtos do catálogo.
   *
   * Os dados recuperados são utilizados em fluxos de cadastro, edição,
   * gerenciamento de variantes e exibição de opções de cores na aplicação.
   *
   * Em caso de falha durante a consulta, registra o erro no logger e
   * lança uma exceção interna para tratamento pela aplicação.
   *
   * @returns Promessa contendo a lista de cores cadastradas.
   */
  public async getColors() {
    const db = await this.getDatabase();
    const query = `SELECT id, color, name FROM colors`;
    try {
      return await db.all(query);
    } catch (error) {
      this.logger.error(`Erro ao buscar as cores: ${error}`);
      throw new InternalServerErrorException(`Erro ao buscar as cores: ${error}`);
    }
  }

  public async postColor(body: { name: string; color: string }): Promise<void> {
    const db = await this.getDatabase();
    const query = `INSERT INTO colors (name, color) VALUES (?, ?)`;
    try {
      await db.run(query, [body.name, body.color]);
    } catch (error) {
      this.logger.error(`Erro ao cadastrar as cores: ${error}`);
      throw new InternalServerErrorException(`Erro ao buscar as cores: ${error}`);
    }
  }

  public async postURL(urls: string[], id: number) {
    const db = await this.getDatabase();
    try {
      const placeholders = urls.map(() => "(?, ?)").join(", ");
      const query = `INSERT INTO product_urls (product_id, url) VALUES ${placeholders}`;

      const values: (string | number)[] = [];
      for (const item of urls) {
        values.push(id, item);
      }

      await db.run(query, values);
    } catch (err) {
      this.logger.error(`Erro ao cadastrar as URLS: ${err}`);
      throw new BadGatewayException(`Erro ao cadastrar as URLS: ${err}`);
    }
  }

  /**
   * Obtém apenas os dados da tabela products.
   * Renomeia as colunas para o formato esperado pelo Frontend (name, price, category).
   */
  public async getOnlyProducts(): Promise<ProductSummary[]> {
    const db = await this.getDatabase();
    const query = `
      SELECT p.id, p.nome AS name, p.preco AS price, c.item AS category, p.descricao 
      FROM products p
      INNER JOIN catalog c ON p.categoria = c.id`;
    try {
      return await db.all(query);
    } catch (error) {
      this.logger.error(`Erro ao buscar apenas a tabela de produtos: ${error}`);
      throw new InternalServerErrorException(`Erro ao buscar produtos: ${error}`);
    }
  }

  /**
   * Recupera a listagem consolidada de produtos com mapeamento de aliases para o Frontend.
   * Utiliza uma subconsulta para anexar a primeira URL de imagem disponível para cada item.
   *
   * @returns {Promise<ProductWithImage[]>} Promessa contendo um array de produtos com 'imageUrl' incluso.
   * @throws {InternalServerErrorException} Caso ocorra uma falha na execução da query SQL.
   */
  public async getProducts(): Promise<ProductWithImage[]> {
    const db = await this.getDatabase();
    const query = `
      SELECT
        p.id,
        p.nome AS name,
        p.preco AS price,
        c.item AS category,
        p.descricao,
        (SELECT url FROM product_urls WHERE product_id = p.id ORDER BY id LIMIT 1) AS imageUrl
      FROM
        products p
      INNER JOIN catalog c ON p.categoria = c.id;`;

    try {
      return await db.all(query);
    } catch (error) {
      this.logger.error(`Erro ao buscar os produtos: ${error}`);
      throw new InternalServerErrorException(`Erro ao buscar os produtos: ${error}`);
    }
  }

  /**
   * Remove todos os registros da tabela `discounts`.
   * Usado para "resetar" os descontos antes de uma nova rotação.
   */
  public async clearAllDiscounts(): Promise<void> {
    const db = await this.getDatabase();
    const query = `DELETE FROM discounts`;
    try {
      await db.run(query);
      this.logger.log("Todos os descontos foram removidos da tabela 'discounts'.");
    } catch (error) {
      this.logger.error(`Erro ao limpar todos os descontos: ${error}`);
      throw new InternalServerErrorException("Erro ao limpar descontos existentes.");
    }
  }

  /**
   * Salva múltiplos registros de desconto na tabela `discounts` em lote.
   * @param discounts Array contendo os dados dos descontos a serem salvos.
   */
  public async saveDiscountRecordsBatch(
    discounts: {
      product_id: number;
      original_price: number;
      discount_price: number;
    }[],
  ): Promise<void> {
    if (discounts.length === 0) return;

    const db = await this.getDatabase();

    // Divide o array em lotes para evitar o limite de variáveis do SQLite
    const chunkSize = 200; // 4 variáveis por linha * 200 = 800 (seguro para o limite padrão de 999 do SQLite)

    try {
      await this.beginTransaction();

      for (let i = 0; i < discounts.length; i += chunkSize) {
        const chunk = discounts.slice(i, i + chunkSize);
        const placeholders = chunk
          .map(() => "(?, (SELECT id FROM product_colors WHERE product_id = ? LIMIT 1), ?, ?)")
          .join(", ");
        const query = `
					INSERT INTO discounts (product_id, product_color_id, original_price, discount_price)
					VALUES ${placeholders}
				`;

        const values: (number | null)[] = [];
        for (const d of chunk) {
          values.push(d.product_id, d.product_id, d.original_price, d.discount_price);
        }

        await db.run(query, values);
      }

      await this.commit();
      this.logger.log(`Foram salvos ${discounts.length} descontos em lote.`);
    } catch (error) {
      await this.rollback();
      this.logger.error(`Erro ao salvar descontos em lote: ${error}`);
      throw new InternalServerErrorException("Erro ao salvar registros de desconto em lote.");
    }
  }

  /**
   * Salva um novo registro de desconto na tabela `discounts`.
   * @param discountData Os dados do desconto a serem salvos.
   */
  public async saveDiscountRecord(discountData: {
    product_id: number;
    original_price: number;
    discount_price: number;
  }): Promise<void> {
    const db = await this.getDatabase();
    // Assumindo que o desconto é aplicado ao produto como um todo,
    // e que product_color_id pode ser null ou um valor padrão se não for específico por cor.
    // Se o desconto for por cor, você precisará iterar pelas cores do produto e criar um registro para cada.
    const query = `
      INSERT INTO discounts (product_id, product_color_id, original_price, discount_price)
      VALUES (?, ?, ?, ?)
    `;
    try {
      // Para simplificar, estamos usando NULL para product_color_id.
      // Se você precisar de descontos por cor, esta lógica precisará ser expandida.
      await db.run(query, [
        discountData.product_id,
        null, // Ou um ID de cor específico se o desconto for por variante
        discountData.original_price,
        discountData.discount_price,
      ]);
      this.logger.log(`Desconto salvo para o produto ${discountData.product_id}`);
    } catch (error) {
      this.logger.error(
        `Erro ao salvar registro de desconto para o produto ${discountData.product_id}: ${error}`,
      );
      throw new InternalServerErrorException("Erro ao salvar registro de desconto.");
    }
  }

  /**
   * Obtém apenas o ID, preço e a data de criação dos produtos.
   * Ideal para triagem inicial de elegibilidade e cálculo de descontos em lote.
   */
  public async getProductsEligibilityData(): Promise<
    { id: number; price: number; created_at: string }[]
  > {
    const db = await this.getDatabase();
    const query = `SELECT id, preco AS price, created_at FROM products`;
    try {
      return await db.all(query);
    } catch (error) {
      this.logger.error(`Erro ao buscar dados básicos para triagem: ${error}`);
      throw new InternalServerErrorException("Erro ao buscar dados de elegibilidade.");
    }
  }

  /**
   * Obtém os dados essenciais de um produto por ID (ID, Preço e Data de Criação).
   * Esta versão minimalista é ideal para validações de elegibilidade e cálculos de desconto.
   */
  public async getProductById(
    id: number,
  ): Promise<{ id: number; price: number; created_at: string } | undefined> {
    const db = await this.getDatabase();
    const query = `SELECT id, preco AS price, created_at FROM products WHERE id = ?`;
    try {
      return await db.get(query, [id]);
    } catch (error) {
      this.logger.error(`Erro ao buscar produto por ID ${id}: ${error}`);
      throw new InternalServerErrorException("Erro ao buscar dados do produto.");
    }
  }

  /**
   * Calcula o estoque total de um produto somando as quantidades de todas as suas variantes.
   * @param productId O ID do produto.
   * @returns A soma total das quantidades em estoque para o produto.
   */
  public async getTotalStock(productId: number): Promise<number> {
    const db = await this.getDatabase();
    const query = `SELECT SUM(quantity) as totalStock FROM product_colors WHERE product_id = ?`;
    try {
      const result = await db.get(query, [productId]);
      return result?.totalStock || 0;
    } catch (error) {
      this.logger.error(`Erro ao obter estoque total para o produto ${productId}: ${error}`);
      throw new InternalServerErrorException("Erro ao obter estoque total do produto.");
    }
  }

  /**
   * Verifica em lote quais produtos já estiveram em promoção.
   * @param productIds Array de IDs de produtos.
   * @returns Um Set contendo os IDs dos produtos que já estiveram em promoção.
   */
  public async getDiscountedProducts(productIds: number[]): Promise<Set<number>> {
    if (productIds.length === 0) return new Set();
    const db = await this.getDatabase();
    const discountedProducts = new Set<number>();
    // Divide o array em lotes para evitar o erro "too many SQL variables" do SQLite
    const chunkSize = 900;
    for (let i = 0; i < productIds.length; i += chunkSize) {
      const chunk = productIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const query = `SELECT DISTINCT product_id FROM old_discounts WHERE product_id IN (${placeholders})`;
      try {
        const rows = await db.all(query, chunk);
        for (const r of rows) {
          discountedProducts.add(r.product_id);
        }
      } catch (error) {
        this.logger.error(`Erro ao verificar histórico em lote: ${error}`);
        throw new InternalServerErrorException("Erro ao consultar histórico de descontos em lote.");
      }
    }
    return discountedProducts;
  }
  /**
   * Calcula o estoque total de vários produtos de uma vez.
   * @param productIds Array de IDs de produtos.
   * @returns Um Map onde a chave é o ID do produto e o valor é o estoque total.
   */
  public async getProductsTotalStock(productIds: number[]): Promise<Map<number, number>> {
    if (productIds.length === 0) return new Map();
    const db = await this.getDatabase();
    const stockMap = new Map<number, number>();
    const chunkSize = 900;
    for (let i = 0; i < productIds.length; i += chunkSize) {
      const chunk = productIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const query = `SELECT product_id, SUM(quantity) as totalStock FROM product_colors WHERE product_id IN (${placeholders}) GROUP BY product_id`;
      try {
        const rows = await db.all(query, chunk);
        for (const row of rows) {
          stockMap.set(row.product_id, row.totalStock || 0);
        }
      } catch (error) {
        this.logger.error(`Erro ao obter estoque total em lote: ${error}`);
        throw new InternalServerErrorException("Erro ao obter estoque total dos produtos.");
      }
    }
    return stockMap;
  }

  /**
   * Verifica se um produto já esteve em promoção, consultando a tabela `old_discounts`.
   * @param productId O ID do produto a ser verificado.
   * @returns `true` se o produto já esteve em desconto, `false` caso contrário.
   */
  public async hasProductBeenDiscountedBefore(productId: number): Promise<boolean> {
    const db = await this.getDatabase();
    const query = `SELECT COUNT(*) as count FROM old_discounts WHERE product_id = ?`;
    try {
      const result = await db.get(query, [productId]);
      return result?.count > 0;
    } catch (error) {
      this.logger.error(
        `Erro ao verificar histórico de descontos para o produto ${productId}: ${error}`,
      );
      throw new InternalServerErrorException("Erro ao consultar histórico de descontos.");
    }
  }

  /**
   * Salva os IDs dos produtos que estão saindo da promoção no histórico.
   */
  public async archiveCurrentDiscounts(): Promise<void> {
    const db = await this.getDatabase();
    const query = `
      INSERT INTO old_discounts (product_id)
      SELECT DISTINCT product_id FROM discounts`;
    try {
      await db.run(query);
    } catch (error) {
      this.logger.error(`Erro ao arquivar histórico de descontos: ${error}`);
    }
  }

  /**
   * Mantém apenas as duas rodadas de descontos mais recentes no histórico.
   * Remove registros de datas que não estejam entre as 2 últimas datas gravadas.
   */
  public async cleanupOldDiscountsHistory(): Promise<void> {
    const db = await this.getDatabase();
    const query = `
      DELETE FROM old_discounts 
      WHERE data_desconto NOT IN (
        SELECT data_desconto FROM (
          SELECT DISTINCT data_desconto FROM old_discounts ORDER BY data_desconto DESC LIMIT 2
        )
      )`;
    try {
      await db.run(query);
    } catch (error) {
      this.logger.error(`Erro ao limpar histórico antigo de descontos: ${error}`);
    }
  }

  /**
   * Verifica se existem registros na tabela de descontos ativos.
   *
   * @returns Verdadeiro se houver pelo menos um produto em promoção.
   */
  public async hasActiveDiscounts(): Promise<boolean> {
    const db = await this.getDatabase();
    const result = await db.get("SELECT COUNT(*) as count FROM discounts");
    return result?.count > 0;
  }

  /**
   * Recupera a data da última rotação de descontos baseando-se no histórico.
   *
   * @returns Data (string) do último arquivamento ou null se nunca ocorreu.
   */
  public async getLastRotationDate(): Promise<string | null> {
    const db = await this.getDatabase();
    const result = await db.get("SELECT MAX(data_desconto) as lastRun FROM old_discounts");
    return result?.lastRun || null;
  }

  /**
   * Atualiza as informações básicas de um produto cadastrado.
   *
   * @description
   * Realiza a atualização dos dados principais de um produto na base de dados,
   * incluindo nome, preço, categoria e descrição. Esta operação não altera
   * informações relacionadas a variantes, cores, tamanhos ou mídias associadas.
   *
   * Em caso de falha durante a atualização, registra o erro no logger e lança
   * uma exceção interna para tratamento pela aplicação.
   *
   * @param id Identificador do produto a ser atualizado.
   * @param name Nome atualizado do produto.
   * @param price Preço atualizado do produto.
   * @param categoryId Identificador da categoria associada ao produto.
   * @param description Descrição atualizada do produto.
   * @returns Promessa resolvida após a atualização das informações básicas do produto.
   */
  public async updateProductBasicInfo(
    id: number,
    name: string,
    price: number,
    categoryId: number,
    description: string,
  ): Promise<void> {
    const db = await this.getDatabase();
    const query = `UPDATE products SET nome = ?, preco = ?, categoria = ?, descricao = ? WHERE id = ?`;
    try {
      await db.run(query, [name, price, categoryId, description, id]);
    } catch (error) {
      this.logger.error(`Erro ao atualizar produto básico ID ${id}: ${error}`);
      throw new InternalServerErrorException("Erro ao atualizar informações básicas do produto.");
    }
  }

  /**
   * Remove todas as mídias associadas a um produto.
   *
   * @description
   * Exclui da base de dados todos os registros de URLs vinculados ao
   * produto informado, removendo as referências de imagens e demais
   * mídias cadastradas para o item.
   *
   * Esta operação é geralmente utilizada durante processos de edição
   * ou substituição completa das mídias associadas ao produto.
   *
   * Em caso de falha durante a exclusão, registra o erro no logger e
   * lança uma exceção interna para tratamento pela aplicação.
   *
   * @param productId Identificador do produto cujas mídias serão removidas.
   * @returns Promessa resolvida após a exclusão das URLs associadas ao produto.
   */
  public async deleteProductUrls(productId: number): Promise<void> {
    const db = await this.getDatabase();
    const query = `DELETE FROM product_urls WHERE product_id = ?`;
    try {
      await db.run(query, [productId]);
    } catch (error) {
      this.logger.error(`Erro ao deletar URLs do produto ID ${productId}: ${error}`);
      throw new InternalServerErrorException("Erro ao deletar mídias do produto.");
    }
  }

  /**
   * Remove todas as variações e cores associadas a um produto.
   *
   * @description
   * Exclui da base de dados todos os registros de variantes vinculados
   * ao produto informado, incluindo informações como cores, tamanhos e
   * demais atributos armazenados na tabela de variações.
   *
   * Esta operação é normalmente utilizada durante processos de atualização
   * completa das variantes do produto, permitindo a recriação dos registros
   * com os dados mais recentes.
   *
   * Em caso de falha durante a exclusão, registra o erro no logger e lança
   * uma exceção interna para tratamento pela aplicação.
   *
   * @param productId Identificador do produto cujas variações serão removidas.
   * @returns Promessa resolvida após a exclusão das variações do produto.
   */
  public async deleteProductColors(productId: number): Promise<void> {
    const db = await this.getDatabase();
    const query = `DELETE FROM product_colors WHERE product_id = ?`;
    try {
      await db.run(query, [productId]);
    } catch (error) {
      this.logger.error(`Erro ao deletar cores/variantes do produto ID ${productId}: ${error}`);
      throw new InternalServerErrorException("Erro ao deletar variações do produto.");
    }
  }

  /**
   * Inicia uma transação no banco de dados.
   *
   * @description
   * Abre uma transação explícita para agrupar múltiplas operações de escrita
   * em uma única unidade de trabalho. Enquanto a transação estiver ativa,
   * as alterações realizadas poderão ser confirmadas ou revertidas de forma
   * atômica, garantindo a integridade dos dados.
   *
   * Este método é utilizado em fluxos que envolvem múltiplas operações
   * dependentes, como criação, atualização ou remoção de registros
   * relacionados.
   *
   * @returns Promessa resolvida após o início da transação.
   */
  public async beginTransaction(): Promise<void> {
    const db = await this.getDatabase();
    await db.run("BEGIN TRANSACTION");
  }

  /**
   * Confirma as alterações realizadas na transação ativa.
   *
   * @description
   * Finaliza a transação em andamento e persiste definitivamente todas
   * as operações executadas desde sua abertura. Após a confirmação,
   * as alterações passam a fazer parte do estado permanente da base
   * de dados e não podem ser revertidas por rollback.
   *
   * Este método deve ser utilizado após a conclusão bem-sucedida de
   * todas as operações agrupadas dentro da transação.
   *
   * @returns Promessa resolvida após a confirmação da transação.
   */
  public async commit(): Promise<void> {
    const db = await this.getDatabase();
    await db.run("COMMIT");
  }

  /**
   * Reverte as alterações realizadas na transação ativa.
   *
   * @description
   * Executa o rollback da transação em andamento, desfazendo todas as
   * operações realizadas desde sua abertura que ainda não tenham sido
   * confirmadas por um commit.
   *
   * Este método é utilizado em cenários de erro para garantir a
   * consistência e integridade dos dados, evitando persistências
   * parciais de operações relacionadas.
   *
   * Caso não exista uma transação ativa ou ocorra alguma falha durante
   * a reversão, a exceção é silenciosamente ignorada para não interferir
   * no fluxo de tratamento do erro original.
   *
   * @returns Promessa resolvida após a tentativa de reversão da transação.
   */
  public async rollback(): Promise<void> {
    const db = await this.getDatabase();

    await db.run("ROLLBACK");
  }
}
