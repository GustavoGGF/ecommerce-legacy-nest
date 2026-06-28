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

		if (!colors || colors.length === 0) {
			return { successResultCallBack, failResultCallBack };
		}

		try {
			const db = await this.getDatabase();

			// Change "INSERT INTO" to "INSERT OR IGNORE INTO" for bulk ignore duplicate errors
			const ignoreOperation = operation.replace("INSERT INTO", "INSERT OR IGNORE INTO");

			const placeholders = colors.map(() => "(?, ?, ?, ?)").join(", ");
			const query = `${ignoreOperation} ${table} (${coluns}) VALUES ${placeholders} RETURNING *`;

			const values: any[] = [];
			for (const item of colors) {
				values.push(id, item.color, item.quantity, item.size);
			}

			// We wrap the whole operation in a transaction in case there's another kind of error
			await db.run("BEGIN");
			const returnedRows = await db.all(query, values);
			await db.run("COMMIT");

			// Determine successes and failures by checking which items were actually inserted
			// Creating a mutable array of returned rows to properly handle duplicate inputs
			// If user inputs two exact duplicates, only one is inserted.
			// We consume it from the returned rows so the second duplicate is correctly marked as a failure.
			const availableRows = [...returnedRows];

			// Try dynamically matching returned rows with requested items using provided columns list
			// Extract col names, assuming format "col1, col2, col3, col4"
			// Usually: product_id, color_id, quantity, tamanho
			const colNames = coluns.split(',').map(c => c.trim());

			for (const item of colors) {
				// Match on the dynamic columns provided
				const matchIndex = availableRows.findIndex((row) => {
					// Matches the logic: values pushed are [id, item.color, item.quantity, item.size]
					// We check if the returned row has matching values for all corresponding columns
					const matchId = colNames[0] ? row[colNames[0]] == id : true;
					const matchColor = colNames[1] ? row[colNames[1]] == item.color : true;
					const matchQuantity = colNames[2] ? row[colNames[2]] == item.quantity : true;
					const matchSize = colNames[3] ? row[colNames[3]] == item.size : true;

					return matchId && matchColor && matchQuantity && matchSize;
				});

				if (matchIndex !== -1) {
					// Consume this row so it can't be matched by a duplicate input
					availableRows.splice(matchIndex, 1);
					successResultCallBack.push({
						status: "sucesso",
						item: item,
					});
				} else {
					failResultCallBack.push({
						status: "erro",
						item: item,
						error: "Failed to insert due to constraint violation or duplicate (ignored by bulk insert)",
					});
				}
			}
		} catch (err) {
			const db = await this.getDatabase();
			await db.run("ROLLBACK");
			this.logger.error(`Erro ao cadastrar em lote (fallback): ${err}`);

			// If even the bulk ignore query fails (e.g. invalid syntax), mark all as failed
			for (const item of colors) {
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
