import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { DynamoProvider } from './dynamodb.client';
import { EventClient } from './event-client';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: { level: process.env.LOG_LEVEL ?? 'info' },
    }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, DynamoProvider, EventClient],
})
export class AppModule {}
