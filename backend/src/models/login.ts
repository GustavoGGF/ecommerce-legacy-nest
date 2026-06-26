import { IsEmail, IsNotEmpty, MinLength, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
	@ApiProperty({
		description: "E-mail do usuário",
		example: "usuario@email.com",
	})
	@IsEmail()
	mail: string;

	@ApiProperty({ description: "Senha do usuário", example: "senha123" })
	@IsNotEmpty()
	@MinLength(4)
	@IsString()
	pass: string;
}
