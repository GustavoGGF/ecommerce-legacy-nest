import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { RefreshTokenRepository } from "../../src/repositories/RefreshTokenRepository";
import { UserRepository } from "../../src/repositories/UserRepository";
import { AuthService } from "../../src/services/AuthService";

describe("AuthService", () => {
	let service: AuthService;
	let jwtService: jest.Mocked<JwtService>;
	let refreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
	let userRepo: jest.Mocked<UserRepository>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{
					provide: JwtService,
					useValue: {
						sign: jest.fn(),
					},
				},
				{
					provide: UserRepository,
					useValue: {
						findByEmail: jest.fn(),
						create: jest.fn(),
						getInfo: jest.fn(),
					},
				},
				{
					provide: RefreshTokenRepository,
					useValue: {
						create: jest.fn(),
						findByRawToken: jest.fn(),
						deleteByRawToken: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		jwtService = module.get(JwtService);
		refreshTokenRepo = module.get(RefreshTokenRepository);
		userRepo = module.get(UserRepository);

		// Substitui as instâncias criadas manualmente dentro do service pelas mocks do módulo
		service.userRepository = userRepo as unknown as UserRepository;
		service.refreshTokenRepository =
			refreshTokenRepo as unknown as RefreshTokenRepository;
	});

	// ─────────────────────────────────────────────────────────────────────────
	// generateTokenPair
	// ─────────────────────────────────────────────────────────────────────────

	describe("generateTokenPair", () => {
		it("deve gerar um access token JWT e persistir o refresh token no banco", async () => {
			const fakeUser = { id: 1, mail: "usuario@test.com" };
			jwtService.sign.mockReturnValue("jwt.access.token");
			refreshTokenRepo.create.mockResolvedValue(undefined);

			const result = await service.generateTokenPair(fakeUser, false);

			// Access token deve ser o JWT retornado pelo JwtService
			expect(result.accessToken).toBe("jwt.access.token");

			// Refresh token deve ser uma string UUID não-vazia
			expect(typeof result.rawRefreshToken).toBe("string");
			expect(result.rawRefreshToken.length).toBeGreaterThan(0);

			// A expiração não deve ser no passado
			expect(result.refreshExpiresAt.getTime()).toBeGreaterThan(Date.now());

			// O repositório deve ter sido chamado para persistir o token
			expect(refreshTokenRepo.create).toHaveBeenCalledTimes(1);
			expect(refreshTokenRepo.create).toHaveBeenCalledWith(
				fakeUser.id,
				result.rawRefreshToken,
				result.refreshExpiresAt,
			);

			// O JWT deve ter sido assinado com expiração de 15 minutos
			expect(jwtService.sign).toHaveBeenCalledWith(
				{ id: fakeUser.id, mail: fakeUser.mail },
				{ expiresIn: "15m" },
			);
		});

		it("deve propagar o erro quando a persistência do refresh token falhar", async () => {
			jwtService.sign.mockReturnValue("jwt.token");
			refreshTokenRepo.create.mockRejectedValue(
				new Error("UNIQUE constraint failed") as never,
			);

			await expect(
				service.generateTokenPair({ id: 1, mail: "a@b.com" }, false),
			).rejects.toThrow("UNIQUE constraint failed");
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// refreshAccessToken
	// ─────────────────────────────────────────────────────────────────────────

	describe("refreshAccessToken", () => {
		it("deve rodar a rotação: invalidar o token antigo e emitir um novo par", async () => {
			const rawToken = "old-refresh-token";
			const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 dia

			refreshTokenRepo.findByRawToken.mockResolvedValue({
				id: 10,
				user_id: 5,
				token_hash: "somehash",
				expires_at: futureDate,
			});

			userRepo.getInfo.mockResolvedValue({ mail: "usuario@test.com" });
			refreshTokenRepo.deleteByRawToken.mockResolvedValue(undefined);
			jwtService.sign.mockReturnValue("new.jwt.token");
			refreshTokenRepo.create.mockResolvedValue(undefined);

			const result = await service.refreshAccessToken(rawToken);

			// O token antigo deve ser invalidado antes de gerar o novo
			expect(refreshTokenRepo.deleteByRawToken).toHaveBeenCalledWith(rawToken);

			// Um novo access token deve ser emitido
			expect(result.accessToken).toBe("new.jwt.token");

			// Um novo refresh token deve ser persistido (rotação)
			expect(refreshTokenRepo.create).toHaveBeenCalledTimes(1);
		});

		it("deve lançar UnauthorizedException quando o refresh token não existir no banco", async () => {
			refreshTokenRepo.findByRawToken.mockResolvedValue(undefined);

			await expect(
				service.refreshAccessToken("token-invalido"),
			).rejects.toThrow(UnauthorizedException);

			// Nenhuma deleção ou criação deve ocorrer com token inválido
			expect(refreshTokenRepo.deleteByRawToken).not.toHaveBeenCalled();
			expect(refreshTokenRepo.create).not.toHaveBeenCalled();
		});

		it("deve lançar UnauthorizedException quando o refresh token estiver expirado", async () => {
			const pastDate = new Date(Date.now() - 1000).toISOString(); // expirado há 1 segundo

			refreshTokenRepo.findByRawToken.mockResolvedValue({
				id: 11,
				user_id: 5,
				token_hash: "somehash",
				expires_at: pastDate,
			});

			// O token expirado deve ser removido do banco como limpeza preventiva
			refreshTokenRepo.deleteByRawToken.mockResolvedValue(undefined);

			await expect(
				service.refreshAccessToken("token-expirado"),
			).rejects.toThrow(UnauthorizedException);

			expect(refreshTokenRepo.deleteByRawToken).toHaveBeenCalledWith(
				"token-expirado",
			);
			// Nenhum novo par deve ser gerado
			expect(refreshTokenRepo.create).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// revokeRefreshToken
	// ─────────────────────────────────────────────────────────────────────────

	describe("revokeRefreshToken", () => {
		it("deve chamar deleteByRawToken com o token recebido (logout)", async () => {
			const rawToken = "token-a-revogar";
			refreshTokenRepo.deleteByRawToken.mockResolvedValue(undefined);

			await service.revokeRefreshToken(rawToken);

			expect(refreshTokenRepo.deleteByRawToken).toHaveBeenCalledTimes(1);
			expect(refreshTokenRepo.deleteByRawToken).toHaveBeenCalledWith(rawToken);
		});

		it("deve propagar erro se a deleção falhar no banco", async () => {
			refreshTokenRepo.deleteByRawToken.mockRejectedValue(
				new Error("database error") as never,
			);

			await expect(
				service.revokeRefreshToken("qualquer-token"),
			).rejects.toThrow("database error");
		});
	});

	// ─────────────────────────────────────────────────────────────────────────
	// registerUser
	// ─────────────────────────────────────────────────────────────────────────

	describe("registerUser", () => {
		it("deve criar um novo usuário quando o e-mail ainda não estiver cadastrado", async () => {
			userRepo.findByEmail.mockResolvedValue(null);
			userRepo.create.mockResolvedValue(undefined);

			const result = await service.registerUser({
				mail: "novo@test.com",
				pass: "senha123",
				username: "Novo Usuário",
				rememberMe: false,
			});

			expect(userRepo.create).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ message: "User created successfully" });
		});

		it("deve lançar ConflictException quando o e-mail já estiver em uso", async () => {
			userRepo.findByEmail.mockResolvedValue({
				id: 1,
				mail: "existente@test.com",
			});

			await expect(
				service.registerUser({
					mail: "existente@test.com",
					pass: "senha123",
					username: "Usuário",
					rememberMe: false,
				}),
			).rejects.toThrow(ConflictException);

			expect(userRepo.create).not.toHaveBeenCalled();
		});
	});
});
