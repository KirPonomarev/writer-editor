import fs from 'node:fs';

const PATH_BOUNDARY_SOURCE = 'src/core/io/path-boundary.js';
const PATH_BOUNDARY_EVIDENCE = 'docs/OPS/STATUS/X71_PATH_BOUNDARY_EXCEPTION_STATE_V1.json';
const PATH_CAPABILITY_IMPORTS_BY_SOURCE = new Map([
  ['src/core/io/file-path-allowlist-v1.cjs', new Set([
    "const path = require('node:path');",
  ])],
]);
const PATH_CAPABILITY_SOURCE = 'src/core/io/path-capability-v1.cjs';
const DETERMINISTIC_HASH_SOURCES = new Set([
  'src/core/sceneBlockAdmission.mjs',
  'src/core/sceneDocumentAdmission.mjs',
  'src/core/sceneInlineRangeAdmission.mjs',
]);
const PURE_RUNTIME_IMPORTS_BY_SOURCE = new Map([
  ['src/core/anchor-lineage-v1.cjs', new Set([
    "const { createHash } = require('node:crypto');",
  ])],
  ['src/core/docx-profile-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
    "import { types as nodeTypes } from 'node:util';",
  ])],
  ['src/core/evidence-capsule-export-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
    "import { types } from 'node:util';",
  ])],
  ['src/core/google-provider-profile-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
    "import { types as nodeTypes } from 'node:util';",
  ])],
  ['src/core/interchange-ir-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
  ])],
  ['src/core/interchange-negotiation-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
    "import { types } from 'node:util';",
  ])],
  ['src/core/legacy-strangler-v1.cjs', new Set([
    "const crypto = require('node:crypto');",
  ])],
  ['src/core/lifecycle-recovery-v1.cjs', new Set([
    "const crypto = require('node:crypto');",
    "const path = require('node:path');",
  ])],
  ['src/core/parser-quarantine-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
    "import zlib from 'node:zlib';",
    "import { TextDecoder } from 'node:util';",
  ])],
  ['src/core/path-text-integrity-v1.mjs', new Set([
    "import path from 'node:path';",
  ])],
  ['src/core/pdf-archive-review-profile-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
    "import { types } from 'node:util';",
  ])],
  ['src/core/save-receipt-ack-v1.cjs', new Set([
    "const crypto = require('node:crypto');",
  ])],
  ['src/core/storage-selection-v1.cjs', new Set([
    "const crypto = require('node:crypto');",
  ])],
  ['src/core/text-formats-v1.mjs', new Set([
    "import crypto from 'node:crypto';",
  ])],
  ['src/core/writer-refinement-verdict-v1.cjs', new Set([
    "const crypto = require('node:crypto');",
  ])],
]);
const TRANSIENT_RUNTIME_IMPORTS_BY_SOURCE = new Map([
  ['src/core/ipc-caller-identity-v1.cjs', new Set([
    "const { performance } = require('node:perf_hooks');",
  ])],
]);
const TRANSIENT_ENVELOPE_FALLBACKS_BY_SOURCE = new Map([
  ['src/core/ipc-envelope-v1.cjs', new Set([
    ": `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,",
  ])],
]);
const LOCAL_PERSISTENCE_SOURCES = new Set([
  'src/core/migration-history-backup-gc-v1.cjs',
  'src/core/project-commit-v1.cjs',
  'src/core/project-transaction-v1.cjs',
  'src/core/pulse-ledger-v1.mjs',
  'src/core/pulse-local-history-v1.mjs',
  'src/core/pulse-privacy-v1.mjs',
  'src/core/recovery-ledger-v1.cjs',
  'src/core/save-coordinator-v1.cjs',
  'src/core/storage-bakeoff-v1.cjs',
  'src/core/transactional-inbox-outbox-v1.cjs',
]);
const LOCAL_PERSISTENCE_FS_METHODS = new Set([
  'fs.appendFileSync',
  'fs.closeSync',
  'fs.existsSync',
  'fs.fsyncSync',
  'fs.lstatSync',
  'fs.mkdirSync',
  'fs.openSync',
  'fs.readFileSync',
  'fs.readdirSync',
  'fs.realpathSync',
  'fs.statSync',
  'fs.writeFileSync',
]);
const LOCAL_PERSISTENCE_PROMISE_FS_METHODS_BY_SOURCE = new Map([
  ['src/core/migration-history-backup-gc-v1.cjs', new Set(['fsp.unlink'])],
  ['src/core/project-commit-v1.cjs', new Set(['fsp.open', 'fsp.unlink'])],
  ['src/core/save-coordinator-v1.cjs', new Set(['fsp.open', 'fsp.unlink'])],
]);
const LOCAL_PERSISTENCE_TEMP_ENTROPY_BY_SOURCE = new Map([
  ['src/core/project-commit-v1.cjs', new Set([
    "`${path.basename(scenePath)}.p3-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`,",
  ])],
  ['src/core/save-coordinator-v1.cjs', new Set([
    "const tempPath = path.join(directory, `${baseName}.p2-${process.pid}-${crypto.randomBytes(6).toString('hex')}.tmp`);",
  ])],
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

function isIdentifierStart(ch) {
  return /[A-Za-z_$]/u.test(ch);
}

function isIdentifierPart(ch) {
  return /[A-Za-z0-9_$]/u.test(ch);
}

function shouldStartRegexLiteral(tokens) {
  const previous = tokens[tokens.length - 1];
  if (!previous) return true;
  if (previous.type === 'identifier' || previous.type === 'string') return false;
  return new Set(['(', '[', '{', '=', ':', ',', ';', '!', '?', '?.']).has(previous.value);
}

function tokenizeJavaScriptLike(text) {
  const tokens = [];
  let i = 0;
  let line = 1;

  const push = (type, value, tokenLine = line) => tokens.push({ type, value, line: tokenLine });

  const advance = () => {
    if (text[i] === '\n') line++;
    i++;
  };

  const skipLineComment = () => {
    while (i < text.length) {
      const ch = text[i];
      advance();
      if (ch === '\n') return;
    }
  };

  const skipBlockComment = () => {
    i += 2;
    while (i < text.length) {
      if (text[i] === '\n') line++;
      if (text[i] === '*' && text[i + 1] === '/') {
        i += 2;
        return;
      }
      i++;
    }
  };

  const readQuotedString = (quote) => {
    const startLine = line;
    let value = '';
    let escaped = false;
    i++;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\n') line++;
      if (escaped) {
        value += ch;
        escaped = false;
        i++;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        i++;
        continue;
      }
      if (ch === quote) {
        i++;
        push('string', value, startLine);
        return;
      }
      value += ch;
      i++;
    }
    push('string', value, startLine);
  };

  const readIdentifier = () => {
    const startLine = line;
    const start = i;
    i++;
    while (i < text.length && isIdentifierPart(text[i])) i++;
    push('identifier', text.slice(start, i), startLine);
  };

  const skipRegexLiteral = () => {
    i++;
    let escaped = false;
    let inClass = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\n') {
        line++;
        i++;
        return;
      }
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        i++;
        continue;
      }
      if (ch === '[') inClass = true;
      if (ch === ']') inClass = false;
      if (ch === '/' && !inClass) {
        i++;
        while (i < text.length && /[A-Za-z]/u.test(text[i])) i++;
        return;
      }
      i++;
    }
  };

  const readPunct = () => {
    const startLine = line;
    const ch = text[i];
    if (ch === '?' && text[i + 1] === '.') {
      i += 2;
      push('punct', '?.', startLine);
      return;
    }
    i++;
    push('punct', ch, startLine);
  };

  const scanExpression = (untilTemplateBrace) => {
    while (i < text.length) {
      const ch = text[i];
      if (untilTemplateBrace && ch === '}') {
        i++;
        return;
      }
      if (/\s/u.test(ch)) {
        advance();
        continue;
      }
      if (ch === '/' && text[i + 1] === '/') {
        skipLineComment();
        continue;
      }
      if (ch === '/' && text[i + 1] === '*') {
        skipBlockComment();
        continue;
      }
      if (ch === '/' && shouldStartRegexLiteral(tokens)) {
        skipRegexLiteral();
        continue;
      }
      if (ch === '\'' || ch === '"') {
        readQuotedString(ch);
        continue;
      }
      if (ch === '`') {
        skipTemplateLiteral();
        continue;
      }
      if (isIdentifierStart(ch)) {
        readIdentifier();
        continue;
      }
      readPunct();
    }
  };

  function skipTemplateLiteral() {
    i++;
    let escaped = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\n') line++;
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        i++;
        continue;
      }
      if (ch === '`') {
        i++;
        return;
      }
      if (ch === '$' && text[i + 1] === '{') {
        i += 2;
        scanExpression(true);
        continue;
      }
      i++;
    }
  }

  scanExpression(false);
  return tokens;
}

