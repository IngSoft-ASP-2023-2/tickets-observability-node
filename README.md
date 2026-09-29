# 🎟️ tickets-observability-node

Práctico de **observabilidad con OpenTelemetry** en Node.js / NestJS.

Port del práctico original en .NET: **https://github.com/nfornaro/tickets-observability**.
Mantiene los mismos servicios, endpoints y semántica de telemetría, cambiando únicamente el runtime.

> 📚 **Material teórico completo** de la clase: [`docs/teorico-observabilidad.md`](docs/teorico-observabilidad.md) — logs, APM, métricas custom, distributed tracing, OpenTelemetry, Grafana y plataformas comerciales.

---

## ¿Qué se aprende?

Los **tres pilares** de observabilidad (traces, metrics, logs) sobre un sistema de ticketing de eventos con dos microservicios que se hablan entre sí:

- **Trazas distribuidas** end-to-end: `browser → booking-service → events-service` (3 saltos, con propagación de contexto W3C `traceparent`).
- **Métricas** de runtime, HTTP (semantic conventions estables) y **de negocio** (contadores custom emitidos desde el dominio).
- **Logs** estructurados con `trace_id` y `span_id` inyectados automáticamente para saltar del log a la traza en un click.

Todo se visualiza en **Grafana** (Tempo + Prometheus + Loki, empaquetados en la imagen `grafana/otel-lgtm`), con **4 dashboards auto-provisionados**.

---

## Stack técnico

- **Runtime**: Node.js 20 LTS, TypeScript 5, npm workspaces (monorepo).
- **Framework HTTP**: NestJS 10.
- **Logging**: `nestjs-pino` + `pino` — el bridge OTel toma los logs y los envía a Loki.
- **OpenTelemetry** (versiones actuales, `OTEL_SEMCONV_STABILITY_OPT_IN=http`):
  - SDK Node `@opentelemetry/sdk-node@0.222` + core stable `2.11`
  - Semantic conventions `1.43` — nombres de métricas HTTP estables (`http.server.request.duration`)
  - Instrumentaciones automáticas: http, nestjs-core, ioredis, aws-sdk (DynamoDB), runtime-node, **pino**
- **Datos**: Redis 7 (catálogo) + DynamoDB Local (bookings) — idem al original .NET.
- **Frontend**: nginx + HTML/JS vanilla + Tailwind CDN, con `@opentelemetry/sdk-trace-web` para trazas cliente.
- **Observability backend**: Grafana LGTM local + opción [Grafana Cloud](docs/grafana-cloud.md).

---

## Arquitectura

