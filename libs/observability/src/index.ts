import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { Resource } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

export interface ObservabilityOptions {
  serviceName: string;
  serviceVersion?: string;
}

/**
 * Inicializa OpenTelemetry (traces + metrics + logs) contra el OTel Collector
 * definido por OTEL_EXPORTER_OTLP_ENDPOINT. Debe llamarse ANTES de crear la app Nest.
 */
export function initObservability(opts: ObservabilityOptions): NodeSDK {
  if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: opts.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: opts.serviceVersion ?? '0.1.0',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
  });

  const sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 10_000,
    }),
    logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter()),
    instrumentations: [
      new HttpInstrumentation(),
      new NestInstrumentation(),
      new IORedisInstrumentation(),
      new AwsInstrumentation({ suppressInternalInstrumentation: true }),
      new RuntimeNodeInstrumentation(),
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
