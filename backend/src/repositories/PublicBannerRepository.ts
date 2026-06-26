import { Injectable } from "@nestjs/common";
import { DataBaseService } from "../services/DataBaseService";

/**
 * Repositório responsável pelo acesso e manipulação dos dados de banners públicos.
 *
 * @description
 * Centraliza as operações de persistência relacionadas aos banners
 * exibidos nas áreas públicas da aplicação, encapsulando consultas,
 * inserções, atualizações e remoções executadas no banco de dados.
 *
 * Esta camada tem como objetivo isolar as regras de acesso aos dados,
 * promovendo organização, reutilização e manutenção das operações SQL
 * relacionadas aos banners públicos, como hero sliders, banners
 * promocionais e demais elementos visuais exibidos no e-commerce.
 */
@Injectable()
export class PublicBannerRepository {
	constructor(private readonly dataBaseService: DataBaseService) {}

	/**
	 * Obtém os banners públicos de um tipo específico.
	 *
	 * @description
	 * Realiza a consulta dos banners cadastrados com base no tipo informado,
	 * retornando os registros ordenados conforme a posição de exibição
	 * configurada no sistema.
	 *
	 * Este método é utilizado para carregar diferentes conjuntos de banners,
	 * como hero sliders, banners promocionais e outras áreas visuais do
	 * e-commerce que dependem de organização por tipo e ordem de exibição.
	 *
	 * @param type Tipo de banner a ser consultado.
	 * @returns Promessa contendo a lista de banners ordenados para exibição.
	 */
	public async getBannersByType(type: string): Promise<any[]> {
		const db = await this.dataBaseService.getDatabase();
		return await db.all(
			"SELECT * FROM banners WHERE type = ? ORDER BY order_index ASC",
			[type],
		);
	}
}
