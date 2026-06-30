import { DatabaseConnection } from "../infra/database";
import { RegisterDto } from "../models/register";
import { UserInfoDTO } from "../models/user";
import bcrypt from "../../node_modules/bcryptjs";

export class UserRepository {
  private async getDatabase() {
    const db = await DatabaseConnection.getInstance();
    return db;
  }

  /**
   * Cria um novo usuário na base de dados.
   *
   * @description
   * Realiza o processamento das informações de cadastro recebidas,
   * aplicando a criptografia da senha antes da persistência para
   * garantir a segurança das credenciais armazenadas.
   *
   * Após a geração do hash, insere os dados do usuário na tabela
   * de usuários, armazenando e-mail, senha criptografada e nome
   * de usuário quando informado.
   *
   * @param user Dados de cadastro do usuário.
   * @returns Promessa contendo o resultado da operação de inserção.
   */
  public async create(user: RegisterDto): Promise<any> {
    const db = await this.getDatabase();

    const query = `INSERT INTO users (mail, pass, username) VALUES (?, ?, ?)`;

    user.pass = await bcrypt.hash(user.pass, 10);

    return db.run(query, [user.mail, user.pass, user.username || null]);
  }

  async findByEmail(mail: string): Promise<any> {
    const db = await this.getDatabase();
    const query = `SELECT * FROM users WHERE mail = ?`;
    return db.get(query, [mail]);
  }

  async updateInfo(userId: number, userInfoDTO: UserInfoDTO) {
    const db = await this.getDatabase();

    const query = `UPDATE users SET mail = ?, phone = ?, username = ? WHERE id = ?`;

    return db.run(query, [userInfoDTO.mail, userInfoDTO.phone, userInfoDTO.username, userId]);
  }

  async getInfo(userId: number) {
    const db = await this.getDatabase();
    const query = `SELECT mail, phone, username, profile FROM users WHERE id = ?`;
    return db.get(query, [userId]);
  }

  async getSpecificUser(userId: number, userMail: string) {
    const db = await this.getDatabase();
    const query = `SELECT username from users WHERE id = ? and mail = ?`;
    return db.get(query, [userId, userMail]);
  }

  async getManagerProfile(userID: number): Promise<any> {
    const db = await this.getDatabase();
    const query = `SELECT username FROM users WHERE id = ? AND profile IN ('manager', 'admin');`;
    return db.get(query, [userID]);
  }

  /**
   * Obtém a lista de clientes cadastrados no sistema.
   *
   * @description
   * Consulta os usuários que não possuem perfis administrativos,
   * retornando informações básicas de identificação juntamente com
   * a quantidade de endereços vinculados a cada cliente.
   *
   * A consulta utiliza relacionamento com a tabela de endereços para
   * calcular o total de registros associados a cada usuário, permitindo
   * a exibição de métricas administrativas sem expor dados sensíveis.
   *
   * Os resultados são agrupados por usuário e ordenados de forma
   * decrescente pelo identificador de cadastro.
   *
   * @returns Promessa contendo a lista de clientes e suas respectivas quantidades de endereços.
   */
  public async getClients(): Promise<any[]> {
    const db = await this.getDatabase();
    return await db.all(`
      SELECT
        u.id,
        u.username,
        u.profile,
        COUNT(a.id) AS address_count
      FROM users u
      LEFT JOIN addresses a ON a.user_id = u.id
      WHERE u.profile IS NULL OR u.profile NOT IN ('manager', 'admin')
      GROUP BY u.id
      ORDER BY u.id DESC
    `);
  }
}
