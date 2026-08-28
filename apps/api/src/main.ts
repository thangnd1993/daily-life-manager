import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const prefix = config.get<string>('app.apiPrefix', 'api');
  app.use(helmet());
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins', ['http://localhost:4200']),
  });
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  const swagger = new DocumentBuilder()
    .setTitle('Daily Life Manager API')
    .setDescription('Foundation API for Daily Life Manager')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    `${prefix}/docs`,
    app,
    SwaggerModule.createDocument(app, swagger),
  );
  await app.listen(config.get<number>('app.port', 3000));
}
void bootstrap();
