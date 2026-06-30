import { IsBoolean, IsEmail, IsNotEmpty, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    description: "E-mail do usuário",
    example: "usuario@email.com",
  })
  @IsEmail()
  mail: string;

  @ApiProperty({ description: "Senha do usuário", example: "senha123" })
  @IsNotEmpty()
  @MinLength(4)
  pass: string;

  @ApiProperty({ description: "Nome do usuário", example: "João" })
  @MinLength(3)
  username: string;

  @ApiProperty({ description: "Lembrar login do usuário", example: true })
  @IsBoolean()
  rememberMe: boolean;
}