```
                 ┌───────────────┐
   browser ───►  │ web (nginx)   │ ── proxy ──┐
   :8091         └───────┬───────┘            │
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
- **booking-service** — reservas (DynamoDB Local); llama por HTTP a events-service y emite métricas custom.
- **web** — mini frontend estático instrumentado con `@opentelemetry/sdk-trace-web`.
- **otel-collector** — recibe OTLP y reenvía al stack LGTM (y opcionalmente a Grafana Cloud).
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
- Booking API: http://localhost:5002/bookings/&lt;id&gt;

### Ver telemetría en Grafana

Al levantar el stack, se auto-provisionan **4 dashboards** en la carpeta **"Tickets Observability"** (sidebar → Dashboards):

1. **Tickets · Service Overview (RED)** — RPS, error rate, latencias p50/p95/p99, breakdown por route/método/status, event loop utilization. Variable `$service`.
2. **Tickets · Distributed Traces** — buscador Tempo (panel `table`) con filtro por servicio. Cada fila abre el waterfall completo **web → booking-service → events-service** en Explore. Desde cualquier span, el botón *"Logs for this span"* salta a Loki correlacionado por `trace_id`.
3. **Tickets · Logs + Traces** — logs de ambos servicios con volumen y `trace_id` derivado clickeable que abre la traza en Tempo.
4. **Tickets · Bookings (business metrics)** — métricas custom del dominio: bookings creados, revenue en ARS, duración p50/p95/p99 de crear un booking, y bookings con error. Emitidas desde [`apps/booking-service/src/bookings.metrics.ts`](apps/booking-service/src/bookings.metrics.ts).

**Flow sugerido para la clase:**
1. Andá a http://localhost:8091 y hacé una reserva.
2. Abrí **Distributed Traces** (time range "Last 1 hour"), clickeá "Ver traza" en una fila y mostrá el waterfall de 3 saltos.
3. Desde un span de `booking-service`, clickeá *"Logs for this span"* → salta a Loki y muestra el log correlacionado por `trace_id`.
4. Corré `./scripts/load.sh 60` y volvé al **Service Overview** y al dashboard **Bookings** — RPS, latencias y contadores de negocio en vivo.

También podés explorar manualmente en **Explore**:
- Tempo → Search por `service.name`
- Prometheus → `http_server_request_duration_seconds_count` (naming HTTP semconv estable) o `bookings_created_total` (métrica custom)
- Loki → `{service_name="booking-service"}` — cada log incluye `trace_id` y `span_id` inyectados por `PinoInstrumentation`

### Generar carga

```bash
./scripts/load.sh 60   # 60 segundos de tráfico
```

---

## Métricas custom (dominio)

Definidas en [`apps/booking-service/src/bookings.metrics.ts`](apps/booking-service/src/bookings.metrics.ts), emitidas en `BookingsService.create()`. Traducción a nombres Prometheus:

| Instrumento OTel | Tipo | Unit | Nombre en Prometheus |
|---|---|---|---|
| `bookings.created` | Counter | `{booking}` | `bookings_created_total` |
| `bookings.total_amount` | Counter | `ARS` | `bookings_amount_ARS_total` |
| `bookings.creation.duration` | Histogram | `ms` | `bookings_creation_duration_milliseconds_{bucket,count,sum}` |

Cada emisión lleva atributos `event_id` y `status` (`CONFIRMED` / `ERROR`).

---

## Desarrollo local (sin docker para los servicios Node)

```bash
cp .env.example .env
docker compose up -d redis dynamodb-local otel-collector lgtm
npm install
npm run dev:events     # terminal 1
npm run dev:booking    # terminal 2
```

El frontend en `apps/web/index.html` se puede abrir directo con `python3 -m http.server -d apps/web 8091`, pero **perderás el proxy `/api/*`** — para el flow completo usá `docker compose up web`.

> ⚠️ **No commitear `.env`.** Ya está en `.gitignore`; cada alumno copia `.env.example` y completa sus credenciales localmente. Nunca pushear tokens de Grafana Cloud, AWS keys reales, etc.

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
  events-service/    # NestJS · Redis · nestjs-pino
  booking-service/   # NestJS · DynamoDB Local · métricas custom · nestjs-pino
  web/               # nginx + HTML + JS + OTel web
libs/
  observability/     # initObservability() + getMeter() reusables
grafana/
  dashboards/        # 4 dashboards JSON auto-provisionados
  provisioning/      # config de provisioning
docs/
  teorico-observabilidad.md   # material teórico general de la clase
  grafana-cloud.md            # guía para conectar a Grafana Cloud
scripts/
  load.sh                     # generador de tráfico
docker-compose.yml
otel-collector-config.yaml    # pipelines traces/metrics/logs
.env.example                  # nunca commitear .env real
```

---

## Grafana Cloud (opcional)

Guía completa paso a paso en **[docs/grafana-cloud.md](docs/grafana-cloud.md)**: crear cuenta free, obtener el OTLP endpoint + instance ID + token, armar el header de auth, y togglar el exporter `otlphttp/cloud` en el collector.

> ⚠️ El endpoint que da Grafana Cloud (`…grafana.net/otlp`) es **OTLP/HTTP**, no gRPC — usar exporter `otlphttp`, no `otlp`. Cuidado también con la indentación YAML de `authorization` bajo `headers:`.

### Importar los dashboards a Grafana Cloud

Los JSON en `grafana/dashboards/` tienen hardcodeado el UID de datasource del stack LGTM local (`prometheus`, `tempo`, `loki`). En Grafana Cloud los UIDs son distintos (`grafanacloud-<usuario>-prom`, `-traces`, `-logs`), así que al importar los paneles muestran "Datasource not found".

**Fix en 3 pasos por dashboard:**

1. Grafana Cloud → **Dashboards → New → Import** → pegar el JSON de `grafana/dashboards/NN-…json`.
2. Abierto el dashboard → ⚙️ **Settings → JSON Model** (o Ctrl+E en cada panel).
3. Reemplazar los UIDs (usá tu usuario de Cloud):

   | Buscar | Reemplazar por |
   |---|---|
   | `"uid": "prometheus"` | `"uid": "grafanacloud-<TU-USUARIO>-prom"` |
   | `"uid": "tempo"` | `"uid": "grafanacloud-<TU-USUARIO>-traces"` |
   | `"uid": "loki"` | `"uid": "grafanacloud-<TU-USUARIO>-logs"` |

4. **Save changes**.

Alternativa visual (sin tocar JSON): editar cada panel → arriba del query editor, cambiar el dropdown **"Data source"** al `grafanacloud-*` correspondiente → Apply → Save dashboard.

> El nombre exacto lo ves en Grafana Cloud → **Connections → Data sources** — buscá los que empiezan con `grafanacloud-`.

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Dashboard **Bookings** en 0 | Time range de 15 min sin tráfico nuevo | Correr `./scripts/load.sh 60` y refrescar |
| No aparecen trazas del `web` en Tempo | Consola del browser cacheada / OTel web no cargó | Ctrl+Shift+R en el frontend, F12 → verificar `[otel] web tracer registered` |
| Grafana Cloud "We could not find any traces yet" | Exporter `otlp` en vez de `otlphttp`, o `authorization` mal indentado | Ver `docs/grafana-cloud.md` |
| `booking-service` crashea al arrancar | DynamoDB Local todavía no está listo | Ya tiene `restart: unless-stopped`, esperá unos segundos |
| Grafana no encuentra el datasource `prometheus` en un panel | Panel `type: traces` (para 1 traza sola) en lugar de `type: table` (para listado) | Usar `table` con `queryType: traceqlSearch` |
| `http_server_duration_milliseconds_*` (naming viejo) | Falta `OTEL_SEMCONV_STABILITY_OPT_IN=http` | Ya está en el compose; para dev local, exportarlo en la shell |

---

## Créditos

Práctico original en .NET: [nfornaro/tickets-observability](https://github.com/nfornaro/tickets-observability).
Port a Node.js para la materia **Arquitectura de Software en la Práctica** (org [IngSoft-ASP-2023-2](https://github.com/IngSoft-ASP-2023-2)).
