import { Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { DYNAMO } from './dynamodb.client';
import { EventClient } from './event-client';

export interface Booking {
  bookingId: string;
  eventId: string;
  customerEmail: string;
  quantity: number;
  totalAmount: number;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
}

const TABLE = process.env.BOOKINGS_TABLE ?? 'Bookings';

@Injectable()
export class BookingsService implements OnModuleInit {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @Inject(DYNAMO) private readonly db: DynamoDBDocumentClient,
    private readonly events: EventClient,
  ) {}

  async onModuleInit() {
    try {
      await this.db.send(new DescribeTableCommand({ TableName: TABLE }));
      this.logger.log(`Table ${TABLE} already exists`);
    } catch (err) {
      if (!(err instanceof ResourceNotFoundException)) throw err;
      await this.db.send(
        new CreateTableCommand({
          TableName: TABLE,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [{ AttributeName: 'bookingId', AttributeType: 'S' }],
          KeySchema: [{ AttributeName: 'bookingId', KeyType: 'HASH' }],
        }),
      );
      this.logger.log(`Created table ${TABLE}`);
    }
  }

  async create(input: { eventId: string; customerEmail: string; quantity: number }): Promise<Booking> {
    const updatedEvent = await this.events.reserve(input.eventId, input.quantity);
    const booking: Booking = {
      bookingId: randomUUID(),
      eventId: input.eventId,
      customerEmail: input.customerEmail,
      quantity: input.quantity,
      totalAmount: updatedEvent.price * input.quantity,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };
    await this.db.send(new PutCommand({ TableName: TABLE, Item: booking }));
    this.logger.log(`Booking ${booking.bookingId} created for event ${input.eventId}`);
    return booking;
  }

  async get(bookingId: string): Promise<Booking> {
    const res = await this.db.send(
      new GetCommand({ TableName: TABLE, Key: { bookingId } }),
    );
    if (!res.Item) throw new NotFoundException(`Booking ${bookingId} not found`);
    return res.Item as Booking;
  }
}
