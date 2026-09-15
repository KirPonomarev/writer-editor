import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

export const C1_FRESH_PATH = 'docs/OPS/RTK/YALKEN_INTEROP_C1_FRESH_EVIDENCE_SUCCESSOR_V1.json';
export const C1_FRESH_SHA256 = 'f46e9beaa585329639fd7ec608d67d79bbfcd0f5e0b8e2bfdd80705294346447';
export const C1_FRESH_BASE = 'f4a7d6541f5fc230f4a7a7f6dc7504eb85a615e9';
export const C1_FRESH_TREE = 'bc3cf4b4787d62c5ae8e854be791b9c0c241b681';
export const C1_FRESH_CELL = 'TEXT__SINGLE_SCENE__C1__SOURCE_RUNTIME';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_FILE = 8 * 1024 * 1024;
const ORACLES = ['SEMANTIC', 'STRUCTURE', 'ORDER', 'LOSS', 'PROVENANCE', 'INDEPENDENT_READBACK', 'CLEANUP'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };
const gitAt = root => args => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024 });

export function readFreshC1Successor(bytes) {
  requireValue(hash(bytes) === C1_FRESH_SHA256, 'C1_SUCCESSOR_PIN');
  return JSON.parse(bytes);
}

// Also used by the existing post-audit gate. Only this owner's bounded OPS
// delivery can promote f4a7d654 evidence; a runtime delta never inherits it.
export function verifyFreshC1Metadata({ git, candidateSha }) {
  requireValue(/^[a-f0-9]{40}$/u.test(candidateSha), 'C1_CURRENT_HEAD');
  const successor = readFreshC1Successor(git(['show', `${candidateSha}:${C1_FRESH_PATH}`]));
  requireValue(String(git(['rev-parse', `${C1_FRESH_BASE}^{tree}`])).trim() === C1_FRESH_TREE, 'C1_BASE_TREE');
  git(['merge-base', '--is-ancestor', C1_FRESH_BASE, candidateSha]);
  const changedPaths = String(git(['diff', '--name-only', '--no-renames', C1_FRESH_BASE, candidateSha, '--'])).trim().split('\n').filter(Boolean);
  requireValue(changedPaths.every(p => successor.admittedPaths.includes(p)), 'C1_RUNTIME_OR_UNADMITTED_CHANGE');
  for (const binding of successor.archivedFiles) {
    requireValue(hash(git(['show', `${candidateSha}:${binding.path}`])) === binding.sha256, 'C1_ARCHIVE_CHANGED');
  }
  return { status: 'PASS', baseSha: C1_FRESH_BASE, candidateSha, admittedPaths: successor.admittedPaths, changedPaths, successor };
}

export function readFreshC1File(root, binding) {
  requireValue(path.isAbsolute(root) && fs.realpathSync(root) === root, 'C1_PACKAGE_ROOT');
  const relative = binding.path;
  requireValue(typeof relative === 'string' && !path.isAbsolute(relative) && !relative.includes('\\')
    && relative.split('/').every(part => part && part !== '.' && part !== '..'), 'C1_PACKAGE_PATH');
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    requireValue(!fs.lstatSync(target).isSymbolicLink(), 'C1_PACKAGE_SYMLINK');
  }
  requireValue(fs.realpathSync(target) === target, 'C1_PACKAGE_CONTAINMENT');
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd);
    requireValue(before.isFile() && before.nlink === 1, 'C1_PACKAGE_FILE_KIND');
    requireValue(Number.isSafeInteger(binding.bytes) && binding.bytes >= 0 && binding.bytes <= MAX_FILE
      && before.size === binding.bytes, 'C1_PACKAGE_SIZE');
    const bounded = Buffer.alloc(binding.bytes + 1);
    let length = 0;
    while (length < bounded.length) {
      const n = fs.readSync(fd, bounded, length, bounded.length - length, null);
      if (n === 0) break;
      length += n;
    }
    const bytes = bounded.subarray(0, length);
    const after = fs.fstatSync(fd);
    requireValue(before.ino === after.ino && before.size === after.size && before.mtimeMs === after.mtimeMs
      && before.ctimeMs === after.ctimeMs, 'C1_PACKAGE_CHANGED_DURING_READ');
    requireValue(bytes.length === binding.bytes && hash(bytes) === binding.sha256, 'C1_PACKAGE_HASH');
    return bytes;
  } finally { fs.closeSync(fd); }
}

