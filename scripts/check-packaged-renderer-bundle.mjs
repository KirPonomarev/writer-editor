import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');

const defaultAsarCandidates = [
  path.resolve('dist/mac-arm64/Yalken.app/Contents/Resources/app.asar'),
  path.resolve('dist/mac-arm64/Craftsman.app/Contents/Resources/app.asar'),
];

const appAsarPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : defaultAsarCandidates.find((candidate) => fs.existsSync(candidate)) || defaultAsarCandidates[0];

if (!fs.existsSync(appAsarPath)) {
  console.error(`APP_ASAR_MISSING: ${appAsarPath}`);
  process.exit(2);
}

const list = asar.listPackage(appAsarPath);
const requiredEntries = [
  '/src/renderer/index.html',
  '/src/renderer/editor.bundle.js',
  '/src/renderer/flags.js',
];

const missing = requiredEntries.filter((entry) => !list.includes(entry));
if (missing.length > 0) {
  console.error(`APP_ASAR_BUNDLE_CHECK_FAIL: missing=${missing.join(',')}`);
  process.exit(3);
}

const indexHtml = asar.extractFile(appAsarPath, 'src/renderer/index.html').toString('utf8');
const hasRuntimeScriptPath = indexHtml.includes('<script src="./editor.bundle.js"></script>');
if (!hasRuntimeScriptPath) {
  console.error('INDEX_HTML_RUNTIME_BUNDLE_PATH_MISSING');
  process.exit(4);
}

console.log('APP_ASAR_BUNDLE_CHECK_PASS');
