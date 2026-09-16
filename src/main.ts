import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { printStartupBanner } from "./common/utils/startup-banner";

const APP_NAME = process.env.APP_NAME ?? "lets-dine";
const API_PREFIX = "api/v1";
const DOCS_PATH = `/${API_PREFIX}/docs`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix(API_PREFIX);
  // §38 — order lifecycle events push over this instead of either side polling.
  app.useWebSocketAdapter(new IoAdapter(app));

  const swaggerConfig = new DocumentBuilder()
    .setTitle(APP_NAME)
    .setDescription("Restaurant dining experience platform — diner (public) and restaurant (staff) APIs")
    .addBearerAuth()
    .build();
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, swaggerConfig));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  printStartupBanner({ name: APP_NAME, port, docsPath: DOCS_PATH, apiPrefix: API_PREFIX });
}

bootstrap();
