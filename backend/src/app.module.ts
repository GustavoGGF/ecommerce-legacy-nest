import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AppController } from "./app.controller";
import { AuthController } from "./controllers/AuthController";
import { AuthService } from "./services/AuthService";
import { PassportModule } from "@nestjs/passport";
import { LocalStrategy } from "./rules/LocalStrategy";
import { UserRepository } from "./repositories/UserRepository";
import { RefreshTokenRepository } from "./repositories/RefreshTokenRepository";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtUserData } from "./rules/JwtUserData";
import { UserController } from "./controllers/UserController";
import { UserService } from "./services/UserService";
import { AddressService } from "./services/AdressesService";
import { AddressesRepository } from "./repositories/AddressesRepository";
import { JwtAuthGuard } from "./rules/JwtAuthGuard";
import { MyAccountController } from "./controllers/MyAccountController";
import { ProductRepository } from "./repositories/ProductRepository";
import { ManagerService } from "./services/ManagerService";
import { JwtManagerGuard } from "./rules/JwtManagerGuard";
import { ProductColorRepository } from "./repositories/ProductColorRepository";
import { DataBaseService } from "./services/DataBaseService";
import { PublicRepository } from "./repositories/PublicRepository";
import { PublicController } from "./controllers/PublicController";
import { ProductController } from "./controllers/ProductController";
import { BannerController } from "./controllers/BannerController";
import { PublicBannersController } from "./controllers/PublicBannersController";
import { PublicBannerService } from "./services/PublicBannerService";
import { PublicBannerRepository } from "./repositories/PublicBannerRepository";
import { PublicService } from "./services/PublicService";
import { CacheModule } from "@nestjs/cache-manager";
import { DiscountService } from "./services/DiscountService";
import { DiscountCronTask } from "./services/DiscountCronTask";
import { CatalogRepository } from "./repositories/CatalogRepository";
import { CatalogService } from "./services/CatalogService";
import { SearchIndexService } from "./services/SearchIndexService";
import { SearchIndexRepository } from "./repositories/SearchIndexRepository";
import { ProductColorsService } from "./services/ProductColorsService";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		PassportModule,
		ServeStaticModule.forRoot({
			rootPath: join(__dirname, "..", "client", "browser"),
			serveStaticOptions: {
				index: "index.csr.html",
			},
		}),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get<string>("JWT_SECRET"),
				signOptions: { expiresIn: "15m" },
			}),
		}),
		CacheModule.register({
			ttl: 900000,
			max: 100,
		}),
	],
	controllers: [
		AuthController,
		UserController,
		MyAccountController,
		PublicController,
		ProductController,
		BannerController,
		PublicBannersController,
		AppController,
	],
	providers: [
		AuthService,
		LocalStrategy,
		UserRepository,
		RefreshTokenRepository,
		JwtUserData,
		UserService,
		AddressService,
		AddressesRepository,
		JwtAuthGuard,
		ProductRepository,
		ManagerService,
		JwtManagerGuard,
		ProductColorRepository,
		DataBaseService,
		PublicRepository,
		PublicService,
		DiscountCronTask,
		DiscountService,
		CatalogRepository,
		CatalogService,
		SearchIndexService,
		SearchIndexRepository,
		ProductColorsService,
		PublicBannerService,
		PublicBannerRepository,
	],
})
export class AppModule {}
