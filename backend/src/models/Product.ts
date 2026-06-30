import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from "class-validator";

export class CreateProductDto {
  @ApiProperty({
    description: "ID da categoria vinculada ao produto",
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @IsPositive()
  @Type(() => Number)
  categoria: number;

  @ApiProperty({
    description: "Nome comercial do produto",
    example: "Camiseta Algodão Premium",
  })
  @IsNotEmpty()
  @IsString()
  nome: string;

  @ApiProperty({
    description: "Preço de venda unitário",
    example: 89.99,
    format: "float",
  })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @IsNotEmpty()
  @IsPositive()
  @Type(() => Number)
  preco: number;

  @ApiPropertyOptional({
    description:
      "Id da Cor, quantidade e tamanho por cor disponivei (separadas por espaço entre vírgulas)",
    example: "12 22 'P', 5 9 'GG",
  })
  @IsString()
  @IsOptional()
  cores: string;

  @ApiPropertyOptional({
    description: "Descrição detalhada das carecterísticas do produto",
    example: "Tecido 100% algodão, fio 30.1 penteado.",
  })
  @IsString()
  @IsOptional()
  descricao: string;
}

export interface ColorVariant {
  color: string;
  quantity: number;
  size: string;
}
