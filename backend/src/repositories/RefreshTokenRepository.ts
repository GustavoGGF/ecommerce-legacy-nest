import { createHash } from "crypto";
import { DatabaseConnection } from "../infra/database";

export class RefreshTokenRepository {
	private async getDatabase() {
		return DatabaseConnection.getInstance();
	}

	/**
	 * Gera o hash SHA-256 de um refresh token em texto puro.
	 *
	 * @param rawToken Token opaco gerado pelo servidor.
	 * @returns Hash hexadecimal de 64 caracteres.
	 */
	private hashToken(rawToken: string): string {
		return createHash("sha256").update(rawToken).digest("hex");
	}

	/**
	 * Persiste um novo refresh token no banco de dados.
	 *
	 * @description
	 * Armazena apenas o hash do token. O valor em claro é descartado
	 * imediatamente após o hashing, garantindo que uma eventual exposição
	 * do banco não comprometa sessões ativas.
	 *
	 * @param userId   ID do usuário proprietário da sessão.
	 * @param rawToken Token opaco gerado (UUID v4).
	 * @param expiresAt Data/hora de expiração.
	 */
	public async create(
		userId: number,
		rawToken: string,
		expiresAt: Date,
	): Promise<void> {
		const db = await this.getDatabase();
		const tokenHash = this.hashToken(rawToken);
		await db.run(
			`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
			[userId, tokenHash, expiresAt.toISOString()],
		);
	}

	/**
	 * Busca um registro de refresh token pelo valor em claro do token.
	 *
	 * @description
	 * Computa o hash do token recebido e realiza a consulta por hash,
	 * retornando `undefined` se o token não existir ou já tiver sido revogado.
	 *
	 * @param rawToken Token opaco recebido do cliente.
	 * @returns Registro da tabela `refresh_tokens` ou `undefined`.
	 */
	public async findByRawToken(rawToken: string): Promise<any> {
		const db = await this.getDatabase();
		const tokenHash = this.hashToken(rawToken);
		return db.get(`SELECT * FROM refresh_tokens WHERE token_hash = ?`, [
			tokenHash,
		]);
	}

	/**
	 * Remove um refresh token pelo valor em claro (logout ou rotação).
	 *
	 * @param rawToken Token opaco a ser invalidado.
	 */
	public async deleteByRawToken(rawToken: string): Promise<void> {
		const db = await this.getDatabase();
		const tokenHash = this.hashToken(rawToken);
		await db.run(`DELETE FROM refresh_tokens WHERE token_hash = ?`, [
			tokenHash,
		]);
	}

	/**
	 * Remove todos os refresh tokens de um usuário (revogação total de sessões).
	 *
	 * @param userId ID do usuário cujas sessões devem ser encerradas.
	 */
	public async deleteAllByUserId(userId: number): Promise<void> {
		const db = await this.getDatabase();
		await db.run(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId]);
	}

	/**
	 * Remove todos os refresh tokens com data de expiração anterior ao momento atual.
	 *
	 * @description
	 * Deve ser chamado periodicamente por uma cron task para manter a tabela
	 * de tokens enxuta e evitar crescimento indefinido de registros obsoletos.
	 */
	public async deleteExpired(): Promise<void> {
		const db = await this.getDatabase();
		await db.run(
			`DELETE FROM refresh_tokens WHERE expires_at < datetime('now')`,
		);
	}
}
