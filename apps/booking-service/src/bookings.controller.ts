import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsEmail, IsInt, IsString, Max, Min } from 'class-validator';
import { BookingsService } from './bookings.service';

class CreateBookingDto {
  @IsString()
  eventId!: string;

  @IsEmail()
  customerEmail!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;
}

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookings.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bookings.get(id);
  }
}
