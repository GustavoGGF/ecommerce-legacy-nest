import {
	ExecutionContext,
	Injectable,
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserService } from "../services/UserService";

/**
 * Guard de segurança especializado para a interface de gerenciamento (Management).
 *
 * @description
 * Este Guard estende a estratégia JWT padrão para implementar regras de negócio específicas:
 * 1. Bypass automático para ativos estáticos (imagens, scripts, estilos).
 * 2. Redirecionamento inteligente: Navegadores são enviados para o login, APIs recebem 401.
 * 3. Verificação de integridade de conta via banco de dados.
 * 4. Validação de perfil administrativo (Manager/Admin).
 *
 * @category Guards
 */
@Injectable()
export class JwtManagerGuard extends AuthGuard("jwt") {
	private readonly logger = new Logger("JwtAuthGuard");
	constructor(private readonly userService: UserService) {
		super();
	}

	/**
	 * Orquestra o fluxo de autorização da requisição.
	 *
	 * @param {ExecutionContext} context - Contexto da execução do NestJS.
	 * @returns {Promise<boolean>} Retorna true se o acesso for permitido.
	 *
	 * @throws {UnauthorizedException} Se o usuário for inválido ou não possuir perfil administrativo.
	 * @description
	 * Realiza o tratamento de erros do Passport para permitir o redirecionamento manual
	 * em caso de falha de autenticação em requisições de página.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const url = request.url;

		const isStaticFile =
			/\.(js|css|jpg|jpeg|png|gif|svg|ico|webp|ttf|woff|woff2|map|json)$/i.test(
				url,
			);

		if (isStaticFile) return true;

		try {
			await super.canActivate(context);
		} catch (err) {
			const response = context.switchToHttp().getResponse();
			// Se for uma requisição de navegador (que aceita HTML), redireciona
			if (request.headers.accept?.includes("text/html")) {
				response.redirect("/login");
				return false;
			}
			// Se for uma chamada de API (JSON), lança o erro original (401)
			throw err;
		}

		const user = request.user;

		const isValid = await this.userService.getSpecificUser(user.id, user.mail);

		if (!isValid) {
			const response = context.switchToHttp().getResponse();
			if (request.headers.accept?.includes("text/html")) {
				response.redirect("/login");
				return false;
			}
			throw new UnauthorizedException("Usuário inválido");
		}

		const isManager = await this.userService.checkIsManager(user.id);

		if (!isManager) {
			const response = context.switchToHttp().getResponse();
			if (request.headers.accept?.includes("text/html")) {
				response.redirect("/login");
				return false;
			}
			throw new UnauthorizedException("Perfil inválido");
		}

		return true;
	}
}
