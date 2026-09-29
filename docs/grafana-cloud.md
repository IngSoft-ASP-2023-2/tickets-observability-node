# Conectar el práctico a Grafana Cloud

Esta guía te lleva paso a paso desde una cuenta cero hasta ver las trazas, métricas y logs de los servicios en **Grafana Cloud** (plan free, sin tarjeta). El práctico funciona sin esto — es opcional y complementa la instancia local LGTM.

---

## 1. Crear cuenta y stack

1. Andá a https://grafana.com/auth/sign-up/create-user y creá una cuenta con tu email/GitHub/Google.
2. Al terminar el signup, Grafana crea automáticamente un **stack** con un nombre estilo `tuusuario.grafana.net`. Ese stack incluye instancias gratuitas de **Prometheus / Mimir**, **Loki**, **Tempo** y una **Grafana** hosteada.
3. Anotá el nombre del stack — lo vas a necesitar como parte del endpoint OTLP.

Límites del free tier (Sep 2026): 10k series de métricas, 50 GB logs, 50 GB traces, 14 días de retención. Alcanza y sobra para este práctico.

---

## 2. Obtener credenciales OTLP

1. En el portal (`https://tuusuario.grafana.net`) andá a **Home → Connections → Add new connection**.
2. Buscá **"OpenTelemetry (OTLP)"** y hacé click.
3. Vas a ver una pantalla titulada *"Send data using OpenTelemetry Protocol (OTLP)"*. Ahí Grafana te muestra:
   - **OTLP endpoint** — algo como `https://otlp-gateway-prod-us-east-0.grafana.net/otlp`
   - **Instance ID** — un número (por ej. `987654`)
   - Un botón **"Generate now"** para crear un **API token** con scope `MetricsPublisher`, `logs:write`, `traces:write`.
4. Clickeá **Generate now**, copiá el token (`glc_...`). **No lo vas a poder ver de nuevo**, guardalo.

---

## 3. Armar el header de autenticación

Grafana Cloud usa auth básica: `Authorization: Basic base64(<instanceId>:<token>)`.

Generá el string en base64 en tu terminal:

```bash
printf "%s:%s" "987654" "glc_XXXXXXXXXXXXXXXXXXXXXXXX" | base64
```

Copiá el resultado (una línea larga). Ese es tu `GRAFANA_CLOUD_AUTH`.

> Nota: en macOS `base64` no rompe líneas por defecto, en Linux podés necesitar `base64 -w0`.

---

## 4. Configurar el proyecto

Copiá el ejemplo y completá:

```bash
cp .env.example .env
```

Editá `.env` y setea:

```env
GRAFANA_CLOUD_OTLP_ENDPOINT=https://otlp-gateway-prod-us-east-0.grafana.net/otlp
GRAFANA_CLOUD_AUTH=OTg3NjU0OmdsY19YWFhYWFhYWFhY...
```

(El endpoint viene sin `/v1/traces` — el collector lo agrega según el signal.)

---

## 5. Activar el exporter en el Collector

Editá `otel-collector-config.yaml` y **descomentá** el bloque `otlphttp/cloud`:

```yaml
exporters:
  otlp/lgtm:
    endpoint: lgtm:4317
    tls:
      insecure: true

  # OJO: el endpoint que da Grafana Cloud (…grafana.net/otlp) es OTLP/HTTP,
  # NO gRPC. Por eso usamos el exporter `otlphttp`, no `otlp`.
  otlphttp/cloud:
    endpoint: ${env:GRAFANA_CLOUD_OTLP_ENDPOINT}
    headers:
      authorization: Basic ${env:GRAFANA_CLOUD_AUTH}

  debug:
    verbosity: basic
```

Y sumá `otlphttp/cloud` a los tres pipelines:

```yaml
service:
  pipelines:
    traces:
      exporters: [otlp/lgtm, otlphttp/cloud, debug]
    metrics:
      exporters: [otlp/lgtm, otlphttp/cloud, debug]
    logs:
      exporters: [otlp/lgtm, otlphttp/cloud, debug]
```

