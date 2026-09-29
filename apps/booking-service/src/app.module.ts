import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { DynamoProvider } from './dynamodb.client';
import { EventClient } from './event-client';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService, DynamoProvider, EventClient],
})
export class AppModule {}
