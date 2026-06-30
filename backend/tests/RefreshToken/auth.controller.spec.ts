import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AuthController } from "../../src/controllers/AuthController";
import { AuthService } from "../../src/services/AuthService";
import { UserService } from "../../src/services/UserService";

// ─── Factories de mocks de Request / Response Express ────────────────────────

function makeResponse() {
	const res = {
		cookie: jest.fn().mockReturnThis(),
		clearCookie: jest.fn().mockReturnThis(),
	};
	return res as unknown as Response;
}

/** Tipo mínimo do Request usado nos testes do AuthController. */
type MockRequest = {
	user: { id: number; mail: string };
	body: Record<string, unknown>;
	cookies: Record<string, string>;
};

function makeRequest(
	overrides: Partial<MockRequest> = {},
): Request & MockRequest {
	return {
		user: { id: 1, mail: faker.internet.email() },
		body: {},
		cookies: {},
		...overrides,
	} as unknown as Request & MockRequest;
}

describe("AuthController", () => {
	let controller: AuthController;
	let authService: jest.Mocked<AuthService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: {
						generateTokenPair: jest.fn(),
						refreshAccessToken: jest.fn(),
						revokeRefreshToken: jest.fn(),
						registerUser: jest.fn(),
					},
				},
				// JwtAuthGuard depende de UserService e JwtService — mockamos ambos
				{
					provide: UserService,
					useValue: {
						getSpecificUser: jest.fn(),
					},
				},
				{
					provide: JwtService,
					useValue: {
						verify: jest.fn(),
						sign: jest.fn(),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						get: jest.fn((key: string) => {
							if (key === "REFRESH_TOKEN_COOKIE") return "refresh_token";
							if (key === "NODE_ENV") return "test";
							return null;
						}),
					},
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
		authService = module.get(AuthService);
	});

	// ─────────────────────────────────────────────────────────────────────────
	// login
	// ─────────────────────────────────────────────────────────────────────────

	describe("login", () => {
		it("deve retornar access_token no corpo e definir o cookie refresh_token na resposta", async () => {
			const fakeExpiresAt = faker.date.future();
			const fakeAccessToken = faker.string.alphanumeric(32);
			const fakeRefreshToken = faker.string.uuid();
			authService.generateTokenPair.mockResolvedValue({
				accessToken: fakeAccessToken,
				rawRefreshToken: fakeRefreshToken,
				refreshExpiresAt: fakeExpiresAt,
			});

			const fakeEmail = faker.internet.email();
			const req = makeRequest({ body: { rememberMe: false }, user: { id: 1, mail: fakeEmail } });
			const res = makeResponse();

			const result = await controller.login(req, res);

			// O access_token deve estar no corpo da resposta
			expect(result).toMatchObject({
				message: "Login bem-sucedido",
				access_token: fakeAccessToken,
			});

			// O cookie HttpOnly deve ter sido setado com o refresh token opaco
			expect(res.cookie).toHaveBeenCalledWith(
				"refresh_token",
				fakeRefreshToken,
				expect.objectContaining({
					httpOnly: true,
					sameSite: "strict",
					path: "/auth",
				}),
			);

			// O serviço deve ter sido chamado com rememberMe=false
			expect(authService.generateTokenPair).toHaveBeenCalledWith(
				{ id: 1, mail: fakeEmail },
				false,
			);
		});

		it("deve chamar generateTokenPair com rememberMe=true quando enviado pelo cliente", async () => {
			authService.generateTokenPair.mockResolvedValue({
				accessToken: faker.string.alphanumeric(32),
				rawRefreshToken: faker.string.uuid(),
				refreshExpiresAt: faker.date.future(),
			});

			const fakeEmail = faker.internet.email();
			const req = makeRequest({ body: { rememberMe: true }, user: { id: 1, mail: fakeEmail } });
			const res = makeResponse();

			await controller.login(req, res);

			expect(authService.generateTokenPair).toHaveBeenCalledWith(
				{ id: 1, mail: fakeEmail },
				true,
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// refresh
	// ─────────────────────────────────────────────────────────────────────────

	describe("refresh", () => {
		it("deve retornar novo access_token e rotacionar o cookie quando o refresh token for válido", async () => {
			const newExpiresAt = faker.date.future();
			const newAccessToken = faker.string.alphanumeric(32);
			const newRefreshToken = faker.string.uuid();
			authService.refreshAccessToken.mockResolvedValue({
				accessToken: newAccessToken,
				rawRefreshToken: newRefreshToken,
				refreshExpiresAt: newExpiresAt,
			});

			const oldRefreshToken = faker.string.uuid();
			const req = makeRequest({
				cookies: { refresh_token: oldRefreshToken },
			});
			const res = makeResponse();

			const result = await controller.refresh(req, res);

			expect(result).toMatchObject({
				message: "Tokens renovados com sucesso.",
				access_token: newAccessToken,
			});

			// O serviço deve ter sido chamado com o token lido do cookie
			expect(authService.refreshAccessToken).toHaveBeenCalledWith(
				oldRefreshToken,
			);

			// O novo cookie deve ter sido setado com o token rotacionado
			expect(res.cookie).toHaveBeenCalledWith(
				"refresh_token",
				newRefreshToken,
				expect.objectContaining({ httpOnly: true }),
			);
		});

		it("deve lançar UnauthorizedException quando o cookie refresh_token estiver ausente", async () => {
			const req = makeRequest({ cookies: {} });
			const res = makeResponse();

			await expect(controller.refresh(req, res)).rejects.toThrow(
				UnauthorizedException,
			);

			// O serviço não deve ser chamado se não houver cookie
			expect(authService.refreshAccessToken).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// logout
	// ─────────────────────────────────────────────────────────────────────────

	describe("logout", () => {
		it("deve revogar o token no banco e apagar o cookie ao fazer logout", async () => {
			authService.revokeRefreshToken.mockResolvedValue(undefined);

			const sessionToken = faker.string.uuid();
			const req = makeRequest({
				cookies: { refresh_token: sessionToken },
			});
			const res = makeResponse();

			const result = await controller.logout(req, res);

			expect(result).toEqual({ message: "Logout realizado com sucesso." });

			// O serviço deve ter revogado o token correto
			expect(authService.revokeRefreshToken).toHaveBeenCalledWith(
				sessionToken,
			);

			// O cookie deve ter sido removido da resposta
			expect(res.clearCookie).toHaveBeenCalledWith(
				"refresh_token",
				expect.objectContaining({ httpOnly: true }),
			);
		});

		it("deve fazer logout silenciosamente mesmo se o cookie refresh_token estiver ausente", async () => {
			// Cookie ausente: logout sem refresh token (ex: usuário já havia limpado cookies)
			const req = makeRequest({ cookies: {} });
			const res = makeResponse();

			const result = await controller.logout(req, res);

			expect(result).toEqual({ message: "Logout realizado com sucesso." });

			// O serviço NÃO deve ser chamado pois não há token a revogar
			expect(authService.revokeRefreshToken).not.toHaveBeenCalled();

			// O cookie deve ser limpo de qualquer forma
			expect(res.clearCookie).toHaveBeenCalledWith(
				"refresh_token",
				expect.any(Object),
			);
		});
	});
});
