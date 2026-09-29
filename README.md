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
                 │  :3001 (UI)    │     └────────┬─────────┘
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

- **Frontend**: http://localhost:8091
- **Grafana**: http://localhost:3001 (login anónimo con rol Admin)
- Events API: http://localhost:5001/events
- Booking API: http://localhost:5002/bookings/<id>

### Ver telemetría en Grafana

Al levantar el stack, se auto-provisionan **4 dashboards** en la carpeta **"Tickets Observability"** (sidebar → Dashboards):

1. **Tickets · Service Overview (RED)** — RPS, error rate, latencias p50/p95/p99, breakdown por route/método/status, event loop utilization. Variable `$service`.
2. **Tickets · Distributed Traces** — buscador Tempo con filtro por servicio. El waterfall muestra **web → booking-service → events-service** con propagación de contexto. Desde cualquier span, el botón *"Logs for this span"* salta a Loki correlacionado por `trace_id`.
3. **Tickets · Logs + Traces** — logs de ambos servicios con volumen y `trace_id` derivado clickeable que abre la traza en Tempo.
4. **Tickets · Bookings (business metrics)** — métricas custom del dominio: bookings creados, revenue en ARS, duración p50/p95/p99 de crear un booking, y bookings con error. Emitidas desde `apps/booking-service/src/bookings.metrics.ts`.

Flow sugerido:
1. Andá a http://localhost:8091 y hacé una reserva.
2. Abrí **Distributed Traces** y buscá la traza recién generada.
3. Después de correr `./scripts/load.sh 60`, mirá el **Service Overview** y el dashboard **Bookings** — vas a ver RPS, latencias, y las métricas de negocio.

También podés explorar manualmente en **Explore**:
- Tempo → Search por `service.name`
- Prometheus → `http_server_request_duration_seconds_count` (naming HTTP semconv estable) o `bookings_created_total` (métrica custom)
- Loki → `{service_name="booking-service"}` — cada log incluye `trace_id` y `span_id` inyectados por `PinoInstrumentation`

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
grafana/
  dashboards/        # 3 dashboards JSON auto-provisionados
  provisioning/      # config de provisioning (dashboards)
docs/
  grafana-cloud.md   # guía para conectar el práctico a Grafana Cloud
docker-compose.yml
otel-collector-config.yaml
scripts/load.sh
```

---

## Grafana Cloud (opcional)

Guía completa paso a paso en **[docs/grafana-cloud.md](docs/grafana-cloud.md)**: crear cuenta free, obtener el OTLP endpoint + instance ID + token, armar el header de auth, y togglar el exporter en el collector.

---

## Créditos

Práctico original en .NET: [nfornaro/tickets-observability](https://github.com/nfornaro/tickets-observability).
Port a Node.js para la materia **Arquitectura de Software en la Práctica** (org [IngSoft-ASP-2023-2](https://github.com/IngSoft-ASP-2023-2)).