function nextNonTrivia(tokens, index) {
  return tokens[index] || null;
}

function memberAccessFrom(tokens, index, owner) {
  const first = tokens[index];
  if (!first || first.type !== 'identifier' || first.value !== owner) return null;

  let cursor = index + 1;
  const members = [];

  while (cursor < tokens.length) {
    const accessor = nextNonTrivia(tokens, cursor);
    if (!accessor || accessor.type !== 'punct') break;
    if (accessor.value === '?.' && nextNonTrivia(tokens, cursor + 1)?.value === '(') break;

    if (accessor.value === '.' || accessor.value === '?.') {
      const prop = nextNonTrivia(tokens, cursor + 1);
      if (!prop || prop.type !== 'identifier') break;
      members.push(prop.value);
      cursor += 2;
      continue;
    }
    if (accessor.value === '[') {
      const prop = nextNonTrivia(tokens, cursor + 1);
      if (prop?.type === 'string') {
        const close = nextNonTrivia(tokens, cursor + 2);
        if (!close || close.type !== 'punct' || close.value !== ']') break;
        members.push(prop.value);
        cursor += 3;
        continue;
      }
      members.push('[computed]');
      cursor++;
      let depth = 1;
      while (cursor < tokens.length && depth > 0) {
        const token = tokens[cursor];
        cursor++;
        if (token.type !== 'punct') continue;
        if (token.value === '[') depth++;
        if (token.value === ']') depth--;
      }
      continue;
    }
    break;
  }
  if (members.length === 0) return null;

  let after = nextNonTrivia(tokens, cursor);
  if (after && after.type === 'punct' && after.value === '?.') {
    cursor++;
    after = nextNonTrivia(tokens, cursor);
  }
  const kind = after && after.type === 'punct' && after.value === '(' ? 'call' : 'reference';
  return { token: `${owner}.${members.join('.')}.${kind}`, lineNo: first.line };
}