> **Cuidado con la indentación YAML** de `authorization` — tiene que estar
> _dentro_ de `headers:` (dos espacios más adentro), no al mismo nivel.
> Si queda como sibling, el header no se envía y Grafana Cloud rechaza
> silenciosamente (verás "We could not find any traces yet" en el setup).

También asegurate de que `docker-compose.yml` pase las variables de entorno al collector (ya está preparado — solo `docker compose up -d` toma el `.env` automáticamente).

---

## 6. Levantar y verificar

```bash
docker compose up -d --build
./scripts/load.sh 30
```

En Grafana Cloud (`https://tuusuario.grafana.net`):

- **Explore → Tempo** → "Search" → filtrá `service.name = booking-service`. Deberías ver las trazas del último minuto.
- **Explore → Prometheus** → query `http_server_request_duration_seconds_count`.
- **Explore → Loki** → query `{service_name="booking-service"}`.

Si no aparece nada después de 1-2 min:

- Chequeá los logs del collector: `docker compose logs otel-collector | grep -i error`.
- El exporter `debug` (verbosity `basic`) te muestra qué señales se están enviando.
- 401/403 → el header `Authorization` está mal armado. Regenerá con `printf` (sin `echo`, que agrega newline).

---

## 7. Importar los dashboards a tu instancia Cloud

El repo trae dos versiones de los mismos 4 dashboards:

- **`grafana/dashboards/`** — hardcodeados a los UIDs del stack LGTM local (`prometheus`, `tempo`, `loki`). Los usa el auto-provisioning del compose. **No importar directo en Cloud** — te van a mostrar "Datasource not found".
- **`grafana/dashboards-cloud/`** — versión portable con bloque `__inputs`. Al importar en Grafana Cloud, se abre un formulario preguntando qué datasource mapear a cada placeholder (`DS_PROMETHEUS`, `DS_TEMPO`, `DS_LOKI`), con dropdown filtrado por tipo.

### Paso a paso

1. **Dashboards → New → Import** en el sidebar de tu Grafana Cloud.
2. Subir (o pegar) `grafana/dashboards-cloud/01-service-overview.json`.
3. Grafana muestra el formulario con los inputs del dashboard. En cada dropdown, elegir el datasource `grafanacloud-<TU-USUARIO>-{prom,traces,logs}` correspondiente.
4. **Import**.
5. Repetir con los otros 3 dashboards.

### ¿Cómo saber tu UID exacto?

Grafana Cloud → **Connections → Data sources**. Los datasources aprovisionados en tu stack aparecen con nombres del estilo `grafanacloud-<usuario>-{prom,traces,logs,alert-state-history,…}`. El UID coincide con el nombre.

### Regenerar los dashboards-cloud

Si modificás un dashboard local (`grafana/dashboards/`), sincronizá la versión portable con:

```bash
node scripts/build-cloud-dashboards.mjs
```

El script recorre todos los `*.json` de `grafana/dashboards/`, reemplaza los UIDs hardcoded por placeholders `${DS_*}` y prepende `__inputs`. Salida en `grafana/dashboards-cloud/`.

---

## 8. Modo mixto o solo cloud

- **Ambos**: dejá los dos exporters (`otlp/lgtm` y `otlp/cloud`) en cada pipeline (lo de arriba). Vas a ver los datos en local **y** en cloud.
- **Solo cloud**: sacá `otlp/lgtm` de los pipelines y podés incluso quitar el servicio `lgtm` del `docker-compose.yml` para ahorrar RAM.
- **Solo local**: no hagas los pasos 4–5 (config default).

---

---

## Recursos

- Docs oficiales: https://grafana.com/docs/opentelemetry/collector/send-otlp-to-grafana-cloud-databases/
- Free tier: https://grafana.com/pricing/
- OTLP endpoint por región: en la misma página de "Connections → OpenTelemetry" ves cuál te asignaron.
