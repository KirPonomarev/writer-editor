'use strict';
// Owned child for process-death tests. The parent kills only this PID after an
// observed filesystem/authority boundary, then launches a fresh recovery child.
const fs = require('node:fs/promises');
const path = require('node:path');
const tx = require('../../src/core/project-transaction-v1.cjs');
const [root, mode, killAt] = process.argv.slice(2);
const scenePath = path.join(root, 'roman', 'imported.txt');
const manifestPath = path.join(root, 'project.json');
const assetPath = path.join(root, 'assets', 'new.png');
const receiptPath = path.join(root, '.yalken', 'receipts', 'operation.json');
const originalManifest = '{"projectId":"tx-resources","revision":0}';
const nextManifest = '{"projectId":"tx-resources","revision":1}';
const point = async name => {
  if (mode === 'crash' && killAt === name) {
    process.send({ point: name });
    await new Promise(() => { setInterval(() => {}, 1000); });
  }
};
(async () => {
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, 'anchors'), useLeaseHeartbeatWorker: false, leaseTtlMs: 1000 });
  if (mode === 'recover') {
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const state = await authority.leaseManager.inspect('tx-resources');
      if (!state.exists || state.expired) break;
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
  const result = await authority.withProjectLease('tx-resources', lease => lease.publish(async proof => {
    const adapter = { ...fs,
      rename: async (from, to) => {
        await proof.assertOwned();
        await fs.rename(from, to);
        if (to === tx.journalPathFor(manifestPath)) await point('PREPARE');
        if (to === scenePath) await point('SCENE');
        if (to === tx.commitPathFor(scenePath)) await point('COMMIT');
      },
      link: async (from, to) => {
        await proof.assertOwned();
        await fs.link(from, to);
        if (to === scenePath) await point('SCENE');
        if (to === assetPath) await point('ASSET_LINK');
        if (to === receiptPath) await point('RECEIPT_LINK');
      },
      unlink: async target => {
        await proof.assertOwned();
        if (target === tx.journalPathFor(manifestPath)) await point('BEFORE_CLEANUP');
        await fs.unlink(target);
        if (target === tx.journalPathFor(manifestPath)) await point('AFTER_CLEANUP');
      },
    };
    const publishManifest = async ({ expectedText, nextText }) => {
      await authority.commitManifestText({ projectId: 'tx-resources', targetPath: manifestPath, expectedText, nextText, lease });
      await point('MANIFEST');
    };
    const verifyManifestContinuation = args => authority.verifyManifestContinuation({ ...args, projectId: 'tx-resources' });
    if (mode === 'recover') {
      const recovery = await tx.recoverProjectTransaction({ scenePath, manifestPath, publishManifest, verifyManifestContinuation, fsAdapter: adapter });
      const committed = recovery.outcome === 'COMMITTED_CONVERGED' || (recovery.outcome === 'NO_JOURNAL' && await fs.readFile(manifestPath, 'utf8') === nextManifest);
      if (committed) await tx.readVerifiedProjectTransaction({ scenePath, manifestPath, verifyManifestContinuation });
      return { recovery, committed };
    }
    return tx.commitProjectTransaction({ scenePath, manifestPath, sceneContent: 'imported 🧭', expectedSceneContent: null,
      manifestContent: nextManifest, expectedManifestContent: originalManifest, revision: lease.fencingGeneration,
      createResources: [{ path: assetPath, content: Buffer.from([0, 255, 128, 1]) },
        { path: receiptPath, content: '{"operationId":"synthetic-owned-operation"}\n' }],
      publishManifest, verifyManifestContinuation, fsAdapter: adapter });
  }));
  process.stdout.write(JSON.stringify(result));
})().catch(error => { process.stderr.write(`${error.stack || JSON.stringify(error)}\n`); process.exitCode = 1; });
