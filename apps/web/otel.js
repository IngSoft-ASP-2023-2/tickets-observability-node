// Instrumentación web de OpenTelemetry (traces distribuidos front → back).
// Exporta a /otel/v1/traces (proxeado por nginx al OTel Collector).
import { WebTracerProvider } from 'https://esm.sh/@opentelemetry/sdk-trace-web@1.26.0';
import { BatchSpanProcessor } from 'https://esm.sh/@opentelemetry/sdk-trace-base@1.26.0';
import { OTLPTraceExporter } from 'https://esm.sh/@opentelemetry/exporter-trace-otlp-http@0.53.0';
import { FetchInstrumentation } from 'https://esm.sh/@opentelemetry/instrumentation-fetch@0.53.0';
import { registerInstrumentations } from 'https://esm.sh/@opentelemetry/instrumentation@0.53.0';
import { ZoneContextManager } from 'https://esm.sh/@opentelemetry/context-zone@1.26.0';
import { resourceFromAttributes } from 'https://esm.sh/@opentelemetry/resources@1.26.0';

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

console.log('OTel web tracer registered');
