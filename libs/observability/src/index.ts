import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from '@opentelemetry/api';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

export interface ObservabilityOptions {
  serviceName: string;
  serviceVersion?: string;
}

/**
 * Inicializa OpenTelemetry (traces + metrics + logs) contra el OTel Collector
 * definido por OTEL_EXPORTER_OTLP_ENDPOINT. Debe llamarse ANTES de crear la app Nest.
 *
 * Semantic conventions HTTP: forzamos las stable (nombres tipo
 * `http.server.request.duration`, label `http.route`) vía la env var
 * OTEL_SEMCONV_STABILITY_OPT_IN=http, seteada en el compose y en los scripts dev.
 */
export function initObservability(opts: ObservabilityOptions): NodeSDK {
  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: opts.serviceName,
    [ATTR_SERVICE_VERSION]: opts.serviceVersion ?? '0.2.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? 'development',
  });

  const sdk = new NodeSDK({
    resource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 10_000,
    }),
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    instrumentations: [
      new HttpInstrumentation(),
      new NestInstrumentation(),
      new IORedisInstrumentation(),
      new AwsInstrumentation({ suppressInternalInstrumentation: true }),
      new RuntimeNodeInstrumentation(),
      // Bridgea los logs de pino al Logs API de OTel → van al Collector → Loki.
      // Además inyecta trace_id / span_id automáticamente en cada log.
      new PinoInstrumentation({ disableLogSending: false }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk
      .shutdown()
      .catch((err) => console.error('Error shutting down OTel SDK', err))
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

/**
 * Helper para obtener un Meter con nombre consistente por servicio.
 * Usar para métricas de negocio (contadores de bookings, revenue, etc.).
 */
export function getMeter(name: string) {
  return metrics.getMeter(name);
}
