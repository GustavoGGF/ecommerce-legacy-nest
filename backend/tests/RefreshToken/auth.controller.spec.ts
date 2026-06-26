import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
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
		user: { id: 1, mail: "usuario@test.com" },
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
			const fakeExpiresAt = new Date("2030-01-01T00:00:00Z");
			authService.generateTokenPair.mockResolvedValue({
				accessToken: "jwt.access.token",
				rawRefreshToken: "raw-refresh-uuid",
				refreshExpiresAt: fakeExpiresAt,
			});

			const req = makeRequest({ body: { rememberMe: false } });
			const res = makeResponse();

			const result = await controller.login(req, res);

			// O access_token deve estar no corpo da resposta
			expect(result).toMatchObject({
				message: "Login bem-sucedido",
				access_token: "jwt.access.token",
			});

			// O cookie HttpOnly deve ter sido setado com o refresh token opaco
			expect(res.cookie).toHaveBeenCalledWith(
				"refresh_token",
				"raw-refresh-uuid",
				expect.objectContaining({
					httpOnly: true,
					sameSite: "strict",
					path: "/auth",
				}),
			);

			// O serviço deve ter sido chamado com rememberMe=false
			expect(authService.generateTokenPair).toHaveBeenCalledWith(
				{ id: 1, mail: "usuario@test.com" },
				false,
			);
		});

		it("deve chamar generateTokenPair com rememberMe=true quando enviado pelo cliente", async () => {
			authService.generateTokenPair.mockResolvedValue({
				accessToken: "jwt.longo",
				rawRefreshToken: "raw-uuid-longo",
				refreshExpiresAt: new Date("2056-01-01"),
			});

			const req = makeRequest({ body: { rememberMe: true } });
			const res = makeResponse();

			await controller.login(req, res);

			expect(authService.generateTokenPair).toHaveBeenCalledWith(
				{ id: 1, mail: "usuario@test.com" },
				true,
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// refresh
	// ─────────────────────────────────────────────────────────────────────────

	describe("refresh", () => {
		it("deve retornar novo access_token e rotacionar o cookie quando o refresh token for válido", async () => {
			const newExpiresAt = new Date("2030-06-01T00:00:00Z");
			authService.refreshAccessToken.mockResolvedValue({
				accessToken: "novo.jwt.token",
				rawRefreshToken: "novo-refresh-uuid",
				refreshExpiresAt: newExpiresAt,
			});

			const req = makeRequest({
				cookies: { refresh_token: "old-refresh-uuid" },
			});
			const res = makeResponse();

			const result = await controller.refresh(req, res);

			expect(result).toMatchObject({
				message: "Tokens renovados com sucesso.",
				access_token: "novo.jwt.token",
			});

			// O serviço deve ter sido chamado com o token lido do cookie
			expect(authService.refreshAccessToken).toHaveBeenCalledWith(
				"old-refresh-uuid",
			);

			// O novo cookie deve ter sido setado com o token rotacionado
			expect(res.cookie).toHaveBeenCalledWith(
				"refresh_token",
				"novo-refresh-uuid",
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

			const req = makeRequest({
				cookies: { refresh_token: "token-da-sessao" },
			});
			const res = makeResponse();

			const result = await controller.logout(req, res);

			expect(result).toEqual({ message: "Logout realizado com sucesso." });

			// O serviço deve ter revogado o token correto
			expect(authService.revokeRefreshToken).toHaveBeenCalledWith(
				"token-da-sessao",
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
