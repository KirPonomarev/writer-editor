import fs from 'node:fs';

const PATH_BOUNDARY_SOURCE = 'src/core/io/path-boundary.js';
const PATH_BOUNDARY_EVIDENCE = 'docs/OPS/STATUS/X71_PATH_BOUNDARY_EXCEPTION_STATE_V1.json';
const DETERMINISTIC_HASH_SOURCES = new Set([
  'src/core/sceneBlockAdmission.mjs',
  'src/core/sceneDocumentAdmission.mjs',
  'src/core/sceneInlineRangeAdmission.mjs',
]);

function hasClosedPathBoundaryEvidence() {
  try {
    const state = JSON.parse(fs.readFileSync(PATH_BOUNDARY_EVIDENCE, 'utf8'));
    return state.artifactId === 'X71_PATH_BOUNDARY_EXCEPTION_STATE_V1'
      && state.ok === true
      && state.exceptionState?.statusAfter === 'CLOSED'
      && state.positiveResults?.PATH_BOUNDARY_GUARD_STATE_CONFIRMED_TRUE === true
      && state.positiveResults?.PATH_BOUNDARY_EXCEPTION_NOT_LEFT_UNBOUNDED_TRUE === true
      && state.positiveResults?.EXCEPTION_POLICY_CONSISTENT_TRUE === true;
  } catch {
    return false;
  }
}

function isApprovedPathBoundaryEffect(filePath, line, effectTokens) {
  if (filePath !== PATH_BOUNDARY_SOURCE || !hasClosedPathBoundaryEvidence()) return false;

  return effectTokens.every((token) => {
    if (token === 'node:') {
      return line.includes("require('node:path')") || line.includes("require('node:fs')");
    }
    if (token === 'fs.') {
      return line.includes('fs.realpathSync') || line.includes('fs.existsSync');
    }
    if (token === 'process.') return line.includes('process.cwd()');
    return false;
  });
}

function isApprovedDeterministicHashImport(filePath, line, effectTokens) {
  return DETERMINISTIC_HASH_SOURCES.has(filePath)
    && effectTokens.length === 1
    && effectTokens[0] === 'node:'
    && line.trim() === "import { createHash } from 'node:crypto';";
}

function isApprovedCoreEffect(filePath, line, effectTokens) {
  return isApprovedPathBoundaryEffect(filePath, line, effectTokens)
    || isApprovedDeterministicHashImport(filePath, line, effectTokens);
}

const CORE_EFFECT_PATTERNS = [
  ['Date.now', /\bDate\.now\b/u],
  ['Math.random', /\bMath\.random\b/u],
  ['console.', /\bconsole\./u],
  ['process.', /\bprocess\./u],
  ['fs.', /\bfs\./u],
  ['node:', /\bnode:/u],
  ['electron', /\belectron\b/u],
];

function findCoreEffectTokens(line) {
  return CORE_EFFECT_PATTERNS
    .filter(([, pattern]) => pattern.test(line))
    .map(([token]) => token);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function usage() {
  console.log('Usage: node scripts/ops-gate.mjs [--task <path>]');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasH2(txt, heading) {
  const re = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'm');
  return re.test(txt);
}

function getH2HeadingsInOrder(txt) {
  const lines = txt.split(/\r?\n/);
  const headings = [];
  for (const line of lines) {
    if (!line.startsWith('## ')) continue;
    headings.push(line.slice(3).trim());
  }
  return headings;
}

function getH2SectionBody(txt, heading) {
  const lines = txt.split(/\r?\n/);
  const header = `## ${heading}`;

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimEnd() === header) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ') && line.trimEnd() !== header) {
      end = i;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

function getFirstPrefixedValue(txt, prefix) {
  const lines = txt.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith(prefix)) continue;
    const right = line.slice(prefix.length).trimEnd();
    return right.trimStart();
  }
  return null;
}

function parseArgs(argv) {
  let taskPath = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--task') {
      taskPath = argv[i + 1] || null;
      i++;
      continue;
    }
    if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    }
    fail(`Unknown arg: ${a}`);
  }

  return { taskPath };
}

const { taskPath } = parseArgs(process.argv.slice(1).slice(1));
const norm = taskPath ? taskPath.replaceAll('\\', '/') : null;

function isSupportedCoreSourceFile(path) {
  return (
    path.endsWith('.ts') ||
    path.endsWith('.tsx') ||
    path.endsWith('.js') ||
    path.endsWith('.jsx') ||
    path.endsWith('.mjs') ||
    path.endsWith('.cjs')
  );
}

function scanCoreDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const name = e.name;
    if (name === 'node_modules' || name === 'dist' || name === 'build') continue;

    const p = `${dir}/${name}`;
    if (e.isDirectory()) {
      const found = scanCoreDir(p);
      if (found) return found;
      continue;
    }
    if (!e.isFile()) continue;

    const normPath = p.replaceAll('\\', '/');
    if (!isSupportedCoreSourceFile(normPath)) continue;

    let text = '';
    try {
      text = fs.readFileSync(p, 'utf8');
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const effectTokens = findCoreEffectTokens(line);

      if (!effectTokens.length) continue;
      if (isApprovedCoreEffect(normPath, line, effectTokens)) continue;

      return {
        filePath: normPath,
        lineNo: i + 1,
        lineText: line.trimEnd().trimStart(),
      };
    }
  }

  return null;
}

