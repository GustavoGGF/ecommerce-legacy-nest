import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DiscountService } from "../services/DiscountService";
import { RefreshTokenRepository } from "../repositories/RefreshTokenRepository";

/**
 * Task autônoma para gerenciamento de promoções.
 */
@Injectable()
export class DiscountCronTask implements OnModuleInit {
	private readonly logger = new Logger(DiscountCronTask.name);

	constructor(
		private readonly discountService: DiscountService,
		private readonly refreshTokenRepository: RefreshTokenRepository,
	) {}

	/**
	 * Lifecycle hook que roda ao iniciar a aplicação.
	 */
	async onModuleInit() {
		this.logger.log(
			"Verificando necessidade de rotação de descontos no início do servidor...",
		);
		await this.discountService.processAutomaticDiscounts(true);
	}

	// /**
	//  * Executa a rotina de descontos a cada 2 dias à meia-noite.
	//  *
	//  * @description
	//  * O padrão '0 0 */2 * *' significa:
	//  * Minuto 0, Hora 0, a cada 2 dias.
	// */
	@Cron("0 0 */2 * *")
	async handleDiscountRotation() {
		this.logger.log("Disparando rotina autônoma de rotação de descontos...");
		await this.discountService.processAutomaticDiscounts();

		this.logger.log("Removendo refresh tokens expirados do banco de dados...");
		await this.refreshTokenRepository.deleteExpired();
	}
}
