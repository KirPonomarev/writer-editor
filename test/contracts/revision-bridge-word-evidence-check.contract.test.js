const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const TEST_PATH = 'test/contracts/revision-bridge-word-evidence-check.contract.test.js';
const P0_TEST_PATH = 'test/contracts/revision-bridge-p0-safety-kernel.contract.test.js';
const ALLOWLIST = [MODULE_PATH, TEST_PATH, P0_TEST_PATH];

async function loadBridge() {
  return import(pathToFileURL(path.join(REPO_ROOT, MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validEvidencePacket(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.word-evidence-packet.v1',
    packetId: 'packet-1',
    packetClass: 'textExact',
    coverage: ['textExact'],
    evidence: [
      {
        evidenceId: 'evidence-1',
        supportClass: 'textExact',
        digest: 'sha256:document-main',
        locator: 'word/document.xml',
      },
    ],
    ...overrides,
  };
}

function validClaim(bridge, evidencePacket, overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.word-support-claim.v1',
    claimId: 'claim-1',
    claimedCoverage: deepClone(evidencePacket.coverage),
    evidenceHash: bridge.createWordEvidencePacketHash(evidencePacket),
    ...overrides,
  };
}

function validGateInput(bridge, overrides = {}) {
  const evidencePacket = overrides.evidencePacket || validEvidencePacket();
  const claim = overrides.claim || validClaim(bridge, evidencePacket);
  return {
    evidencePacket,
    claim,
  };
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

test('Contour 10 exports Word evidence gate contracts', async () => {
  const bridge = await loadBridge();

  assert.equal(
    bridge.REVISION_BRIDGE_WORD_EVIDENCE_PACKET_SCHEMA,
    'revision-bridge.word-evidence-packet.v1',
  );
  assert.equal(
    bridge.REVISION_BRIDGE_WORD_SUPPORT_CLAIM_SCHEMA,
    'revision-bridge.word-support-claim.v1',
  );
  assert.deepEqual(bridge.REVISION_BRIDGE_WORD_EVIDENCE_PACKET_CLASSES, [
    'textExact',
    'commentAnchor',
    'structuralManual',
  ]);
  assert.equal(typeof bridge.createWordEvidencePacketHash, 'function');
  assert.equal(typeof bridge.evaluateWordEvidenceClaimGate, 'function');
  assert.equal(
    bridge.REVISION_BRIDGE_WORD_EVIDENCE_CLAIM_GATE_REASON_CODES.includes('REVISION_BRIDGE_WORD_EVIDENCE_HASH_MISMATCH'),
    true,
  );
});

test('Contour 10 accepts every supported Word evidence packet class when hash and coverage align', async () => {
  const bridge = await loadBridge();

  for (const packetClass of bridge.REVISION_BRIDGE_WORD_EVIDENCE_PACKET_CLASSES) {
    const evidencePacket = validEvidencePacket({
      packetId: `packet-${packetClass}`,
      packetClass,
      coverage: [packetClass],
      evidence: [
        {
          evidenceId: `evidence-${packetClass}`,
          supportClass: packetClass,
          digest: `sha256:${packetClass}`,
          locator: `word/${packetClass}.xml`,
        },
      ],
    });
    const claim = validClaim(bridge, evidencePacket, {
      claimId: `claim-${packetClass}`,
      claimedCoverage: [packetClass],
    });

    const result = bridge.evaluateWordEvidenceClaimGate({ evidencePacket, claim });

    assert.equal(result.ok, true, packetClass);
    assert.equal(result.type, 'revisionBridge.wordEvidenceClaimGate');
    assert.equal(result.status, 'accepted');
    assert.equal(result.code, 'REVISION_BRIDGE_WORD_EVIDENCE_CLAIM_ACCEPTED');
    assert.equal(result.reason, 'REVISION_BRIDGE_WORD_EVIDENCE_CLAIM_ACCEPTED');
    assert.deepEqual(result.reasons, []);
    assert.equal(result.binding.evidenceHash, claim.evidenceHash);
    assert.deepEqual(result.binding.claimedCoverage, [packetClass]);
    assert.deepEqual(result.binding.coveredCoverage, [packetClass]);
  }
});

test('Contour 10 blocks claims when evidence is missing or invalid', async () => {
  const bridge = await loadBridge();
  const missingEvidence = bridge.evaluateWordEvidenceClaimGate({
    evidencePacket: {
      schemaVersion: 'revision-bridge.word-evidence-packet.v1',
      packetId: 'packet-missing',
      packetClass: 'textExact',
      coverage: ['textExact'],
    },
    claim: validClaim(bridge, validEvidencePacket()),
  });
  const invalidEvidence = bridge.evaluateWordEvidenceClaimGate({
    evidencePacket: validEvidencePacket({
      evidence: [
        {
          evidenceId: 'evidence-invalid',
          supportClass: 'unknown-class',
          digest: '',
        },
      ],
    }),
    claim: validClaim(bridge, validEvidencePacket()),
  });

  assert.equal(missingEvidence.ok, false);
  assert.equal(missingEvidence.status, 'blocked');
  assert.equal(missingEvidence.code, 'E_REVISION_BRIDGE_WORD_EVIDENCE_CLAIM_BLOCKED');
  assert.equal(missingEvidence.reason, 'REVISION_BRIDGE_WORD_EVIDENCE_PACKET_REQUIRED');
  assert.equal(missingEvidence.reasons.some((reason) => reason.field === 'evidencePacket.evidence'), true);

  assert.equal(invalidEvidence.ok, false);
  assert.equal(invalidEvidence.status, 'blocked');
  assert.equal(invalidEvidence.code, 'E_REVISION_BRIDGE_WORD_EVIDENCE_CLAIM_BLOCKED');
  assert.equal(invalidEvidence.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_WORD_EVIDENCE_PACKET_INVALID'
    && reason.field === 'evidencePacket.evidence.0.supportClass'
  )), true);
  assert.equal(invalidEvidence.reasons.some((reason) => (
    reason.code === 'REVISION_BRIDGE_WORD_EVIDENCE_PACKET_INVALID'
    && reason.field === 'evidencePacket.evidence.0.digest'
  )), true);
});

test('Contour 10 blocks claims when evidence hash does not match the supplied packet', async () => {
  const bridge = await loadBridge();
  const input = validGateInput(bridge, {
    claim: validClaim(bridge, validEvidencePacket(), {
      evidenceHash: 'rbwe_wrong',
    }),
  });

  const result = bridge.evaluateWordEvidenceClaimGate(input);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_WORD_EVIDENCE_HASH_MISMATCH');
  assert.equal(result.reasons.some((reason) => reason.code === 'REVISION_BRIDGE_WORD_EVIDENCE_HASH_MISMATCH'), true);
  assert.equal(result.binding.evidenceHash, bridge.createWordEvidencePacketHash(input.evidencePacket));
});

test('Contour 10 blocks claims that exceed evidence packet coverage', async () => {
  const bridge = await loadBridge();
  const evidencePacket = validEvidencePacket({
    coverage: ['textExact'],
  });
  const claim = validClaim(bridge, evidencePacket, {
    claimedCoverage: ['textExact', 'commentAnchor'],
  });

  const result = bridge.evaluateWordEvidenceClaimGate({ evidencePacket, claim });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'REVISION_BRIDGE_WORD_EVIDENCE_COVERAGE_EXCEEDED');
  assert.deepEqual(result.reasons[0].unsupportedCoverage, ['commentAnchor']);
});

