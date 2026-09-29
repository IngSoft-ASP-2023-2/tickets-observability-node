import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { EventsService } from './events.service';

class ReserveDto {
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;
}

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.events.get(id);
  }

  @Post(':id/reservations')
  reserve(@Param('id') id: string, @Body() dto: ReserveDto) {
    return this.events.reserve(id, dto.quantity);
  }
}
