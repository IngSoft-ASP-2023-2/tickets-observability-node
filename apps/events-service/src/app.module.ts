import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RedisProvider } from './redis.client';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // No usamos pino-pretty en containers — dejamos JSON estructurado
        // para que el Pino instrumentation bridgee al Logs API de OTel.
      },
    }),
  ],
  controllers: [EventsController],
  providers: [EventsService, RedisProvider],
})
export class AppModule {}
