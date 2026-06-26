import { IsEmail, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UserInfoDTO {
	@ApiProperty({
		description: "E-mail do usuário",
		example: "usuario@email.com",
	})
	@IsEmail()
	mail: string;

	@ApiProperty({ description: "Telefone do usuário", example: 11999999999 })
	phone: number;

	@ApiProperty({ description: "Nome do usuário", example: "João" })
	@MinLength(3)
	username: string;
}
