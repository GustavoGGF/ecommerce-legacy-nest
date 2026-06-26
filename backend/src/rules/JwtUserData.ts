import { ConfigService } from "@nestjs/config";
import { Injectable, Logger } from "@nestjs/common";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
@Injectable()
export class JwtUserData extends PassportStrategy(Strategy) {
	private readonly logger = new Logger("JwtUserData");

	constructor(configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromExtractors([
				(request: Request) => {
					let token = null;
					if (request && request.cookies) {
						token = request.cookies["access_token"];
					}
					// Se não achou no cookie, tenta no Header Bearer
					return token || ExtractJwt.fromAuthHeaderAsBearerToken()(request);
				},
			]),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>("JWT_SECRET")!,
		});
	}
	async validate(payload: any) {
		return {
			id: payload.id,
			mail: payload.mail,
		};
	}
}
