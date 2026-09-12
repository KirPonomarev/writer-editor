import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../scripts/ops/r24/executable-program.mjs';
import { initPlanState, readPlanState } from '../../scripts/ops/r24/plan-state.mjs';
import { acquireLease } from '../../scripts/ops/r24/lease.mjs';
import { canonicalDigest } from '../../scripts/ops/r24/canonical-json.mjs';

export const NOW = '2026-09-12T20:00:00.000Z';
export function prepare(root) {
  const filePath = path.join(root, 'plan.json');
  initPlanState(filePath);
  if (!readPlanState(filePath).leases.F) acquireLease(filePath, {
    contourId: 'F', writerId: 'W', missionId: 'M', ttlMs: 3600000, now: NOW, expectedRevision: 0
  });
  fs.mkdirSync(path.join(root, 'effects'), { recursive: true });
  return filePath;
}

export function host(root, mode = 'NORMAL') {
  if (!['NORMAL', 'BEFORE_EFFECT', 'AFTER_EFFECT'].includes(mode)) throw new Error('INVALID_CRASH_MODE');
  const filePath = path.join(root, 'plan.json');
  const state = readPlanState(filePath);
  const identity = { runId: 'RUN', contourId: 'F', attemptId: 'A', writerId: 'W', fencingToken: 1,
    headSha: 'a'.repeat(40), treeSha: 'b'.repeat(40), admissionDigest: 'c'.repeat(64) };
  const program = { guards: [{ id: 'G0_AUTHORITY_CLOSURE', state: 'CURRENT' }], nodes: [
    { id: 'F', kind: 'FOUNDATION', profile: 'LAB', dependsOn: [], state: 'PENDING', ownerGate: null, evidenceContract: { requiredClasses: ['CONTRACT'] } },
    { id: 'NEXT', kind: 'WORK_PACKAGE', profile: 'LAB', dependsOn: ['F'], state: 'PENDING', ownerGate: null, evidenceContract: { requiredClasses: ['CONTRACT'] } }
  ] };
  const contours = Object.fromEntries(Object.entries(state.contours).map(([id, row]) => [id, row.state]));
  const mission = { missionId: 'M', missionDigest: 'd'.repeat(64), selectedProfiles: ['LAB'], approved: true, autonomyEnabled: true,
    stateRevision: state.revision, fencingCounter: state.fencingCounter, stateDigest: canonicalDigest(state), contourStatesDigest: canonicalDigest(contours),
    policyEpoch: 1, policyDigest: 'e'.repeat(64), graphNodeCount: program.nodes.length, graphDigest: canonicalDigest(program), schedulerGraphDigest: canonicalDigest(program.nodes),
    sourceOfTruthPath: 'docs/OPS/R24/EXECUTABLE_PROGRAM_R2_4.json', identityRoles: { implementationSourceSha: identity.headSha,
      evaluationHeadSha: identity.headSha, evaluationTreeSha: identity.treeSha, prHeadSha: null, mergeSha: null, postmergeSha: null } };
  const control = () => fs.existsSync(path.join(root, 'control.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'control.json'))) : { action: 'CONTINUE' };
  const effectPath = (request) => path.join(root, 'effects', request.reservation.effectIdempotencyKey + '.json');
  const payload = (request) => ({ bindingDigest: request.bindingDigest, stepId: request.reservation.stepId, effectIdempotencyKey: request.reservation.effectIdempotencyKey });
  const receipt = (request, status) => ({ ...payload(request), status,
    evidenceDigest: canonicalDigest(status === 'APPLIED' ? JSON.parse(fs.readFileSync(effectPath(request)))
      : status === 'NOT_APPLIED_FINAL' ? { status, target: payload(request) } : { status, control: control() }), reasonCode: status });
  return { filePath, identity, program, mission, steps: ['IMPLEMENT', 'PROVE', 'DELIVER'],
    admissionPort: { revalidate(request) { return { status: control().admission ?? 'ADMITTED', requestDigest: canonicalDigest(request) }; } },
    controlPort: { read: () => control().action },
    effectPort: {
      execute(request) {
        if (mode === 'BEFORE_EFFECT') process.exit(71);
        const wait = control().wait;
        if (wait) return receipt(request, wait);
        const target = effectPath(request);
        if (!fs.existsSync(target)) {
          const fd = fs.openSync(target, 'wx');
          try { fs.writeFileSync(fd, JSON.stringify(payload(request))); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
          const journal = fs.openSync(path.join(root, 'effects-observed.jsonl'), 'a');
          try { fs.writeFileSync(journal, JSON.stringify(payload(request)) + '\n'); fs.fsyncSync(journal); } finally { fs.closeSync(journal); }
        }
        if (mode === 'AFTER_EFFECT') process.exit(72);
        return receipt(request, 'APPLIED');
      },
      reconcile(request) { return receipt(request, fs.existsSync(effectPath(request)) ? 'APPLIED' : (control().wait ?? 'NOT_APPLIED_FINAL')); }
    },
    receiptPort: {
      verify(value, request) {
        if (value.status === 'APPLIED' && !fs.existsSync(effectPath(request))) return false;
        if (value.status === 'APPLIED' && canonicalDigest(JSON.parse(fs.readFileSync(effectPath(request)))) !== canonicalDigest(payload(request))) return false;
        if (value.status === 'NOT_APPLIED_FINAL' && fs.existsSync(effectPath(request))) return false;
        if (value.status.startsWith('WAIT_') && control().wait !== value.status) return false;
        return canonicalDigest(value) === canonicalDigest(receipt(request, value.status));
      }
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fs.realpathSync(process.argv[2]);
  if (!path.basename(root).startsWith('r24-rcv00f-')) throw new Error('SYNTHETIC_ROOT_REQUIRED');
  main(['--drive-one', '--now', NOW], { executor: host(root, process.argv[3] ?? 'NORMAL') });
}
