import { IsBoolean, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AddressModel {
  @ApiProperty({ description: "Nome do local", example: "Casa" })
  @IsString()
  label: string;

  @ApiProperty({ description: "CEP do local", example: "01001-000" })
  @IsString()
  zip_code: string;

  @ApiProperty({ description: "Nome da rua", example: "Praça da Sé" })
  @IsString()
  street: string;

  @ApiProperty({ description: "Número", example: "10" })
  @IsString()
  number: string;

  @ApiPropertyOptional({ description: "Complemento", example: "Apto 10" })
  @IsString()
  complement?: string;

  @ApiProperty({ description: "Bairro", example: "Sé" })
  @IsString()
  neighborhood: string;

  @ApiProperty({ description: "Cidade", example: "São Paulo" })
  @IsString()
  city: string;

  @ApiProperty({ description: "Estado (UF)", example: "SP" })
  @IsString()
  state: string;

  @ApiProperty({ description: "Se é o endereço principal", example: true })
  @IsBoolean()
  is_main: boolean;
}
