import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  HISTORICAL_INVENTORY_CLAIM_PINS_V4,
  HISTORICAL_INVENTORY_CLAIM_PINS_V24,
  HISTORICAL_INVENTORY_CLAIM_PINS_V25,
  HISTORICAL_INVENTORY_CLAIM_PINS_V27,
  HISTORICAL_INVENTORY_CLAIM_PINS_V28,
  HISTORICAL_INVENTORY_CLAIM_PINS_V29,
  HISTORICAL_INVENTORY_CLAIM_PINS_V30,
  HISTORICAL_INVENTORY_CLAIM_PINS_V31,
  HISTORICAL_INVENTORY_CLAIM_PINS_V32,
  HISTORICAL_INVENTORY_CLAIM_PINS_V33,
  HISTORICAL_INVENTORY_CLAIM_PINS_V34,
  HISTORICAL_INVENTORY_CLAIM_PINS_V36,
  HISTORICAL_INVENTORY_CLAIM_PINS_V38,
  HISTORICAL_INVENTORY_CLAIM_PINS_V39,
  HISTORICAL_INVENTORY_CLAIM_PINS_V40,
  lintDocsClaims,
  verifyHistoricalInventoryClaim,
} from '../docs-claim-lint.mjs';

const HEAD = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const NOW = '2026-08-23T00:00:00Z';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const INVENTORY_PATH = 'docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json';

function evidenceStamp(id) {
  return {
    schemaVersion: 'EvidenceStampV2',
    stampId: id,
    missionId: 'MISSION-1',
    contourId: 'CONTOUR-1',
    attemptId: 'ATTEMPT-1',
    authorityEpoch: 'EPOCH-1',
    profileId: 'PROFILE-1',
    repo: {
      canonicalPath: '/repo',
      originUrl: 'https://example.invalid/repo.git',
      headSha: HEAD,
      treeSha: TREE,
    },
    claim: { type: 'DOCS_CLAIM', ceiling: 'EXACT_FILE_ONLY', verdict: 'PASS' },
    test: {
      oracleId: 'DOCS-ORACLE-1',
      evidenceClass: 'CONTRACT',
      denominator: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      exitCode: 0,
    },
    causal: { parentStampIds: [], predecessorReceiptDigest: null },
    createdAt: NOW,
  };
}

function makeDocs({ stamps = [], docs = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r24-claim-'));
  const evidenceDir = path.join(dir, 'docs', 'OPS', 'R24', 'EVIDENCE');
  fs.mkdirSync(evidenceDir, { recursive: true });
  for (const id of stamps) {
    fs.writeFileSync(path.join(evidenceDir, `${id}.json`), JSON.stringify(evidenceStamp(id)));
  }
  for (const [name, content] of Object.entries(docs)) {
    const file = path.join(dir, 'docs', 'OPS', 'R24', name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return dir;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('claim term without resolvable stamp fails closed', () => {
  const dir = makeDocs({ docs: { 'STATUS.json': '{"status":"READY"}' } });
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.startsWith('E_CLAIM_WITHOUT_EVIDENCE:')));
});

test('claim term resolved by existing stamp passes', () => {
  const dir = makeDocs({
    stamps: ['ES-E0-CONTRACT-1'],
    docs: { 'STATUS.json': '{"status":"READY","evidence":"ES-E0-CONTRACT-1"}' },
  });
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, true);
  assert.equal(result.filesWithClaims, 1);
});

test('stampId-only artifact cannot resolve a claim', () => {
  const dir = makeDocs({ docs: { 'STATUS.json': '{"status":"READY","evidence":"STAMP_ONLY"}' } });
  fs.writeFileSync(
    path.join(dir, 'docs', 'OPS', 'R24', 'EVIDENCE', 'minimal.json'),
    JSON.stringify({ stampId: 'STAMP_ONLY' }),
  );
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes('E_EVIDENCE_ARTIFACT_SCHEMA:')));
});

test('claim binding misdeclared as EvidenceStampV2 fails strict schema', () => {
  const dir = makeDocs({ docs: { 'STATUS.json': '{"status":"READY","evidence":"BAD-BINDING"}' } });
  fs.writeFileSync(
    path.join(dir, 'docs', 'OPS', 'R24', 'EVIDENCE', 'bad-binding.json'),
    JSON.stringify({
      schemaVersion: 'EvidenceStampV2',
      stampId: 'BAD-BINDING',
      claimBindings: [],
    }),
  );
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.endsWith(':E_EVIDENCE_STAMP_SCHEMA')));
});

