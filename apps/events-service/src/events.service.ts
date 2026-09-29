import { Inject, Injectable, Logger, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from './redis.client';

export interface EventEntity {
  id: string;
  name: string;
  venue: string;
  date: string;
  price: number;
  availableSeats: number;
}

const SEED: EventEntity[] = [
  { id: 'e1', name: 'Rock en el Estadio', venue: 'Estadio Único', date: '2026-11-12', price: 15000, availableSeats: 200 },
  { id: 'e2', name: 'Jazz Nights', venue: 'Teatro Colón', date: '2026-12-03', price: 22000, availableSeats: 80 },
  { id: 'e3', name: 'Festival Indie', venue: 'Parque Centenario', date: '2026-12-20', price: 9000, availableSeats: 500 },
  { id: 'e4', name: 'Sinfónica', venue: 'CCK', date: '2027-01-15', price: 18000, availableSeats: 120 },
];

const KEY = (id: string) => `event:${id}`;

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleInit() {
    const existing = await this.redis.keys('event:*');
    if (existing.length > 0) {
      this.logger.log(`Redis already seeded (${existing.length} events)`);
      return;
    }
    for (const e of SEED) {
      await this.redis.set(KEY(e.id), JSON.stringify(e));
    }
    this.logger.log(`Seeded ${SEED.length} events into Redis`);
  }

  async list(): Promise<EventEntity[]> {
    const keys = await this.redis.keys('event:*');
    if (keys.length === 0) return [];
    const raws = await this.redis.mget(...keys);
    return raws.filter((r): r is string => !!r).map((r) => JSON.parse(r) as EventEntity);
  }

  async get(id: string): Promise<EventEntity> {
    const raw = await this.redis.get(KEY(id));
    if (!raw) throw new NotFoundException(`Event ${id} not found`);
    return JSON.parse(raw) as EventEntity;
  }

  async reserve(id: string, quantity: number): Promise<EventEntity> {
    if (quantity < 1 || quantity > 10) {
      throw new BadRequestException('quantity must be between 1 and 10');
    }
    const evt = await this.get(id);
    if (evt.availableSeats < quantity) {
      throw new BadRequestException(`Only ${evt.availableSeats} seats left`);
    }
    evt.availableSeats -= quantity;
    await this.redis.set(KEY(id), JSON.stringify(evt));
    this.logger.log(`Reserved ${quantity} seats for event ${id}`);
    return evt;
  }
}
