import { Injectable, Logger } from "@nestjs/common";
import { DatabaseConnection } from "../infra/database";
import { Database } from "sqlite";

import { FallbackSuccess, FallbackError } from "../models/fallback";
import { ColorVariant } from "../models/Product";

/**
 * Serviço utilitário de infraestrutura para operações de banco de dados.
 *
 * @description
 * O `DataBaseService` atua como um facilitador para acesso à instância do SQLite e
 * fornece mecanismos de contingência. Ele abstrai a complexidade de conexão e
 * oferece estratégias de recuperação para falhas em operações de lote.
 */
@Injectable()
export class DataBaseService {
	private readonly logger = new Logger(DataBaseService.name);

	/**
	 * Recupera a instância única e ativa do banco de dados (Singleton).
	 *
	 * @returns {Promise<Database>} A instância do banco de dados pronta para execução de comandos.
	 */
	public async getDatabase(): Promise<Database> {
		return await DatabaseConnection.getInstance();
	}

	/**
	 * Executa uma operação de recuperação (fallback) processando itens individualmente.
	 *
	 * @description
	 * Este método é acionado quando uma operação de Bulk Insert (lote) falha.
	 * Ele tenta reprocessar cada item do array original dentro de sua própria transação,
	 * permitindo que itens válidos sejam salvos mesmo que outros no mesmo lote possuam erros.
	 *
	 * @param {number} id - ID de referência do produto.
	 * @param {string} operation - Tipo da operação SQL (Ex: "INSERT INTO").
	 * @param {string} table - Nome da tabela alvo.
	 * @param {string} coluns - Lista de colunas formatada para o SQL.
	 * @param {any[]} colors - Lista de objetos contendo os dados das variantes.
	 *
	 * @returns {Promise<{ successResultCallBack: FallbackSuccess[]; failResultCallBack: FallbackError[] }>}
	 * Relatório detalhado de quais itens foram recuperados com sucesso e quais falharam permanentemente.
	 */
	public async callFallBackOperation(
		id: number,
		operation: string,
		table: string,
		coluns: string,
		colors: ColorVariant[],
	): Promise<{
		successResultCallBack: FallbackSuccess[];
		failResultCallBack: FallbackError[];
	}> {
		const successResultCallBack: FallbackSuccess[] = [];
		const failResultCallBack: FallbackError[] = [];
		for (const item of colors) {
			try {
				const db = await this.getDatabase();
				await db.run("BEGIN");

				const query = `${operation} ${table} (${coluns}) VALUES (?, ?, ?, ?)`;
				const values = [id, item.color, item.quantity, item.size];

				await db.run(query, values);

				await db.run("COMMIT");
				successResultCallBack.push({
					status: "sucesso",
					item: item,
				});
			} catch (err) {
				const db = await this.getDatabase();
				await db.run("ROLLBACK");
				this.logger.error(`Erro ao cadastrar um a um: ${err}`);
				failResultCallBack.push({
					status: "erro",
					item: item,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}
		return { successResultCallBack, failResultCallBack };
	}
}