function moduleSpecifierToken(value) {
  if (value === 'electron') return 'electron';
  if (value.startsWith('node:')) return value;
  return '';
}

function moduleImportFrom(tokens, index) {
  const current = tokens[index];
  if (!current || current.type !== 'identifier') return null;

  if (current.value === 'require') {
    const open = nextNonTrivia(tokens, index + 1);
    const specifier = nextNonTrivia(tokens, index + 2);
    if (open?.type === 'punct' && open.value === '(' && specifier?.type === 'string') {
      const token = moduleSpecifierToken(specifier.value);
      if (token) return { token, lineNo: current.line, mode: 'require' };
    }
  }

  if (current.value === 'import') {
    const next = nextNonTrivia(tokens, index + 1);
    const dynamic = next?.type === 'punct' && next.value === '(';
    const specifier = dynamic ? nextNonTrivia(tokens, index + 2) : next;
    if (specifier?.type === 'string') {
      const token = moduleSpecifierToken(specifier.value);
      if (token) return { token, lineNo: current.line, mode: dynamic ? 'dynamic-import' : 'side-effect-import' };
    }
  }

  if (current.value === 'from') {
    const specifier = nextNonTrivia(tokens, index + 1);
    if (specifier?.type === 'string') {
      const token = moduleSpecifierToken(specifier.value);
      if (token) return { token, lineNo: current.line, mode: 'static-from' };
    }
  }

  return null;
}

function findStatementStart(tokens, index) {
  let cursor = index;
  while (cursor > 0) {
    const token = tokens[cursor - 1];
    if (token.type === 'punct' && (token.value === ';' || token.value === '{' || token.value === '}')) break;
    cursor--;
  }
  return cursor;
}

function findAssignmentStart(tokens, index) {
  let cursor = index;
  while (cursor > 0) {
    const token = tokens[cursor - 1];
    if (token.type === 'punct' && token.value === ';') break;
    cursor--;
  }
  return cursor;
}

function makeModuleBindingToken(moduleToken, bindingKind) {
  if (moduleToken === 'node:fs') return `fs.${bindingKind}.reference`;
  if (moduleToken === 'node:fs/promises') return `fsp.${bindingKind}.reference`;
  if (moduleToken === 'node:crypto') return `crypto.${bindingKind}.reference`;
  return '';
}

function expectedModuleBindingName(moduleToken) {
  if (moduleToken === 'node:fs') return 'fs';
  if (moduleToken === 'node:fs/promises') return 'fsp';
  if (moduleToken === 'node:crypto') return 'crypto';
  return '';
}

