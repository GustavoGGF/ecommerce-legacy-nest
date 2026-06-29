import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";
import { BadRequestException, Logger, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { join } from "path";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.use(cookieParser());

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          const formattedErros = errors.map((error) => {
            const property = error.property;
            const reasons = error.constraints
              ? Object.values(error.constraints).join(" e ")
              : "Erro desconhecido";

            return `${property}: ${reasons}`;
          });

          return new BadRequestException({
            statusCode: 400,
            message: formattedErros,
            error: "Bad Request",
          });
        },
      }),
    );

    app.use((req, res, next) => {
      console.log(`[${req.method}] -> ${req.url}`);
      next();
    });

    app.useStaticAssets(join(process.cwd(), "static"), {
      prefix: "/static",
    });

    const port = process.env.PORT || 3000;

    if (process.env.NODE_ENV !== "production") {
      const config = new DocumentBuilder()
        .setTitle("Utilidade das API'S")
        .setDescription("Descrição das API")
        .setVersion("1.0")
        .addTag("My Account")
        .addBearerAuth()
        .build();

      const documentFactory = () => SwaggerModule.createDocument(app, config);
      SwaggerModule.setup("api", app, documentFactory);
    }

    await app.listen(port, "0.0.0.0");

    logger.log(`Servidor rodando na porta: ${port}`);
  } catch (error) {
    logger.error("Erro ao iniciar o servidor", error.stack);
  }
}
void bootstrap();
