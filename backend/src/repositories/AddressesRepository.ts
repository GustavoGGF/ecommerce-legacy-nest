import { DatabaseConnection } from "../infra/database";
import { AddressModel } from "../models/address";

export class AddressesRepository {
  /**
   * Cadastra um novo endereço para um usuário.
   *
   * @description
   * Realiza a persistência de um endereço vinculado ao usuário informado,
   * armazenando informações de localização, identificação do endereço e
   * configuração de endereço principal quando aplicável.
   *
   * O registro criado pode ser utilizado posteriormente em processos de
   * entrega, faturamento e gerenciamento de dados cadastrais do cliente.
   *
   * @param userID Identificador do usuário que receberá o novo endereço.
   * @param addressDTO Dados completos do endereço a ser cadastrado.
   * @returns Promessa contendo o resultado da operação de inserção.
   */
  async createAddress(userID: number, addressDTO: AddressModel) {
    const db = await DatabaseConnection.getInstance();

    const query = `INSERT INTO addresses (user_id, label, zip_code, street, number, complement, neighborhood, city, state, is_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    return db.run(query, [
      userID,
      addressDTO.label,
      addressDTO.zip_code,
      addressDTO.street,
      addressDTO.number,
      addressDTO.complement || null,
      addressDTO.neighborhood,
      addressDTO.city,
      addressDTO.state,
      addressDTO.is_main ? 1 : 0,
    ]);
  }

  async getAddresses(userID: number) {
    const db = await DatabaseConnection.getInstance();

    const query = `SELECT id, label, zip_code, street, number, complement, neighborhood, city, state, is_main FROM addresses WHERE user_id = ?`;
    return db.all(query, [userID]);
  }
}
