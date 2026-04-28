const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const CONTRACTS_DIR = path.join(ROOT, 'src', 'contracts');
const RUNTIME_DIR = path.join(CONTRACTS_DIR, 'runtime');
const ROOT_INDEX = path.join(CONTRACTS_DIR, 'index.ts');
const RUNTIME_INDEX = path.join(RUNTIME_DIR, 'index.ts');

const MINIMAL_PUBLIC_EXPORTS = [
  'CoreCommand',
  'CoreEvent',
  'CoreStateSnapshot',
  'RuntimeEffectsContract',
  'RuntimeExecutionContract',
  'RuntimeQueueContract',
  'RuntimeTraceContract',
  'SceneBlockContract',
  'SceneBlockTypeContract',
  'SceneDocumentContract',
  'SceneDocumentSchemaVersion',
  'SceneInlineMarkTypeContract',
  'SceneInlineRangeContract',
].sort();

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listBasenames(dirPath) {
  return fs.readdirSync(dirPath)
    .filter((basename) => basename.endsWith('.contract.ts'))
    .sort();
}

function parseExportTypeTargets(sourceText) {
  return [...sourceText.matchAll(/export type\s+\{[\s\S]*?\}\s+from\s+"([^"]+)";/g)]
    .map((match) => match[1]);
}

function parseExportTypeNames(sourceText) {
  return [...sourceText.matchAll(/export type\s*\{([^}]+)\}\s*from\s*"[^"]+";/g)]
    .flatMap((match) => match[1].split(','))
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();
}

test('public contracts minimal: root barrel stays type-only and exposes only the minimal public surface', () => {
  const source = readText(ROOT_INDEX);

  assert.deepEqual(parseExportTypeNames(source), MINIMAL_PUBLIC_EXPORTS);
  assert.doesNotMatch(source, /export\s+(const|function|async function|class|default)\b/);

  for (const forbiddenName of ['DialogPort', 'FileSystemPort', 'PlatformInfoPort']) {
    assert.equal(source.includes(forbiddenName), false, forbiddenName);
  }
});

test('public contracts minimal: runtime barrel re-exports every runtime contract and only type exports', () => {
  const source = readText(RUNTIME_INDEX);
  const contractBasenames = listBasenames(RUNTIME_DIR);
  const exportTargets = parseExportTypeTargets(source)
    .map((target) => `${target.slice(2)}.ts`)
    .sort();

  assert.deepEqual(
    exportTargets,
    contractBasenames,
  );
  assert.doesNotMatch(source, /export\s+(const|function|async function|class|default)\b/);
});

test('public contracts minimal: contract files stay shape-only and do not import runtime surfaces', () => {
  const queue = [CONTRACTS_DIR, RUNTIME_DIR];
  const files = [];
  while (queue.length > 0) {
    const dirPath = queue.shift();
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  for (const filePath of files.sort()) {
    const source = readText(filePath);
    assert.doesNotMatch(
      source,
      /export\s+(const|function|async function|class|default)\b/,
      path.basename(filePath),
    );
    assert.doesNotMatch(
      source,
      /from\s+["'](\.\.\/|[^"']*(renderer|storage|export|ipc)[^"']*)["']/,
      path.basename(filePath),
    );
  }
});
