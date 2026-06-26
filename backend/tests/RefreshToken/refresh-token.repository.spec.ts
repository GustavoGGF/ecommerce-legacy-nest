import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import type { Database } from "sqlite";
import { DatabaseConnection } from "../../src/infra/database";
import { RefreshTokenRepository } from "../../src/repositories/RefreshTokenRepository";

describe("RefreshTokenRepository", () => {
	let repo: RefreshTokenRepository;
	let mockDb: { run: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>; get: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>> };
	let getInstanceSpy: ReturnType<typeof jest.spyOn>;

	beforeEach(() => {
		mockDb = {
			run: jest.fn(),
			get: jest.fn(),
		};

		getInstanceSpy = jest
			.spyOn(DatabaseConnection, "getInstance")
			.mockResolvedValue(mockDb as unknown as Database);

		repo = new RefreshTokenRepository();
	});

	afterEach(() => {
		getInstanceSpy.mockRestore();
	});

	// ─────────────────────────────────────────────────────────────────────────
	// create
	// ─────────────────────────────────────────────────────────────────────────

	describe("create", () => {
		it("deve persistir o hash SHA-256 do token e nunca o valor em claro", async () => {
			const rawToken = "00000000-0000-0000-0000-000000000001";
			const expiresAt = new Date("2030-01-01T00:00:00Z");

			mockDb.run.mockResolvedValue({ changes: 1 });

			await repo.create(1, rawToken, expiresAt);

			expect(mockDb.run).toHaveBeenCalledTimes(1);

			const [sql, params] = mockDb.run.mock.calls[0] as [string, unknown[]];

			// O segundo parâmetro é o hash — deve ser hexadecimal de 64 chars (SHA-256)
			expect(params[1]).toMatch(/^[a-f0-9]{64}$/);
			// O valor em claro NÃO deve aparecer nos argumentos enviados ao banco
			expect(params[1]).not.toBe(rawToken);
			// O user_id e expires_at devem chegar corretamente
			expect(params[0]).toBe(1);
			expect(params[2]).toBe(expiresAt.toISOString());
			expect(sql).toContain("INSERT INTO refresh_tokens");
		});

		it("deve propagar erro quando a inserção no banco falhar", async () => {
			mockDb.run.mockRejectedValue(
				new Error("UNIQUE constraint failed: refresh_tokens.token_hash"),
			);

			await expect(
				repo.create(1, "qualquer-token", new Date()),
			).rejects.toThrow("UNIQUE constraint failed");
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// findByRawToken
	// ─────────────────────────────────────────────────────────────────────────

	describe("findByRawToken", () => {
		it("deve retornar o registro quando o token for válido e existir no banco", async () => {
			const rawToken = "00000000-0000-0000-0000-000000000002";
			const fakeRecord = {
				id: 42,
				user_id: 7,
				token_hash: "irrelevante-para-o-teste",
				expires_at: "2030-01-01T00:00:00.000Z",
			};

			mockDb.get.mockResolvedValue(fakeRecord);

			const result = await repo.findByRawToken(rawToken);

			expect(result).toEqual(fakeRecord);
			expect(mockDb.get).toHaveBeenCalledTimes(1);

			// O banco deve ser consultado pelo hash, nunca pelo valor bruto
			const [, params] = mockDb.get.mock.calls[0] as [string, unknown[]];
			expect(params[0]).toMatch(/^[a-f0-9]{64}$/);
			expect(params[0]).not.toBe(rawToken);
		});

		it("deve retornar undefined quando o token não existir no banco", async () => {
			mockDb.get.mockResolvedValue(undefined);

			const result = await repo.findByRawToken("token-inexistente");

			expect(result).toBeUndefined();
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// deleteByRawToken
	// ─────────────────────────────────────────────────────────────────────────

	describe("deleteByRawToken", () => {
		it("deve deletar o registro correto consultando pelo hash do token", async () => {
			const rawToken = "00000000-0000-0000-0000-000000000003";
			mockDb.run.mockResolvedValue({ changes: 1 });

			await repo.deleteByRawToken(rawToken);

			expect(mockDb.run).toHaveBeenCalledTimes(1);

			const [sql, params] = mockDb.run.mock.calls[0] as [string, unknown[]];
			expect(sql).toContain("DELETE FROM refresh_tokens");
			expect(params[0]).toMatch(/^[a-f0-9]{64}$/);
			expect(params[0]).not.toBe(rawToken);
		});

		it("deve propagar erro quando a deleção falhar no banco", async () => {
			mockDb.run.mockRejectedValue(new Error("database is locked"));

			await expect(repo.deleteByRawToken("qualquer-token")).rejects.toThrow(
				"database is locked",
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// deleteAllByUserId
	// ─────────────────────────────────────────────────────────────────────────

	describe("deleteAllByUserId", () => {
		it("deve deletar todos os tokens do usuário informado", async () => {
			mockDb.run.mockResolvedValue({ changes: 3 });

			await repo.deleteAllByUserId(99);

			expect(mockDb.run).toHaveBeenCalledTimes(1);

			const [sql, params] = mockDb.run.mock.calls[0] as [string, unknown[]];
			expect(sql).toContain("DELETE FROM refresh_tokens");
			expect(sql).toContain("user_id");
			expect(params[0]).toBe(99);
		});

		it("deve propagar erro quando a operação de remoção em massa falhar", async () => {
			mockDb.run.mockRejectedValue(new Error("SQLITE_BUSY"));

			await expect(repo.deleteAllByUserId(1)).rejects.toThrow("SQLITE_BUSY");
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// deleteExpired
	// ─────────────────────────────────────────────────────────────────────────

	describe("deleteExpired", () => {
		it("deve executar DELETE filtrando por expires_at menor que now()", async () => {
			mockDb.run.mockResolvedValue({ changes: 5 });

			await repo.deleteExpired();

			expect(mockDb.run).toHaveBeenCalledTimes(1);

			const [sql] = mockDb.run.mock.calls[0] as [string];
			expect(sql).toContain("DELETE FROM refresh_tokens");
			expect(sql).toContain("expires_at");
			expect(sql).toContain("datetime('now')");
		});

		it("deve propagar erro quando a limpeza de expirados falhar", async () => {
			mockDb.run.mockRejectedValue(new Error("disk I/O error"));

			await expect(repo.deleteExpired()).rejects.toThrow("disk I/O error");
		});
	});
});
