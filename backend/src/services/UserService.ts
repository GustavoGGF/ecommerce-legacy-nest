import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { UserInfoDTO } from "../models/user";
import { UserRepository } from "../repositories/UserRepository";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  userRepository = new UserRepository();

  async updateUserInfo(userId: number, userInfoDTO: UserInfoDTO) {
    try {
      await this.userRepository.updateInfo(userId, userInfoDTO);
      return { message: "User info updated successfully" }; // Retorna apenas o dado
    } catch (error: any) {
      // 2. Tratamento de erro específico do SQLite
      if (error.message.includes("UNIQUE")) {
        throw new ConflictException("Email already exists");
      }

      // 3. Erro genérico
      throw new InternalServerErrorException("Internal Server Error");
    }
  }

  async getUserInfo(userId: number) {
    try {
      return await this.userRepository.getInfo(userId);
    } catch (error) {
      this.logger.error(`Failed to get user info for userId ${userId}`, error.stack);
      throw new InternalServerErrorException("Falha ao obter informações do usuario");
    }
  }

  async getSpecificUser(userID: number, userMail: string) {
    try {
      return await this.userRepository.getSpecificUser(userID, userMail);
    } catch (error) {
      this.logger.error(`Erro ao obter o usuário: ${error}`);
      throw new InternalServerErrorException("Erro ao obter o usuário");
    }
  }

  async checkIsManager(userId: number) {
    try {
      return await this.userRepository.getManagerProfile(userId);
    } catch (error) {
      this.logger.error(`Erro ao obter o Perfil: ${error}`);
      throw new InternalServerErrorException("Erro ao obter o perfil");
    }
  }
}
