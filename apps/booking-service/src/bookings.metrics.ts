import { getMeter } from '@tickets/observability';

const meter = getMeter('tickets.booking-service');

/**
 * Métricas de negocio del booking-service (sección 4.3 del práctico).
 *
 * Naming: OTel semantic conventions recomiendan puntos como separador y
 * el sufijo de unidad al final para métricas custom. En Prometheus estos
 * nombres se traducen a `bookings_created_total`, `bookings_total_amount_ars_total`,
 * `bookings_creation_duration_ms_bucket`, etc.
 */

export const bookingsCreatedCounter = meter.createCounter('bookings.created', {
  description: 'Cantidad de bookings creados',
  unit: '{booking}',
});

export const bookingsRevenueCounter = meter.createCounter('bookings.total_amount', {
  description: 'Monto total facturado en bookings creados',
  unit: 'ARS',
});

export const bookingCreationDuration = meter.createHistogram('bookings.creation.duration', {
  description: 'Duración de la creación de un booking end-to-end (incluye llamada a events-service)',
  unit: 'ms',
});
