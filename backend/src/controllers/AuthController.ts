import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { LoginDto } from "../models/login";
import { RegisterDto } from "../models/register";
import { AuthService } from "../services/AuthService";
import { JwtAuthGuard } from "../rules/JwtAuthGuard";

const REFRESH_TOKEN_PATH = "/auth";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Define o cookie `refresh_token` na resposta HTTP.
	 *
	 * @description
	 * Configura o cookie com as seguintes flags de segurança:
	 * - `httpOnly`: impede acesso pelo JavaScript do navegador (proteção contra XSS).
	 * - `secure`: ativo apenas em produção (`NODE_ENV=production`) para exigir HTTPS.
	 * - `sameSite: 'strict'`: bloqueia o envio em requisições cross-site (proteção contra CSRF).
	 * - `path`: restrito a `/auth` para que o cookie não seja enviado em outras rotas.
	 *
	 * @param res         Objeto de resposta Express.
	 * @param rawToken    Valor opaco do Refresh Token.
	 * @param expiresAt   Data de expiração do token.
	 */
	private setRefreshTokenCookie(
		res: Response,
		rawToken: string,
		expiresAt: Date,
	): void {
		const cookieName =
			this.configService.get<string>("REFRESH_TOKEN_COOKIE") || "refresh_token";
		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		res.cookie(cookieName, rawToken, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "strict",
			path: REFRESH_TOKEN_PATH,
			expires: expiresAt,
		});
	}

	/**
	 * Remove o cookie `refresh_token` da resposta HTTP.
	 *
	 * @description
	 * Limpa o cookie configurado para o Refresh Token do navegador, utilizando
	 * as mesmas flags de segurança (`httpOnly`, `secure`, `sameSite` e `path`)
	 * definidas na criação para garantir a correta remoção do cookie.
	 *
	 * @param res Objeto de resposta Express.
	 */
	private clearRefreshTokenCookie(res: Response): void {
		const cookieName =
			this.configService.get<string>("REFRESH_TOKEN_COOKIE") || "refresh_token";
		const isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
		res.clearCookie(cookieName, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "strict",
			path: REFRESH_TOKEN_PATH,
		});
	}

	@ApiOperation({
		summary: "Realiza o login do usuário",
		description:
			"Valida as credenciais via estratégia local e retorna o JWT. A expiração do token é estendida caso o campo 'rememberMe' seja enviado como verdadeiro.",
	})
	@ApiConsumes("application/json")
	@ApiResponse({
		status: 200,
		description:
			"Login bem-sucedido. Retorna os dados do usuário e o access_token.",
	})
	@ApiResponse({
		status: 401,
		description: "Credenciais inválidas (E-mail ou senha incorretos).",
	})
	@ApiBody({ type: LoginDto })
	@UseGuards(AuthGuard("local"))
	@Post("login")
	@HttpCode(HttpStatus.OK)
	async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const rememberMe: boolean = req.body.rememberMe === true;
		const user = req.user as { id: number; mail: string };
		const { accessToken, rawRefreshToken, refreshExpiresAt } =
			await this.authService.generateTokenPair(user, rememberMe);
		this.setRefreshTokenCookie(res, rawRefreshToken, refreshExpiresAt);
		return {
			message: "Login bem-sucedido",
			user,
			access_token: accessToken,
		};
	}

	@ApiOperation({
		summary: "Cadastra um novo usuário",
		description: "Cria um novo registro de usuário no banco de dados.",
	})
	@ApiConsumes("application/json")
	@ApiResponse({ status: 201, description: "Usuário cadastrado com sucesso." })
	@ApiResponse({
		status: 409,
		description: "Conflito: O e-mail informado já está em uso.",
	})
	@ApiResponse({ status: 500, description: "Erro interno do servidor" })
	@ApiBody({ type: RegisterDto })
	@Post("register")
	@HttpCode(HttpStatus.CREATED)
	async register(@Body() registerDto: RegisterDto) {
		return this.authService.registerUser(registerDto);
	}

	@ApiOperation({
		summary: "Encerra a sessão do usuário (logout)",
		description:
			"Invalida o Refresh Token no banco de dados e remove o cookie correspondente. " +
			"O Access Token continua válido até sua expiração natural (15 min), " +
			"portanto o cliente deve descartá-lo localmente.",
	})
	@ApiBearerAuth()
	@ApiResponse({ status: 200, description: "Logout realizado com sucesso." })
	@ApiResponse({ status: 401, description: "Usuário não autenticado." })
	@UseGuards(JwtAuthGuard)
	@Post("logout")
	@HttpCode(HttpStatus.OK)
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const cookieName =
			this.configService.get<string>("REFRESH_TOKEN_COOKIE") || "refresh_token";
		const rawToken: string | undefined = (
			req.cookies as Record<string, string>
		)?.[cookieName];
		if (rawToken) {
			await this.authService.revokeRefreshToken(rawToken);
		}
		this.clearRefreshTokenCookie(res);
		return { message: "Logout realizado com sucesso." };
	}
}
