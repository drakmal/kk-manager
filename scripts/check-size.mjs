// Fails the build if the shipped JavaScript is over budget (spec 7: starting download under ~500 KB).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET = 500 * 1024;
const dir = 'dist/assets';
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
const total = files.reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
console.log(`JavaScript in ${dir}: ${(total / 1024).toFixed(1)} KB across ${files.length} file(s) (budget 500 KB)`);
if (total > BUDGET) {
  console.error('Over budget.');
  process.exit(1);
}
