import { mkdirSync, writeFileSync } from 'node:fs';

// Generated locally and ignored by Git. Never print the license value.
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../public/runtime-config.js', import.meta.url),
  `window.__CELL_KIT_CONFIG__ = ${JSON.stringify({ agGridLicenseKey: process.env.AG_GRID_LICENSE_KEY ?? '' })};\n`,
);