function objectPatternHasDestructuring(tokens) {
  return tokens.some((token) => token.type === 'punct' && token.value === '{');
}

function moduleBindingRecordsFrom(tokens, index, moduleImport) {
  const expectedName = expectedModuleBindingName(moduleImport.token);
  if (!expectedName) return [];

  const records = [];
  const current = tokens[index];

  if (current.value === 'require') {
    const previous = nextNonTrivia(tokens, index - 1);
    if (!previous || previous.type !== 'punct' || previous.value !== '=') return records;

    const start = findAssignmentStart(tokens, index - 1);
    const lhs = tokens.slice(start, index - 1);
    const bindingToken = makeModuleBindingToken(moduleImport.token, '[binding]');
    if (objectPatternHasDestructuring(lhs)) {
      records.push({ token: bindingToken, lineNo: moduleImport.lineNo });
      return records;
    }

    const identifier = [...lhs].reverse().find((token) => token.type === 'identifier');
    if (identifier && identifier.value !== expectedName) {
      records.push({ token: bindingToken, lineNo: moduleImport.lineNo });
    }
    return records;
  }

  if (current.value !== 'from') return records;

  const start = findAssignmentStart(tokens, index);
  const importIndex = tokens.findIndex((token, tokenIndex) => tokenIndex >= start && tokenIndex < index && token.type === 'identifier' && token.value === 'import');
  if (importIndex === -1) return records;
  const clause = tokens.slice(importIndex + 1, index);
  const bindingToken = makeModuleBindingToken(moduleImport.token, '[binding]');
  if (objectPatternHasDestructuring(clause)) {
    records.push({ token: bindingToken, lineNo: moduleImport.lineNo });
    return records;
  }

  const starIndex = clause.findIndex((token) => token.type === 'punct' && token.value === '*');
  if (starIndex !== -1) {
    const alias = clause[starIndex + 2];
    if (alias?.type === 'identifier' && alias.value !== expectedName) {
      records.push({ token: bindingToken, lineNo: moduleImport.lineNo });
    }
    return records;
  }

  const defaultAlias = clause.find((token) => token.type === 'identifier');
  if (defaultAlias && defaultAlias.value !== expectedName) {
    records.push({ token: bindingToken, lineNo: moduleImport.lineNo });
  }
  return records;
}

function isApprovedPathBoundaryEffect(filePath, line, effectTokens) {
  if (filePath !== PATH_BOUNDARY_SOURCE || !hasClosedPathBoundaryEvidence()) return false;

  const allowedTokens = new Set([
    'node:path',
    'node:fs',
    'fs.realpathSync.call',
    'fs.realpathSync.native.call',
    'fs.realpathSync.native.reference',
    'fs.existsSync.call',
    'process.cwd.call',
  ]);
  return effectTokens.every((token) => allowedTokens.has(token));
}

function isApprovedPathCapabilityImport(filePath, line, effectTokens) {
  return hasClosedPathBoundaryEvidence()
    && effectTokens.length === 1
    && effectTokens[0] === 'node:path'
    && PATH_CAPABILITY_IMPORTS_BY_SOURCE.get(filePath)?.has(line.trim()) === true;
}

function isApprovedPathCapabilityEffect(filePath, line, effectTokens) {
  if (filePath !== PATH_CAPABILITY_SOURCE || !hasClosedPathBoundaryEvidence()) return false;

  const allowedTokens = new Set([
    'node:fs',
    'node:path',
    'fs.realpathSync.call',
    'fs.existsSync.call',
    'fs.lstatSync.call',
    'fs.readdirSync.call',
  ]);
  return effectTokens.every((token) => allowedTokens.has(token));
}

function isApprovedDeterministicHashImport(filePath, line, effectTokens) {
  return DETERMINISTIC_HASH_SOURCES.has(filePath)
    && effectTokens.length > 0
    && effectTokens.every((token) => token === 'node:crypto' || token === 'crypto.[binding].reference')
    && line.trim() === "import { createHash } from 'node:crypto';";
}

function isApprovedPureRuntimeImport(filePath, line, effectTokens) {
  if (PURE_RUNTIME_IMPORTS_BY_SOURCE.get(filePath)?.has(line.trim()) !== true) return false;
  return effectTokens.length > 0
    && effectTokens.every((token) => token.startsWith('node:') || token === 'crypto.[binding].reference');
}

