import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

export interface EventEntity {
  id: string;
  name: string;
  price: number;
  availableSeats: number;
}

@Injectable()
export class EventClient {
  private readonly logger = new Logger(EventClient.name);
  private readonly baseUrl = process.env.EVENTS_SERVICE_URL ?? 'http://localhost:5001';

  async get(eventId: string): Promise<EventEntity> {
    const res = await fetch(`${this.baseUrl}/events/${eventId}`);
    if (!res.ok) {
      throw new BadGatewayException(`events-service GET /events/${eventId} → ${res.status}`);
    }
    return (await res.json()) as EventEntity;
  }

  async reserve(eventId: string, quantity: number): Promise<EventEntity> {
    const res = await fetch(`${this.baseUrl}/events/${eventId}/reservations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new BadGatewayException(
        `events-service reserve failed (${res.status}): ${body}`,
      );
    }
    return (await res.json()) as EventEntity;
  }
}