test('underspecified ClaimBindingV1 fails strict schema', () => {
  const dir = makeDocs({ docs: { 'STATUS.json': '{"status":"READY","evidence":"BAD-CB"}' } });
  fs.writeFileSync(
    path.join(dir, 'docs', 'OPS', 'R24', 'EVIDENCE', 'bad-claim-binding.json'),
    JSON.stringify({
      schemaVersion: 'ClaimBindingV1',
      stampId: 'BAD-CB',
      claimBindings: [],
    }),
  );
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.endsWith(':E_CLAIM_BINDING_SCHEMA')));
});

test('surface without claim terms passes vacuously', () => {
  const dir = makeDocs({ docs: { 'REGISTRY.json': '{"note":"plain operational text"}' } });
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, true);
  assert.equal(result.filesWithClaims, 0);
});

test('unreadable evidence artifact fails closed', () => {
  const dir = makeDocs({ docs: {} });
  fs.writeFileSync(path.join(dir, 'docs', 'OPS', 'R24', 'EVIDENCE', 'broken.json'), '{nope');
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.startsWith('E_EVIDENCE_STAMP_UNREADABLE:')));
});

test('claim term in immutable file resolves through exact sha-bound evidence binding', () => {
  const content = '{"status":"READY"}';
  const dir = makeDocs({ docs: { 'SEALED.json': content } });
  const stamp = {
    schemaVersion: 'ClaimBindingV1',
    stampId: 'ES-R24-A0-SEALED-BINDING',
    contourId: 'A0',
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha: HEAD,
    originMainSha: HEAD,
    generatedAtUtc: NOW,
    oracle: 'exact sha-bound docs claim',
    claimBindings: [
      {
        filePath: 'docs/OPS/R24/SEALED.json',
        sha256: sha256(content),
        claimTerms: ['READY'],
      },
    ],
    nonClaims: ['No broader claim.'],
  };
  fs.writeFileSync(
    path.join(dir, 'docs', 'OPS', 'R24', 'EVIDENCE', 'ES-R24-A0-SEALED-BINDING.json'),
    JSON.stringify(stamp),
  );
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, true);
  assert.equal(result.filesWithClaims, 1);
  assert.equal(result.stampCount, 1);
});

test('sha-bound evidence binding fails closed when target digest changes', () => {
  const dir = makeDocs({ docs: { 'SEALED.json': '{"status":"READY"}' } });
  const stamp = {
    schemaVersion: 'ClaimBindingV1',
    stampId: 'ES-R24-A0-SEALED-BINDING',
    contourId: 'A0',
    evidenceClass: 'CONTRACT',
    verdict: 'PASS',
    headSha: HEAD,
    originMainSha: HEAD,
    generatedAtUtc: NOW,
    oracle: 'exact sha-bound docs claim',
    claimBindings: [
      {
        filePath: 'docs/OPS/R24/SEALED.json',
        sha256: sha256('different bytes'),
        claimTerms: ['READY'],
      },
    ],
    nonClaims: ['No broader claim.'],
  };
  fs.writeFileSync(
    path.join(dir, 'docs', 'OPS', 'R24', 'EVIDENCE', 'ES-R24-A0-SEALED-BINDING.json'),
    JSON.stringify(stamp),
  );
  const result = lintDocsClaims(dir);
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('E_CLAIM_BINDING_DIGEST_MISMATCH:docs/OPS/R24/SEALED.json'));
});