test('Contour 10 packet hash stays canonical when semantically identical coverage and evidence order changes', async () => {
  const bridge = await loadBridge();
  const packetA = validEvidencePacket({
    coverage: ['textExact', 'commentAnchor'],
    evidence: [
      {
        evidenceId: 'evidence-1',
        supportClass: 'textExact',
        digest: 'sha256:text',
        locator: 'word/document.xml',
      },
      {
        evidenceId: 'evidence-2',
        supportClass: 'commentAnchor',
        digest: 'sha256:comments',
        locator: 'word/comments.xml',
      },
    ],
  });
  const packetB = validEvidencePacket({
    coverage: ['commentAnchor', 'textExact'],
    evidence: [
      {
        evidenceId: 'evidence-2',
        supportClass: 'commentAnchor',
        digest: 'sha256:comments',
        locator: 'word/comments.xml',
      },
      {
        evidenceId: 'evidence-1',
        supportClass: 'textExact',
        digest: 'sha256:text',
        locator: 'word/document.xml',
      },
    ],
  });
  const hashA = bridge.createWordEvidencePacketHash(packetA);
  const hashB = bridge.createWordEvidencePacketHash(packetB);
  const claim = validClaim(bridge, packetA, {
    claimedCoverage: ['commentAnchor', 'textExact'],
    evidenceHash: hashA,
  });

  const result = bridge.evaluateWordEvidenceClaimGate({
    evidencePacket: packetB,
    claim,
  });

  assert.equal(hashA, hashB);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'REVISION_BRIDGE_WORD_EVIDENCE_CLAIM_ACCEPTED');
});

test('Contour 10 gate does not mutate claim or evidence inputs', async () => {
  const bridge = await loadBridge();
  const input = validGateInput(bridge, {
    evidencePacket: validEvidencePacket({
      coverage: ['textExact', 'commentAnchor'],
      evidence: [
        {
          evidenceId: 'evidence-1',
          supportClass: 'textExact',
          digest: 'sha256:text',
          locator: 'word/document.xml',
        },
        {
          evidenceId: 'evidence-2',
          supportClass: 'commentAnchor',
          digest: 'sha256:comments',
          locator: 'word/comments.xml',
        },
      ],
    }),
  });
  input.claim = validClaim(bridge, input.evidencePacket, {
    claimedCoverage: ['textExact', 'commentAnchor'],
  });
  const before = deepClone(input);

  bridge.createWordEvidencePacketHash(input.evidencePacket);
  bridge.evaluateWordEvidenceClaimGate(input);

  assert.deepEqual(input, before);
});

test('Contour 10 gate module stays pure and free of runtime side-effect imports', () => {
  const text = fs.readFileSync(path.join(REPO_ROOT, MODULE_PATH), 'utf8');
  const forbiddenPatterns = [
    /\bimport\b/u,
    /\brequire\s*\(/u,
    /\bfs\b/u,
    /\bchild_process\b/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(text), false, `forbidden bridge pattern: ${pattern.source}`);
  }
});

test('Contour 10 changed files stay inside the contour allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
});
