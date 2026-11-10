import { sha256Hex } from './browser-safe-hash.mjs';
import { upsertProjectTreeIdentityNode } from './projectTreeIdentity.mjs';
import envelope from './document-content-envelope-v1.cjs';

const need = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };
const bytes = text => new TextEncoder().encode(text).length;
const json = value => JSON.stringify(value, null, 2) + '\n';
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

// The input is the Main-owned, immutable result of the existing bounded
// Markdown parser. It is not a renderer plan or a DOCX admission.
export function* prepareMarkdownNewProjectSteps({ source, projectId, projectName, operationId, createdAtUtc }) {
  need(typeof projectId === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(projectId), 'MARKDOWN_NEW_PROJECT_ID');
  need(typeof projectName === 'string' && projectName.trim() === projectName && projectName.length > 0
    && projectName.isWellFormed() && bytes(projectName) <= 512 && !/[\u0000-\u001f\u007f]/u.test(projectName), 'MARKDOWN_NEW_PROJECT_NAME');
  need(typeof operationId === 'string' && /^[a-zA-Z0-9:._-]{1,192}$/u.test(operationId), 'MARKDOWN_NEW_PROJECT_OPERATION');
  need(typeof createdAtUtc === 'string' && Number.isFinite(Date.parse(createdAtUtc))
    && new Date(createdAtUtc).toISOString() === createdAtUtc, 'MARKDOWN_NEW_PROJECT_CLOCK');
  need(source && typeof source === 'object' && !Array.isArray(source)
    && typeof source.sourceSha256 === 'string' && /^[a-f0-9]{64}$/u.test(source.sourceSha256)
    && typeof source.canonicalContent === 'string' && source.canonicalContent.isWellFormed(), 'MARKDOWN_NEW_PROJECT_SOURCE');
  // Retain the existing fresh-project byte ceiling; the local source picker
  // still enforces its unchanged 1 MiB limit before parsing.
  need(bytes(source.canonicalContent) <= 32 * 1024 * 1024, 'MARKDOWN_NEW_PROJECT_BYTES');
  const parsed = envelope.parseObservablePayload(source.canonicalContent);
  need(!parsed.issue && parsed.doc?.type === 'doc', 'MARKDOWN_NEW_PROJECT_DOCUMENT');
  const relativePath = 'roman/Imported/0001 Imported Markdown.txt';
  const identity = upsertProjectTreeIdentityNode({ projectId, registry: { schemaVersion: 1, nodes: {} },
    bindingKey: `file:${relativePath}`, kind: 'scene' });
  need(identity.ok, 'MARKDOWN_NEW_PROJECT_TREE_IDENTITY');
  const manifestText = json({ schemaVersion: 1, projectId, projectName, createdAtUtc,
    treeIdentity: identity.value, lastCommandId: 1 });
  need(bytes(source.canonicalContent) + bytes(manifestText) <= 32 * 1024 * 1024, 'MARKDOWN_NEW_PROJECT_BYTES');
  const text = parsed.text;
  yield;
  return freeze({ schemaVersion: 'MARKDOWN_NEW_PROJECT_PREPARATION_V1', projectId, projectName, operationId,
    sourceSha256: source.sourceSha256, directoryName: `Markdown-${projectId}`,
    files: [{ relativePath, role: 'scene', content: source.canonicalContent,
      byteLength: bytes(source.canonicalContent), sha256: sha256Hex(source.canonicalContent) }],
    directories: ['roman', 'roman/Imported'], scenes: [{ sceneId: relativePath, nodeId: identity.nodeId }],
    manifestText, manifestSha256: sha256Hex(manifestText),
    summary: { target: 'new-project', sceneCount: 1, characters: [...text].length,
      currentUtf16CodeUnits: text.length, lossCount: source.lossReport?.count || 0 } });
}