function isApprovedTransientRuntimeImport(filePath, line, effectTokens) {
  return effectTokens.length === 1
    && effectTokens[0] === 'node:perf_hooks'
    && TRANSIENT_RUNTIME_IMPORTS_BY_SOURCE.get(filePath)?.has(line.trim()) === true;
}

function isApprovedTransientEnvelopeFallback(filePath, line, effectTokens) {
  const allowedTokens = new Set(['Date.now.call', 'Math.random.call']);
  return effectTokens.length > 0
    && effectTokens.every((token) => allowedTokens.has(token))
    && TRANSIENT_ENVELOPE_FALLBACKS_BY_SOURCE.get(filePath)?.has(line.trim()) === true;
}

function isApprovedLocalPersistenceEffect(filePath, line, effectTokens) {
  if (!LOCAL_PERSISTENCE_SOURCES.has(filePath)) return false;

  const allowedNodeImports = new Set(['node:fs', 'node:fs/promises', 'node:path', 'node:crypto']);
  return effectTokens.every((token) => {
    if (token.startsWith('node:')) return allowedNodeImports.has(token);
    if (token.startsWith('fs.') && token.endsWith('.call')) {
      return LOCAL_PERSISTENCE_FS_METHODS.has(token.slice(0, -'.call'.length));
    }
    if (token.startsWith('fsp.') && token.endsWith('.call')) {
      return LOCAL_PERSISTENCE_PROMISE_FS_METHODS_BY_SOURCE
        .get(filePath)
        ?.has(token.slice(0, -'.call'.length)) === true;
    }
    return false;
  });
}

function isApprovedLocalPersistenceTempEntropy(filePath, line, effectTokens) {
  const allowedTokens = new Set(['crypto.randomBytes.call', 'process.pid.reference']);
  return effectTokens.length > 0
    && effectTokens.every((token) => allowedTokens.has(token))
    && LOCAL_PERSISTENCE_TEMP_ENTROPY_BY_SOURCE.get(filePath)?.has(line.trim()) === true;
}

function isApprovedCoreEffect(filePath, line, effectTokens) {
  return isApprovedPathBoundaryEffect(filePath, line, effectTokens)
    || isApprovedPathCapabilityImport(filePath, line, effectTokens)
    || isApprovedPathCapabilityEffect(filePath, line, effectTokens)
    || isApprovedDeterministicHashImport(filePath, line, effectTokens)
    || isApprovedPureRuntimeImport(filePath, line, effectTokens)
    || isApprovedTransientRuntimeImport(filePath, line, effectTokens)
    || isApprovedTransientEnvelopeFallback(filePath, line, effectTokens)
    || isApprovedLocalPersistenceEffect(filePath, line, effectTokens)
    || isApprovedLocalPersistenceTempEntropy(filePath, line, effectTokens);
}

function findCoreEffectRecords(text) {
  const tokens = tokenizeJavaScriptLike(text);
  const records = [];

  for (let i = 0; i < tokens.length; i++) {
    const moduleImport = moduleImportFrom(tokens, i);
    if (moduleImport) {
      records.push(moduleImport);
      if (moduleImport.mode === 'dynamic-import' || moduleImport.mode === 'side-effect-import') {
        records.push({
          token: `${moduleImport.token}.[${moduleImport.mode}]`,
          lineNo: moduleImport.lineNo,
        });
      }
      records.push(...moduleBindingRecordsFrom(tokens, i, moduleImport));
    }

    for (const owner of ['fs', 'fsp', 'process', 'Date', 'Math', 'crypto', 'console']) {
      const access = memberAccessFrom(tokens, i, owner);
      if (!access) continue;
      if (owner === 'Date' && access.token !== 'Date.now.call') continue;
      if (owner === 'Math' && access.token !== 'Math.random.call') continue;
      if (owner === 'crypto' && access.token !== 'crypto.randomBytes.call' && access.token !== 'crypto.randomUUID.call') continue;
      records.push(access);
    }
  }

  return records;
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
    const recordsByLine = new Map();
    for (const record of findCoreEffectRecords(text)) {
      if (!recordsByLine.has(record.lineNo)) recordsByLine.set(record.lineNo, []);
      recordsByLine.get(record.lineNo).push(record.token);
    }

    for (const [lineNo, effectTokens] of recordsByLine) {
      const line = lines[lineNo - 1] || '';

      if (isApprovedCoreEffect(normPath, line, effectTokens)) continue;

      return {
        filePath: normPath,
        lineNo,
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
