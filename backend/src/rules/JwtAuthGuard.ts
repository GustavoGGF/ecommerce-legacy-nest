import {
	ExecutionContext,
	Injectable,
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserService } from "../services/UserService";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
	private readonly logger = new Logger("JwtAuthGuard");
	constructor(private readonly userService: UserService) {
		super();
	}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const canActivate = await super.canActivate(context);
		if (!canActivate) return false;

		const request = context.switchToHttp().getRequest();
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

		return true;
	}
}
