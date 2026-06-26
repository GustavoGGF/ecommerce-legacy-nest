import {
	ConflictException,
	HttpException,
	Injectable,
	InternalServerErrorException,
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { RegisterDto } from "../models/register";
import { RefreshTokenRepository } from "../repositories/RefreshTokenRepository";
import { UserRepository } from "../repositories/UserRepository";

/** Duração do Refresh Token em milissegundos (padrão: 1 dia). */
const RT_TTL_DEFAULT_MS = 1 * 24 * 60 * 60 * 1000;

/** Duração do Refresh Token com "Lembrar de Mim" em milissegundos (30 dias). */
const RT_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	userRepository = new UserRepository();
	refreshTokenRepository = new RefreshTokenRepository();

	constructor(private readonly jwtService: JwtService) {}

	// ─────────────────────────────────────────────────────────────
	// Token utilities
	// ─────────────────────────────────────────────────────────────

	/**
	 * Gera um par Access Token + Refresh Token para o usuário autenticado.
	 *
	 * @description
	 * - **Access Token**: JWT assinado com expiração de 15 minutos.
	 * - **Refresh Token**: UUID v4 opaco persistido (via hash) no banco.
	 *   A validade é de 1 dia (padrão) ou 30 dias (quando `rememberMe` é verdadeiro).
	 *
	 * @param user       Payload do usuário (campos `id` e `mail`).
	 * @param rememberMe Quando `true`, estende o TTL do Refresh Token para 30 dias.
	 * @returns Objeto contendo o `accessToken` JWT e o `rawRefreshToken` opaco.
	 */
	async generateTokenPair(
		user: { id: number; mail: string },
		rememberMe = false,
	): Promise<{
		accessToken: string;
		rawRefreshToken: string;
		refreshExpiresAt: Date;
	}> {
		// Access Token: JWT de curta duração
		const accessToken = this.jwtService.sign(
			{ id: user.id, mail: user.mail },
			{ expiresIn: "15m" },
		);

		// Refresh Token: opaco, persistido no banco como hash SHA-256
		const rawRefreshToken = randomUUID();
		const ttl = rememberMe ? RT_TTL_REMEMBER_MS : RT_TTL_DEFAULT_MS;
		const refreshExpiresAt = new Date(Date.now() + ttl);

		await this.refreshTokenRepository.create(
			user.id,
			rawRefreshToken,
			refreshExpiresAt,
		);

		return { accessToken, rawRefreshToken, refreshExpiresAt };
	}

	/**
	 * Valida um Refresh Token e emite um novo par de tokens (rotação).
	 *
	 * @description
	 * A rotação garante que cada refresh token seja de uso único:
	 * 1. Busca o token no banco pelo hash.
	 * 2. Verifica a expiração.
	 * 3. Remove o token antigo do banco.
	 * 4. Gera e retorna um novo par.
	 *
	 * Caso o token seja inválido ou expirado, lança `UnauthorizedException`.
	 *
	 * @param rawToken Token opaco recebido do cookie do cliente.
	 * @returns Novo par de tokens (Access + Refresh).
	 */
	async refreshAccessToken(rawToken: string): Promise<{
		accessToken: string;
		rawRefreshToken: string;
		refreshExpiresAt: Date;
	}> {
		const record = await this.refreshTokenRepository.findByRawToken(rawToken);

		if (!record) {
			throw new UnauthorizedException("Refresh token inválido ou revogado.");
		}

		if (new Date(record.expires_at) < new Date()) {
			// Limpeza preventiva do token expirado
			await this.refreshTokenRepository.deleteByRawToken(rawToken);
			throw new UnauthorizedException("Refresh token expirado.");
		}

		// Rotação: remove o token antigo antes de emitir o novo
		await this.refreshTokenRepository.deleteByRawToken(rawToken);

		const user = { id: record.user_id, mail: "" };

		// Obtém o e-mail atualizado do usuário para incluir no novo token
		const userRecord = await this.userRepository.getInfo(record.user_id);
		if (userRecord) {
			user.mail = userRecord.mail;
		}

		// O novo refresh token mantém o mesmo TTL residual ou usa o padrão
		const originalExpiresAt = new Date(record.expires_at);
		const remainingMs = originalExpiresAt.getTime() - Date.now();
		const rememberMe = remainingMs > RT_TTL_DEFAULT_MS;

		return this.generateTokenPair(user, rememberMe);
	}

	/**
	 * Invalida um refresh token específico (logout do dispositivo atual).
	 *
	 * @param rawToken Token opaco recebido do cookie.
	 */
	async revokeRefreshToken(rawToken: string): Promise<void> {
		await this.refreshTokenRepository.deleteByRawToken(rawToken);
	}

	// ─────────────────────────────────────────────────────────────
	// User management
	// ─────────────────────────────────────────────────────────────

	/**
	 * Realiza o cadastro de um novo usuário no sistema.
	 *
	 * @description
	 * Valida a existência prévia do endereço de e-mail informado antes de
	 * efetuar o cadastro. Caso o e-mail já esteja associado a uma conta,
	 * interrompe a operação e retorna uma exceção de conflito.
	 *
	 * Quando os dados são válidos, delega ao repositório a criação do novo
	 * usuário e retorna uma mensagem indicando o sucesso da operação.
	 *
	 * Exceções de negócio previamente tratadas são propagadas sem alteração.
	 * Demais falhas inesperadas são convertidas em exceções internas para
	 * preservar a consistência das respostas da aplicação.
	 *
	 * @param registerDto Dados necessários para o cadastro do usuário.
	 * @returns Objeto contendo a mensagem de confirmação do cadastro.
	 */
	async registerUser(registerDto: RegisterDto) {
		try {
			if (await this.existUser(registerDto.mail)) {
				throw new ConflictException("Email already exists");
			}
			await this.userRepository.create(registerDto);
			return { message: "User created successfully" };
		} catch (error: any) {
			if (error instanceof HttpException) throw error;
			throw new InternalServerErrorException("Erro interno");
		}
	}

	/**
	 * Verifica a existência de um usuário pelo endereço de e-mail.
	 *
	 * @description
	 * Consulta o repositório de usuários para identificar se já existe
	 * um cadastro associado ao e-mail informado. Este método é utilizado
	 * principalmente em fluxos de registro e validação de unicidade de contas.
	 *
	 * @param mail Endereço de e-mail a ser verificado.
	 * @returns Promessa contendo o usuário encontrado ou `null`/`undefined`
	 * caso não exista um registro correspondente.
	 */
	async existUser(mail: string) {
		return await this.userRepository.findByEmail(mail);
	}
}
