import {
	Injectable,
	InternalServerErrorException,
	Logger,
} from "@nestjs/common";
import { PublicBannerRepository } from "../repositories/PublicBannerRepository";

@Injectable()
export class PublicBannerService {
	private readonly logger = new Logger(PublicBannerService.name);

	constructor(private readonly repository: PublicBannerRepository) {}

	/**
	 * Obtém os banners públicos de um tipo específico.
	 *
	 * @description
	 * Solicita ao repositório a lista de banners cadastrados para o tipo
	 * informado, retornando os registros configurados para exibição na
	 * área correspondente da aplicação.
	 *
	 * Este método pode ser utilizado para recuperar banners de diferentes
	 * contextos, como hero sliders, banners promocionais e demais elementos
	 * visuais organizados por categoria de exibição.
	 *
	 * Em caso de falha durante a consulta, registra o erro no logger e
	 * lança uma exceção interna para tratamento pela aplicação.
	 *
	 * @param type Tipo de banner a ser consultado.
	 * @returns Promessa contendo a lista de banners encontrados para o tipo informado.
	 */
	public async getBannersByType(type: string): Promise<any[]> {
		try {
			return await this.repository.getBannersByType(type);
		} catch (error) {
			this.logger.error(`Erro ao obter banners do tipo '${type}': ${error}`);
			throw new InternalServerErrorException("Erro ao buscar os banners.");
		}
	}
}
