import { UserRepository } from "../repositories/UserRepository";
import { Strategy } from "passport-local";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import bcrypt from "../../node_modules/bcryptjs";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  logger = new Logger("LocalStrategy");
  constructor(private userRepository: UserRepository) {
    super({
      usernameField: "mail",
      passwordField: "pass",
    });
  }

  async validate(mail: string, pass: string): Promise<any> {
    try {
      const user = await this.userRepository.findByEmail(mail);

      if (!user) {
        throw new UnauthorizedException("Email ou Senha inválidos");
      }

      const isMatch = await bcrypt.compare(pass, user.pass);

      if (!isMatch) {
        throw new UnauthorizedException("Email ou Senha inválidos");
      }

      const { pass: _, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error(`Erro na validação do usuário: ${error.message}`);
      throw new UnauthorizedException(`Erro na validação do usuário: ${error.message}`);
    }
  }
}
