# 🎟️ tickets-observability-node

Práctico de **observabilidad con OpenTelemetry** en Node.js / NestJS.

Port del práctico original en .NET: **https://github.com/nfornaro/tickets-observability**.
Mantiene los mismos servicios, endpoints y semántica de telemetría, cambiando únicamente el runtime.

---

## ¿Qué se aprende?

Los **tres pilares** de observabilidad (traces, metrics, logs) sobre un sistema de ticketing de eventos con dos microservicios que se hablan entre sí:

- **Trazas distribuidas** end-to-end: `browser → booking-service → events-service` (3 saltos).
- **Métricas** de runtime y HTTP.
- **Logs** correlacionados con traces vía `trace_id`.

Todo se visualiza en **Grafana** (Tempo + Prometheus + Loki, empaquetados en la imagen `grafana/otel-lgtm`).

---

## Arquitectura

```
                 ┌───────────────┐
   browser ───►  │ web (nginx)   │ ── proxy ──┐
   :8080         └───────┬───────┘            │
                         │ OTLP/HTTP          │
                         ▼                    ▼
                 ┌─────────────────┐   ┌──────────────────┐
                 │ otel-collector  │◄──│ booking-service  │
                 │  :4317 (gRPC)   │   │  :5002 (NestJS)  │
                 │  :4318 (HTTP)   │   └────────┬─────────┘
                 └────────┬────────┘            │ HTTP
                          │                     ▼
                          ▼             ┌──────────────────┐
                 ┌────────────────┐     │ events-service   │
                 │  Grafana LGTM  │     │  :5001 (NestJS)  │
                 │  :3000 (UI)    │     └────────┬─────────┘
                 └────────────────┘              │
                                                 ▼
                                          ┌──────────┐
                                          │  Redis   │
                                          └──────────┘
                                          ┌──────────────┐
                          bookings ──────►│ DynamoDB Local│
                                          └──────────────┘
```

- **events-service** — catálogo de eventos (Redis).
- **booking-service** — reservas (DynamoDB Local); llama por HTTP a events-service.
- **web** — mini frontend estático (nginx + JS vanilla + Tailwind CDN) instrumentado con `@opentelemetry/sdk-trace-web`.
- **otel-collector** — recibe OTLP y reenvía al stack LGTM.
- **lgtm** — Grafana + Loki + Tempo + Prometheus, todo en un solo container.

---

## Requisitos

- Docker + Docker Compose
- (Solo si querés desarrollar sin docker) Node.js 20+

---

## Levantar el stack completo (recomendado)

```bash
docker compose up --build -d
```

Esperá ~30 s a que buildeen los servicios Node. Luego abrí:

- **Frontend**: http://localhost:8080
- **Grafana**: http://localhost:3000 (login anónimo con rol Admin)
- Events API: http://localhost:5001/events
- Booking API: http://localhost:5002/bookings/<id>

### Ver telemetría en Grafana

1. Andá a http://localhost:8080 y hacé una reserva.
2. En Grafana → **Explore** → data source **Tempo** → "Search" → filtrá por `service.name = web` (o `booking-service`).
3. Abrí una traza: verás los spans encadenados **web → booking-service → events-service** con propagación de contexto.
4. Data source **Prometheus** → query `http_server_request_duration_seconds_count` (o `http_server_duration_milliseconds_count`) → hay series para ambos servicios.
5. Data source **Loki** → query `{service_name="booking-service"}` → los logs incluyen `trace_id` y `span_id` para saltar a la traza.

### Generar carga

```bash
./scripts/load.sh 60   # 60 segundos de tráfico
```

---

## Desarrollo local (sin docker para los servicios Node)

```bash
cp .env.example .env
docker compose up -d redis dynamodb-local otel-collector lgtm
npm install
npm run dev:events     # terminal 1
npm run dev:booking    # terminal 2
```

El frontend en `apps/web/index.html` se puede abrir directo con `python3 -m http.server -d apps/web 8080`, pero **perderás el proxy `/api/*`** — para el flow completo usá `docker compose up web`.

---

## Endpoints

### events-service (`:5001`)

| Método | Ruta                          | Descripción                       |
|--------|-------------------------------|-----------------------------------|
| GET    | `/events`                     | Lista todos los eventos           |
| GET    | `/events/:id`                 | Detalle de un evento              |
| POST   | `/events/:id/reservations`    | Reserva cupos `{ quantity: 1..10 }` |

### booking-service (`:5002`)

| Método | Ruta               | Descripción                                          |
|--------|--------------------|------------------------------------------------------|
| POST   | `/bookings`        | `{ eventId, customerEmail, quantity }` → booking     |
| GET    | `/bookings/:id`    | Retorna el booking creado                            |

### Ejemplos `curl`

```bash
curl localhost:5001/events

curl -X POST localhost:5002/bookings \
  -H 'content-type: application/json' \
  -d '{"eventId":"e1","customerEmail":"a@b.com","quantity":2}'
```

---

## Estructura del repo

```
apps/
  events-service/    # NestJS · Redis
  booking-service/   # NestJS · DynamoDB Local · llama a events-service
  web/               # nginx + HTML + JS + OTel web
libs/
  observability/     # bootstrap OTel reutilizado por ambos servicios
docker-compose.yml
otel-collector-config.yaml
scripts/load.sh
```

---

## Grafana Cloud (opcional)

`otel-collector-config.yaml` incluye un exporter `otlp/cloud` comentado. Copiá `.env.example` a `.env`, completá las variables `GRAFANA_CLOUD_*` y descomentá el exporter y su referencia en los pipelines.

---

## Créditos

Práctico original en .NET: [nfornaro/tickets-observability](https://github.com/nfornaro/tickets-observability).
Port a Node.js para la materia **Arquitectura de Software en la Práctica** (org [IngSoft-ASP-2023-2](https://github.com/IngSoft-ASP-2023-2)).
