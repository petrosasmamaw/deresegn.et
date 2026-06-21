/**
 * Production build check: validate syntax and load critical server modules.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const entryFiles = [
  'src/index.js',
  'src/services/checkService.js',
  'src/services/smsVerifyService.js',
  'src/services/smsParserService.js',
  'src/services/referenceVerifyService.js',
  'src/controllers/checkController.js',
  'src/routes/checkRoutes.js',
];

for (const rel of entryFiles) {
  const abs = path.join(root, rel);
  execSync(`node --check "${abs}"`, { stdio: 'inherit' });
}

const modules = [
  '../src/services/checkService.js',
  '../src/services/smsVerifyService.js',
  '../src/services/smsParserService.js',
  '../src/controllers/balanceController.js',
  '../src/routes/balanceRoutes.js',
];

for (const rel of modules) {
  await import(pathToFileURL(path.join(__dirname, rel)).href);
}

console.log('Server build verification passed.');
