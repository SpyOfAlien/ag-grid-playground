// Code outside the kit must use `@grid-cells` or `@grid-cells/composition`, never internal paths.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['src', 'type-tests', 'e2e', 'test-utils'];
const kit = join('src', 'app', 'shared', 'grid-cells');
const internal =
  /from\s+['"][^'"]*shared\/grid-cells\/[^'"]*['"]|import\(\s*['"][^'"]*shared\/grid-cells\/[^'"]*['"]\s*\)/;

function* sources(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (entry === 'node_modules') continue;
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (path.endsWith('.ts')) yield path;
  }
}

const violations = [];
for (const root of roots) {
  for (const path of sources(root)) {
    if (path.startsWith(kit)) continue;
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (internal.test(line))
          violations.push(`${relative('.', path)}:${index + 1}: ${line.trim()}`);
      });
  }
}

if (violations.length) {
  console.error('Import grid-cells through @grid-cells or @grid-cells/composition:');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
