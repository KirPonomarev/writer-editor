'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const main = fs.readFileSync(path.resolve(__dirname, '../../src/main.js'), 'utf8');
const ownedFixtures = new Set();
process.once('exit', () => { for (const owned of ownedFixtures) fs.rmSync(owned, { recursive: true, force: true }); });
function actualFunction(name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(main);
  if (!match) throw Error('MAIN_ROUND_HELPER_MISSING:' + name);
  const end = main.indexOf('\n}\n', match.index);
  if (end < 0) throw Error('MAIN_ROUND_HELPER_BOUNDARY:' + name);
  return main.slice(match.index, end + 3);
}

// Actual Main validation over a regular durable fixture. Some historical VM
// fixtures use synthetic absolute roots; this adapter remaps ONLY their round
// store and manifest reads to an owned temporary directory, never manuscript
// or resource writes. No authority predicate is replaced with a stub.
function installMainDocxRoundAuthority(context, { projectRoot, projectId = 'fixture-project', references = [], publishAllocated = false, t } = {}) {
  const root = projectRoot || context.getProjectRootPath?.();
  if (typeof root !== 'string' || !root) throw Error('ROUND_FIXTURE_ROOT_REQUIRED');
  const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'main-round-authority-'));
  ownedFixtures.add(owned);
  const storePath = path.join(root, '.yalken/word-review/return-authority-store.v1.json');
  const manifestPath = path.join(root, 'project.craftsman.json');
  const localStore = path.join(owned, '.yalken/word-review/return-authority-store.v1.json');
  fs.mkdirSync(path.dirname(localStore), { recursive: true });
  const remap = target => {
    if (target === manifestPath) return fs.existsSync(target) ? target : path.join(owned, 'project.craftsman.json');
    if (target === root || target === path.join(root, '.yalken') || target === path.join(root, '.yalken/word-review') || target === storePath)
      return path.join(owned, path.relative(root, target));
    return target;
  };
  fs.writeFileSync(path.join(owned, 'project.craftsman.json'), JSON.stringify({ schemaVersion: 1, projectId }));
  const hash = value => 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
  Object.assign(context, {
    path, fsSync: { lstatSync: target => fs.lstatSync(remap(target)), readFileSync: (target, ...args) => fs.readFileSync(remap(target), ...args) },
    REVIEW_DOCX_RETURN_AUTHORITY_STORE_SCHEMA: 'yalken.rtk.word.product-review-docx-export.authority-store.v2',
    REVIEW_DOCX_RETURN_AUTHORITY_STORE_RELATIVE_SEGMENTS: ['.yalken', 'word-review', 'return-authority-store.v1.json'],
  });
  context.isPlainObjectValue ||= value => value !== null && typeof value === 'object' && !Array.isArray(value);
  context.cloneJsonSafe ||= value => JSON.parse(JSON.stringify(value));
  context.isPathInsideBoundary ||= (parent, target) => { const relative = path.relative(parent, target); return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); };
  const existingCryptoPort = context.createRtkReviewTransportCryptoPort;
  context.createRtkReviewTransportCryptoPort = () => ({ sha256Json: value => hash(JSON.stringify(value)), ...(existingCryptoPort?.() || {}) });
  context.currentLifecycleSubjectId ||= () => 'round-fixture-life';
  context.activeStage10ApplicationBootstrap ||= {};
  context.lastSignaledEditGeneration ??= 0;
  context.pendingDocxReviewPublicationBindings ||= new WeakMap();
  if (!vm.isContext(context)) vm.createContext(context);
  vm.runInContext([
    'docxReviewPreviewSessionDetailString', 'docxReviewReturnAuthorityStorePath',
    'buildDocxReviewReturnAuthorityStoreRecord', 'validateDocxReviewReturnAuthorityStoreRecord',
    'findDocxReviewReturnIntakeRoundAuthority', 'readStrictDocxReviewAuthorityStore',
    'assertFreshDocxReviewRoundAuthority', 'bindPendingDocxReviewPublication', 'checkDocxReviewPublicationIdentity',
  ].map(actualFunction).join('\n'), context);
  const roundsById = {};
  for (const reference of references) {
    if (typeof reference.roundId !== 'string' || !reference.roundId) throw Error('ROUND_FIXTURE_ID_REQUIRED');
    reference.keyRef ||= 'keyref:' + reference.roundId;
    // These old fixtures start at the producer's ALLOCATED capsule. Explicit
    // fixture preparation represents the published round that authenticated
    // Main intake would select; terminal or other states are never rewritten.
    if (publishAllocated && reference.lifecycleState === 'ALLOCATED') {
      reference.lifecycleState = 'PUBLISHED_ACTIVE';
      reference.recordVersion = (reference.recordVersion || 1) + 1;
    }
    roundsById[reference.roundId] = { ...reference, projectRoot: root,
      lifecycleState: reference.lifecycleState || 'PUBLISHED_ACTIVE', recordVersion: reference.recordVersion || 1 };
  }
  const write = () => {
    if (!Object.keys(roundsById).length) return;
    const record = context.buildDocxReviewReturnAuthorityStoreRecord({ lastRoundId: Object.keys(roundsById).at(-1), roundsById });
    fs.writeFileSync(localStore, JSON.stringify(record, null, 2) + '\n');
  };
  write();
  const dispose = () => { fs.rmSync(owned, { recursive: true, force: true }); ownedFixtures.delete(owned); };
  if (t) t.after(dispose);
  return { owned, storePath: localStore, roundsById, write, dispose };
}
module.exports = { installMainDocxRoundAuthority };
