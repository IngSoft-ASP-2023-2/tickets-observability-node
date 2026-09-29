#!/usr/bin/env node
/**
 * Convierte los dashboards locales (grafana/dashboards/*.json) a versiones
 * "portables" que se pueden importar en cualquier instancia de Grafana
 * (Cloud incluida), en grafana/dashboards-cloud/.
 *
 * Cambios que aplica:
 *  - Reemplaza los UIDs hardcodeados del stack LGTM local (prometheus, tempo,
 *    loki) por placeholders ${DS_PROMETHEUS}, ${DS_TEMPO}, ${DS_LOKI}.
 *  - Prepende un bloque `__inputs` para que Grafana pida al importar qué
 *    datasource asignar a cada placeholder (mostrando un dropdown filtrado
 *    por tipo).
 *  - Elimina `id` y setea `uid` con sufijo `-cloud` para no chocar con
 *    los dashboards locales si alguien tiene ambos.
 *
 * Uso:  node scripts/build-cloud-dashboards.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = 'grafana/dashboards';
const DEST = 'grafana/dashboards-cloud';

const UID_MAP = {
  prometheus: { placeholder: 'DS_PROMETHEUS', label: 'Prometheus', pluginId: 'prometheus', pluginName: 'Prometheus' },
  tempo:      { placeholder: 'DS_TEMPO',      label: 'Tempo',      pluginId: 'tempo',      pluginName: 'Tempo' },
  loki:       { placeholder: 'DS_LOKI',       label: 'Loki',       pluginId: 'loki',       pluginName: 'Loki' },
};

mkdirSync(DEST, { recursive: true });

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.json'))) {
  const raw = readFileSync(join(SRC, file), 'utf8');
  const dash = JSON.parse(raw);

  const usedTypes = new Set();

  // Recorre recursivamente y reemplaza { type, uid } de datasources hardcoded.
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      if (node.datasource && typeof node.datasource === 'object' && node.datasource.uid) {
        const map = UID_MAP[node.datasource.uid];
        if (map) {
          usedTypes.add(node.datasource.uid);
          node.datasource.uid = `\${${map.placeholder}}`;
        }
      }
      for (const k of Object.keys(node)) walk(node[k]);
    }
  };
  walk(dash);

  // Bloque __inputs (uno por tipo de datasource realmente usado en el dashboard).
  const inputs = [...usedTypes].map((uid) => {
    const m = UID_MAP[uid];
    return {
      name: m.placeholder,
      label: m.label,
      description: '',
      type: 'datasource',
      pluginId: m.pluginId,
      pluginName: m.pluginName,
    };
  });

  const portable = {
    __inputs: inputs,
    __requires: [
      { type: 'grafana', id: 'grafana', name: 'Grafana', version: '9.0.0' },
      ...inputs.map((i) => ({ type: 'datasource', id: i.pluginId, name: i.pluginName, version: '1.0.0' })),
    ],
    ...dash,
  };
  delete portable.id;
  if (portable.uid && !portable.uid.endsWith('-cloud')) portable.uid = `${portable.uid}-cloud`;

  const out = join(DEST, file);
  writeFileSync(out, JSON.stringify(portable, null, 2) + '\n');
  console.log(`✓ ${out}  (datasources: ${[...usedTypes].join(', ') || '(none)'})`);
}