test('WP603 original inventory binding is accepted only at its exact merged bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V4.find(
    (item) => item.stampId === 'ES-R24-WP-603-WSE-STATE-EVIDENCE-CLAIM-BINDINGS',
  );
  assert.ok(pin);
  const stampPath = path.join(REPO_ROOT, 'docs', 'OPS', 'R24', 'EVIDENCE', `${pin.stampId}.json`);
  const stampBytes = fs.readFileSync(stampPath);
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes: Buffer.concat([stampBytes, Buffer.from('x')]), binding }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('PRE00C closed-stage inventory binding is accepted only at its exact merged bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V24.find(
    (item) => item.stampId === 'ES-R24-PRE00C-CLOSED-STAGE-CANDIDATE-VERIFIER-REPAIR',
  );
  assert.ok(pin);
  const stampPath = path.join(REPO_ROOT, 'docs', 'OPS', 'R24', 'EVIDENCE', `${pin.stampId}.json`);
  const stampBytes = fs.readFileSync(stampPath);
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('PRE00D successor admission inventory binding is accepted only at its exact merged bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V25.find(
    (item) => item.stampId === 'ES-R24-PRE00D-FRESH-SUCCESSOR-ADMISSION-LEASE-HANDOFF',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, '199efa8fa71648671e02e695993462ccb6758be2');
  assert.equal(pin.targetSha256, 'ba6024c916943d390153af74879cc9a0a387770e9cbca38e3391b72ec7f2d559');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('PRE00E recovery CI inventory binding is accepted only at its exact repaired main bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V28.find(
    (item) => item.stampId === 'ES-R24-PRE00E-RECOVERY-CI-EXTERNAL-CONFIRMATION'
      && item.evaluationSha === '6e9be072a12ff3bd5cc1608da153caf13c5e94c2',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, '6e9be072a12ff3bd5cc1608da153caf13c5e94c2');
  assert.equal(pin.targetSha256, '3004a23485401be83ac0693b5fec3ce0e9e955bc470dc460db646a0f8078a403');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('PRE00F plan delivery inventory binding is accepted only at its exact historical delivery bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V27.find(
    (item) => item.stampId === 'ES-R24-PRE00F-PLAN-DELIVERY-CLAIM-BINDINGS',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, '31d27ce0f8ef7e4e4b6f2fee33382612f07a2e18');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('RCV00A inventory binding is retained only at the RCV00B base bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V29.find(
    (item) => item.stampId === 'ES-R24-RCV00A-EXACT-TOOLCHAIN-ENTRYPOINT-CLAIM-BINDINGS',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, '4761f80544808396bd287a44a640104d400bbf55');
  assert.equal(pin.targetSha256, '2c37d3cb43026a718bf37cc3a3382d20fa7cd802c2b2f8fa764fd025c7297acc');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('interop-100 inventory binding is retained only at the RCV00B base bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V29.find(
    (item) => item.stampId === 'ES-R24-INTEROP-100-C1B-CURRENT-CLAIM-BINDINGS',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, '4761f80544808396bd287a44a640104d400bbf55');
  assert.equal(pin.targetSha256, '2c37d3cb43026a718bf37cc3a3382d20fa7cd802c2b2f8fa764fd025c7297acc');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('RCV00B effective-state compiler inventory binding is retained only at exact delivery bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V30.find(
    (item) => item.stampId === 'ES-R24-RCV00B-EFFECTIVE-STATE-COMPILER-CLAIM-BINDINGS',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, '0e3864e6b40b635d3b13cc038d7c23d47276150f');
  assert.equal(pin.evaluationTree, '2834fe691d6ccbc8ce9721cf7eb2b2e925b548f1');
  assert.equal(pin.targetSha256, 'bf962ad122a1cf071fac226ff9d671b5a3aaa7a3d7195bef9e17918dd40320cf');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('RCV00C corrective-register inventory binding is retained only at exact delivery bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V31.find(
    (item) => item.stampId === 'ES-R24-RCV00C-CORRECTIVE-REGISTER-CROSSWALK-CLAIM-BINDINGS',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, 'd2366bcc6dfce13a92f2136dae1a80b364c8a0ef');
  assert.equal(pin.evaluationTree, 'b09080d7161a4489ba3388d9480a88166e2adc0f');
  assert.equal(pin.targetSha256, 'a11728d9c31e3d3019db8874443f1e2c2c9591e6545f79e5dfbd8f916ebf9fb3');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('RCV00D graph-derived selector inventory binding is retained only at exact delivery bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V32.find(
    (item) => item.stampId === 'ES-R24-RCV00D-GRAPH-DERIVED-SELECTOR-CLAIM-BINDINGS',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationSha, '0e0560634c8bce92e83cbf11380b47023b49e7c6');
  assert.equal(pin.evaluationTree, '8c3dce95e1a822063a9e80d2a9f4079261f398da');
  assert.equal(pin.targetSha256, 'c57a8e473f25f9ccbd46013097249fb346c9869fa7b0496570ef2b26aa8f4833');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('PRE00E refreshed current inventory bindings are accepted only as historical bytes', () => {
  const expectedPins = [
    'ES-R24-PRE00E-RECOVERY-CI-EXTERNAL-CONFIRMATION',
    'ES-R24-INTEROP-100-C1B-CURRENT-CLAIM-BINDINGS',
    'ES-R24-RCV00A-EXACT-TOOLCHAIN-ENTRYPOINT-CLAIM-BINDINGS',
  ];
  for (const stampId of expectedPins) {
    const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V28.find(
      (item) => item.stampId === stampId
        && item.evaluationSha === '6e9be072a12ff3bd5cc1608da153caf13c5e94c2',
    );
    assert.ok(pin, stampId);
    assert.equal(pin.targetSha256, '3004a23485401be83ac0693b5fec3ce0e9e955bc470dc460db646a0f8078a403');
    const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:docs/OPS/R24/EVIDENCE/${pin.stampId}.json`], {
      cwd: REPO_ROOT,
      encoding: null,
    });
    const stamp = JSON.parse(stampBytes);
    const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
    const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
    assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
    assert.equal(result.currentFileCoverage, false);
    assert.equal(result.evaluationSha, pin.evaluationSha);
  }
});

test('PRE00E DOCX bridge inventory refresh retains interop current-claim bindings as historical bytes', () => {
  const expectedPins = [
    'ES-R24-INTEROP-100-C1B-CURRENT-CLAIM-BINDINGS',
    'ES-R24-RCV00A-EXACT-TOOLCHAIN-ENTRYPOINT-CLAIM-BINDINGS',
  ];
  for (const stampId of expectedPins) {
    const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V33.find(
      (item) => item.stampId === stampId
        && item.evaluationSha === '9f23ef25ed239da58001b1744ef575760d32aa1f',
    );
    assert.ok(pin, stampId);
    assert.equal(pin.evaluationTree, '58ee86a9b491b91f6b1a046a9f3ab7e60d418f57');
    assert.equal(pin.targetSha256, 'e3c729263d8eea6c253f3152750ef956a7b49296eb5cc97ebf53c866d843a103');
    const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
    const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
      cwd: REPO_ROOT,
      encoding: null,
    });
    const stamp = JSON.parse(stampBytes);
    const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
    const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
    assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
    assert.equal(result.currentFileCoverage, false);
    assert.equal(result.evaluationSha, pin.evaluationSha);
  }
});

test('RCV00E lease-fencing CAS inventory binding is historical after successor refresh', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V34.find(
    (item) => item.stampId === 'ES-R24-RCV00E-LEASE-FENCING-CAS-CLAIM-BINDINGS'
      && item.evaluationSha === 'c36344ab3b5905759e699aec81c93efd5b71827c',
  );
  assert.ok(pin);
  assert.equal(pin.evaluationTree, 'ba75350518e0cb61210c992247bca5fe5e06b43c');
  assert.equal(pin.targetSha256, '68fb6546cbfecd00a97a40c275431d68bca6f7adb79cd072e751aef9797f4768');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
});

test('P07 inventory refresh retains current-claim carriers and RCV00D as historical bytes', () => {
  const expectedPins = [
    ['ES-R24-INTEROP-100-C1B-CURRENT-CLAIM-BINDINGS', 'ae8838dc3cca5f3bbcc420936baf589b2d3be3fa', '95c0434ddd680dc3a9580a7377d1b13432ef7497ee49bdc6ac6bade314efb138'],
    ['ES-R24-RCV00A-EXACT-TOOLCHAIN-ENTRYPOINT-CLAIM-BINDINGS', 'ae8838dc3cca5f3bbcc420936baf589b2d3be3fa', '95c0434ddd680dc3a9580a7377d1b13432ef7497ee49bdc6ac6bade314efb138'],
    ['ES-R24-RCV00D-GRAPH-DERIVED-SELECTOR-CLAIM-BINDINGS', '9c85e70b3166f2a78e61d5aba454820afa303e80', '3fb2cd80af4a1c7e2fab999311db7736c3b0420a26a31490e03f52cad5248d5e'],
  ];
  for (const [stampId, evaluationSha, targetSha256] of expectedPins) {
    const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V36.find(
      (item) => item.stampId === stampId && item.evaluationSha === evaluationSha,
    );
    assert.ok(pin, stampId);
    assert.equal(pin.targetSha256, targetSha256);
    const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
    const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
      cwd: REPO_ROOT,
      encoding: null,
    });
    const stamp = JSON.parse(stampBytes);
    const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
    const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
    assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
    assert.equal(result.currentFileCoverage, false);
    assert.equal(result.evaluationSha, pin.evaluationSha);
    assert.throws(
      () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
      /E_HISTORICAL_INVENTORY_BINDING/,
    );
  }
});

test('RCV00B current-head inventory refresh retains RCV00A current-head evidence as historical bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V38.find(
    (item) => item.stampId === 'ES-R24-RCV00A-CURRENT-HEAD-EXACT-TOOLCHAIN-ENTRYPOINT'
      && item.evaluationSha === 'e9aa4e3f5b75ea574d72baec4ac7e4ae20ce5c36',
  );
  assert.ok(pin);
  assert.equal(pin.targetSha256, 'b446e1d623feae8b4202476019b504818892eb08af411b4f053d693b9b5c5a9e');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('PR1888 inventory refresh retains RCV00B current-head effective-state evidence as historical bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V39.find(
    (item) => item.stampId === 'ES-R24-RCV00B-CURRENT-HEAD-EFFECTIVE-STATE-COMPILER'
      && item.evaluationSha === '9fc69f8980a4266ab43a0c4609802d9c6264f7aa',
  );
  assert.ok(pin);
  assert.equal(pin.targetSha256, 'c9c0ace2f022e949ead320162a8d900e8a9658e0313fdd636fcb27ab95da8498');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  assert.equal(stamp.headSha, 'e9aa4e3f5b75ea574d72baec4ac7e4ae20ce5c36');
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('PR1892 merge-forward retains refreshed RCV00B current-head effective-state evidence as historical bytes', () => {
  const pin = HISTORICAL_INVENTORY_CLAIM_PINS_V40.find(
    (item) => item.stampId === 'ES-R24-RCV00B-CURRENT-HEAD-EFFECTIVE-STATE-COMPILER'
      && item.evaluationSha === 'f6bb2126c19abb04e180c8abb6d206cc39b8a2a2',
  );
  assert.ok(pin);
  assert.equal(pin.targetSha256, '1e8a04abd411da50e852a60ddf47cf410b0c4f1fc49d8a78c104e5616fe42877');
  const stampPath = `docs/OPS/R24/EVIDENCE/${pin.stampId}.json`;
  const stampBytes = execFileSync('git', ['show', `${pin.evaluationSha}:${stampPath}`], {
    cwd: REPO_ROOT,
    encoding: null,
  });
  const stamp = JSON.parse(stampBytes);
  assert.equal(stamp.headSha, 'e9aa4e3f5b75ea574d72baec4ac7e4ae20ce5c36');
  const binding = stamp.claimBindings.find((entry) => entry.filePath === INVENTORY_PATH);
  const result = verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding });
  assert.equal(result.status, 'VERIFIED_HISTORICAL_BYTES');
  assert.equal(result.currentFileCoverage, false);
  assert.equal(result.evaluationSha, pin.evaluationSha);
  assert.throws(
    () => verifyHistoricalInventoryClaim({ rootDir: REPO_ROOT, stamp, stampBytes, binding: { ...binding, sha256: '0'.repeat(64) } }),
    /E_HISTORICAL_INVENTORY_BINDING/,
  );
});

test('repository claim surface keeps current and historical C1B inventory bindings', () => {
  const result = lintDocsClaims(REPO_ROOT);
  assert.equal(result.ok, true, result.failures.join('\n'));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-WP-603-WSE-STATE-EVIDENCE-CLAIM-BINDINGS',
  ));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-PRE00C-CLOSED-STAGE-CANDIDATE-VERIFIER-REPAIR',
  ));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-PRE00E-RECOVERY-CI-EXTERNAL-CONFIRMATION',
  ));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-RCV00B-EFFECTIVE-STATE-COMPILER-CLAIM-BINDINGS',
  ));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-RCV00C-CORRECTIVE-REGISTER-CROSSWALK-CLAIM-BINDINGS',
  ));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-RCV00D-GRAPH-DERIVED-SELECTOR-CLAIM-BINDINGS',
  ));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-RCV00E-LEASE-FENCING-CAS-CLAIM-BINDINGS',
  ));
  assert.ok(result.historicalBindings.some(
    (binding) => binding.stampId === 'ES-R24-RCV00A-CURRENT-HEAD-EXACT-TOOLCHAIN-ENTRYPOINT',
  ));
});