function checkCorePurityNoEffectTokens() {
  const base = 'src/core';
  if (!fs.existsSync(base)) return;

  const found = scanCoreDir(base);
  if (!found) return;

  console.error('CORE_PURITY_VIOLATION');
  console.error(found.filePath);
  console.error(`${found.lineNo}: ${found.lineText}`);
  process.exit(1);
}

checkCorePurityNoEffectTokens();

if (!taskPath) process.exit(0);

if (!norm.endsWith('.md')) fail('Only .md files are supported');
if (!norm.startsWith('docs/tasks/') && !norm.startsWith('docs/OPERATIONS/')) {
  fail('E0 scope: docs/tasks/*.md and docs/OPERATIONS/*.md only');
}

let txt = '';
try {
  txt = fs.readFileSync(taskPath, 'utf8');
} catch (e) {
  fail(`Cannot read file: ${taskPath}`);
}

const isTask = norm.startsWith('docs/tasks/');
const allowedTypes = new Set(['OPS_WRITE', 'OPS_REPORT', 'AUDIT', 'CORE', 'UI']);

let taskType = null;
if (isTask) {
  taskType = getFirstPrefixedValue(txt, 'TYPE:');
  if (!taskType) fail('Missing TYPE:');
  if (!allowedTypes.has(taskType)) fail(`Invalid TYPE: ${taskType}`);

  if (!txt.includes('CANON_VERSION:')) fail('Missing CANON_VERSION:');
  if (!txt.includes('CHECKS_BASELINE_VERSION:')) fail('Missing CHECKS_BASELINE_VERSION:');

if (txt.includes('NOT_APPLICABLE') && taskType !== 'OPS_REPORT') {
  fail('NOT_APPLICABLE is only allowed for TYPE=OPS_REPORT');
}
}

// MODE A (HARD‑ТЗ): ровно 10 H2 секций в строгом порядке, без дополнительных H2.
if (isTask) {
  const requiredInOrder = [
    'MICRO_GOAL',
    'ARTIFACT',
    'ALLOWLIST',
    'DENYLIST',
    'CONTRACT / SHAPES',
    'IMPLEMENTATION_STEPS',
    'CHECKS',
    'STOP_CONDITION',
    'REPORT_FORMAT',
    'FAIL_PROTOCOL',
  ];

  const found = getH2HeadingsInOrder(txt);
  if (found.length !== requiredInOrder.length) {
    fail('Invalid H2 sections count for MODE A (must be exactly 10, no extras)');
  }
  for (let i = 0; i < requiredInOrder.length; i++) {
    if (found[i] !== requiredInOrder[i]) {
      fail('Invalid H2 sections order for MODE A (order MUST match canon; extra H2 forbidden)');
    }
  }
}

const checksBody = getH2SectionBody(txt, 'CHECKS') || '';

// Forbidden patterns in CHECKS (без хрупких count-based проверок).
const tokenA = String.fromCharCode(97, 119, 107); // a+w+k
if (checksBody.includes(tokenA)) fail('Forbidden token in CHECKS');

if (checksBody.includes('.trim(')) fail('Forbidden .trim( in CHECKS; use .trimEnd()');

// Allowlist argv MUST use process.argv.slice(1) for `node -e '...'` checks.
// Using slice(2) drops the first allowlist path (in `node -e` mode).
if (checksBody.includes('node -e')) {
  const badProcess = 'process.argv.slice(' + '2' + ')';
  const badArgv = 'argv.slice(' + '2' + ')';
  if (checksBody.includes(badProcess) || checksBody.includes(badArgv)) {
    fail('Forbidden allowlist argv offset in CHECKS; use process.argv.slice(1)');
  }
}

const tokenB = String.fromCharCode(119, 99, 32, 45, 108); // w+c+ + - + l
if (checksBody.includes(tokenB)) fail('Forbidden count-based CHECK in CHECKS');

const tokenC = String.fromCharCode(103, 114, 101, 112, 32, 45, 120); // g+r+e+p+ + - + x
if (checksBody.includes(tokenC)) fail('Forbidden count-based CHECK in CHECKS');

// PRE/POST checks rule (with OPS_REPORT exception).
if (isTask) {
  const hasPre = /\bCHECK_\d+_PRE_/u.test(checksBody);
  const hasPost = /\bCHECK_\d+_POST_/u.test(checksBody);

  if (taskType === 'OPS_REPORT') {
    if (!hasPost) fail('TYPE=OPS_REPORT must include at least one POST_ check');
  } else {
    if (!hasPre) fail('Missing PRE_ check (TYPE != OPS_REPORT)');
    if (!hasPost) fail('Missing POST_ check (TYPE != OPS_REPORT)');
  }
}

process.exit(0);
