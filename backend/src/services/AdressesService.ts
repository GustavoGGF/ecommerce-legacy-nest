import {
	Injectable,
	InternalServerErrorException,
	Logger,
} from "@nestjs/common";
import { AddressesRepository } from "../repositories/AddressesRepository";

@Injectable()
export class AddressService {
	private readonly logger = new Logger(AddressService.name);

	addressesRepository = new AddressesRepository();

	async createAddress(userId: number, addressDTO: any) {
		try {
			await this.addressesRepository.createAddress(userId, addressDTO);
		} catch (error) {
			this.logger.error(
				`Failed to create address for userId ${userId}`,
				error.stack,
			);
			throw new InternalServerErrorException("Failed to create address");
		}
	}

	async getAddresses(userId: number) {
		return await this.addressesRepository.getAddresses(userId);
	}
}
