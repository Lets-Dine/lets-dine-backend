import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { printStartupBanner } from "{scope}/core/utils";
import { AppModule } from "./app/app.module";

const APP_NAME = process.env.APP_NAME ?? "{service-name}";
const API_PREFIX = "api";
const DOCS_PATH = `/${API_PREFIX}/docs`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix(API_PREFIX);

  const swaggerConfig = new DocumentBuilder().setTitle(APP_NAME).addBearerAuth().build();
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  printStartupBanner({ name: APP_NAME, port, docsPath: DOCS_PATH, apiPrefix: API_PREFIX });
}

bootstrap();
