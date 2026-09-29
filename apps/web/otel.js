// Instrumentación web de OpenTelemetry (traces distribuidos front → back).
// Exporta OTLP/HTTP a /otel/v1/traces (nginx proxea al OTel Collector).
import { WebTracerProvider, BatchSpanProcessor } from 'https://esm.sh/@opentelemetry/sdk-trace-web@2.11.0';
import { OTLPTraceExporter } from 'https://esm.sh/@opentelemetry/exporter-trace-otlp-http@0.222.0';
import { FetchInstrumentation } from 'https://esm.sh/@opentelemetry/instrumentation-fetch@0.222.0';
import { registerInstrumentations } from 'https://esm.sh/@opentelemetry/instrumentation@0.222.0';
import { ZoneContextManager } from 'https://esm.sh/@opentelemetry/context-zone@2.11.0';
import { resourceFromAttributes } from 'https://esm.sh/@opentelemetry/resources@2.11.0';

try {
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({ 'service.name': 'web' }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: '/otel/v1/traces' }),
      ),
    ],
  });
  provider.register({ contextManager: new ZoneContextManager() });

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
      }),
    ],
  });

  console.log('[otel] web tracer registered');
} catch (err) {
  console.error('[otel] failed to register web tracer', err);
}