export function verifyFreshC1({ repoRoot = REPO_ROOT, evidenceRoot, currentHead, requiredCells, specErrors = [] }) {
  const started = performance.now();
  const errors = [...specErrors];
  let rawReadback = null;
  let successor = null;
  let candidateTree = null;
  let changedPaths = [];
  const git = gitAt(repoRoot);
  try {
    requireValue(fs.realpathSync(repoRoot) === fs.realpathSync(REPO_ROOT), 'C1_VERIFIER_CHECKOUT_MISMATCH');
    requireValue(errors.length === 0 && requiredCells.length === 1120
      && new Set(requiredCells.map(c => c.cellId)).size === 1120
      && requiredCells.some(c => c.cellId === C1_FRESH_CELL), 'C1_DENOMINATOR_INVALID');
    requireValue(currentHead === String(git(['rev-parse', 'HEAD'])).trim(), 'C1_ACTUAL_HEAD_MISMATCH');
    requireValue(String(git(['status', '--porcelain=v1', '--untracked-files=all'])).trim() === '', 'C1_DIRTY_CHECKOUT');
    const metadata = verifyFreshC1Metadata({ git, candidateSha: currentHead });
    ({ successor, changedPaths } = metadata);
    candidateTree = String(git(['rev-parse', 'HEAD^{tree}'])).trim();
    requireValue(typeof evidenceRoot === 'string' && evidenceRoot.length > 0, 'C1_PACKAGE_REQUIRED');
    // All names and hashes come from the repository-pinned successor, never
    // from a producer manifest or caller-controlled success receipt.
    requireValue(successor.files.length > 0 && successor.files.length <= 128
      && new Set(successor.files.map(b => b.path)).size === successor.files.length
      && successor.files.reduce((n, b) => n + b.bytes, 0) <= 64 * 1024 * 1024, 'C1_PACKAGE_MANIFEST');
    for (const binding of successor.files) readFreshC1File(evidenceRoot, binding);
    const result = spawnSync('python3', ['-I', '-B', path.join(REPO_ROOT, 'scripts/ops/rtk-interop-c1-raw-readback.py')], {
      input: JSON.stringify({ root: evidenceRoot, files: successor.files }), encoding: 'utf8',
      timeout: 10000, maxBuffer: 1024 * 1024, shell: false,
    });
    requireValue(!result.error && result.status === 0, `C1_RAW_READBACK_FAILED:${result.error?.code || result.stdout?.trim() || result.signal || result.status}`);
    rawReadback = JSON.parse(result.stdout);
    requireValue(rawReadback.ok === true && rawReadback.schemaVersion === 'C1_RAW_READBACK_V1'
      && rawReadback.admissionCredit === 0 && rawReadback.runId === successor.runId
      && rawReadback.productHead === C1_FRESH_BASE && rawReadback.productTree === C1_FRESH_TREE
      && rawReadback.filesVerified === successor.files.length
      && JSON.stringify(rawReadback.oracles) === JSON.stringify(ORACLES), 'C1_RAW_REPORT_BINDING');
    requireValue(String(git(['rev-parse', 'HEAD', 'HEAD^{tree}'])).trim() === `${currentHead}\n${candidateTree}`
      && String(git(['status', '--porcelain=v1', '--untracked-files=all'])).trim() === '', 'C1_CHECKOUT_CHANGED_DURING_ADMISSION');
  } catch (error) { errors.push(String(error.message)); }
  const accepted = errors.length === 0;
  return {
    ok: accepted, errors, contractId: 'YALKEN_INTEROP_100_SUPPORTED_CONTRACT_V1',
    currentHead, currentTree: candidateTree, physicalExecutionHead: C1_FRESH_BASE, physicalExecutionTree: C1_FRESH_TREE,
    evidenceMode: 'FRESH_C1_SUCCESSOR', authoritativeAdmission: accepted,
    requiredCells: 1120, recordedCells: accepted ? 1 : 0, passedRequiredCells: accepted ? 1 : 0,
    diagnosticPassedRequiredCells: 0, percentage: accepted ? 0.089286 : 0,
    statusCounts: { PASS: accepted ? 1 : 0, NOT_EXECUTED: accepted ? 1119 : 1120 },
    acceptedCellIds: accepted ? [C1_FRESH_CELL] : [], historicalNumeratorDelta: 0,
    broadPassClaim: false, claimVerdict: accepted ? 'NEEDS_MORE_EVIDENCE' : 'FAIL_FRESH_C1_EVIDENCE',
    successorSha256: C1_FRESH_SHA256, changedPaths, rawReadback,
    seconds: (performance.now() - started) / 1000,
    limitations: successor?.limitations || ['No current C1 admission without the complete verified raw package.'],
  };
}
