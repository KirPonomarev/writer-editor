import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [projectRoot, stage, sceneRelativePath = 'scene.md'] = process.argv.slice(2);
if (!projectRoot || !stage) process.exit(64);

const scenePath = path.join(projectRoot, ...sceneRelativePath.split('/'));
const sourceText = await fs.readFile(scenePath, 'utf8');
const revisionBridge = await import(pathToFileURL(path.join(process.cwd(), 'src/io/revisionBridge/index.mjs')).href);
const safeWrite = await import(
  pathToFileURL(path.join(process.cwd(), 'src/io/revisionBridge/exactTextMinSafeWrite.mjs')).href
);

const projectSnapshot = {
  projectId: 'project-crash',
  baselineHash: 'baseline-crash',
  scenes: [{ sceneId: 'scene-1', text: sourceText }],
};
const revisionSession = {
  projectId: 'project-crash',
  sessionId: 'session-crash',
  baselineHash: 'baseline-crash',
  status: 'open',
  reviewGraph: {
    commentThreads: [],
    commentPlacements: [],
    textChanges: [{
      changeId: 'change-crash',
      targetScope: { type: 'scene', id: 'scene-1' },
      match: { kind: 'exact', quote: 'beta', prefix: '', suffix: '' },
      replacementText: 'delta',
      createdAt: '2026-07-12T12:00:00.000Z',
    }],
    structuralChanges: [],
    diagnosticItems: [],
    decisionStates: [],
  },
};
const planPreview = revisionBridge.buildExactTextApplyPlanNoDiskPreview({
  projectSnapshot,
  revisionSession,
});
const input = {
  projectRoot,
  projectSnapshot,
  revisionSession,
  planPreview,
  scenePath,
  scenePathBySceneId: { 'scene-1': scenePath },
};
const exitAt = (name, code) => (stage === name ? () => process.exit(code) : undefined);

await safeWrite.applyExactTextMinSafeWrite(input, {
  operationId: `op_crash_${stage}`,
  beforeRename: exitAt('before_rename', 71),
  afterRenameBeforeReceipt: exitAt('after_rename', 72),
  beforeReceipt: exitAt('before_receipt', 73),
  afterReceiptWritten: exitAt('after_receipt', 74),
});
process.exit(65);
