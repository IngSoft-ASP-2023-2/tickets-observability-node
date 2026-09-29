import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RedisProvider } from './redis.client';

@Module({
  controllers: [EventsController],
  providers: [EventsService, RedisProvider],
})
export class AppModule {}
