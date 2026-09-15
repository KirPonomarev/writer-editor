import { stableJson } from './reviewTransportCore.mjs';
import { recomputeAuthorityFromBijection } from './reviewTransportMatchProofV1.mjs';

export const RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA =
  'yalken.rtk.review-transport-block-exact-authority.v2';
export const RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_PROFILE =
  'bounded-block-local-exact-authority-v2-c03';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function list(value) {
  return Array.isArray(value) ? value.filter(isPlainObject) : [];
}

function writerBlockingItems(value) {
  return list(value).filter((item) => rawString(item.writerAuthorityImpact) !== 'inventory-only');
}

function rawString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeString(value) {
  return rawString(value).trim();
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function reason(code, field, message, details = {}) {
  return { code, field, message, ...details };
}

function resolveCryptoPort(port) {
  if (typeof port?.sha256Text === 'function' && typeof port?.sha256Json === 'function') {
    return { ok: true, port };
  }
  return {
    ok: false,
    reasons: [reason(
      'RTK_WRITE_PRECONDITION_FAILED',
      'cryptoPort',
      'C03 block exact authority evaluation requires CryptoPort.',
    )],
  };
}

function reviewIrFrom(input) {
  if (isPlainObject(input.reviewIr)) return input.reviewIr;
  if (isPlainObject(input.analysis?.reviewIr)) return input.analysis.reviewIr;
  return {};
}

function exactAuthorityFrom(input) {
  const authority = isPlainObject(input.exactAuthority) ? input.exactAuthority : {};
  return {
    validSignedLocator: authority.validSignedLocator === true,
    sceneRevisionUnchanged: authority.sceneRevisionUnchanged === true,
    rawSha256Unchanged: authority.rawSha256Unchanged === true,
    uniqueTarget: authority.uniqueTarget === true,
    nonOverlapping: authority.nonOverlapping === true,
    allRelevantXmlSemanticsAccounted: authority.allRelevantXmlSemanticsAccounted === true,
    ambiguousDuplicate: authority.ambiguousDuplicate === true,
    crossScene: authority.crossScene === true,
    structuralTopologyChanged: authority.structuralTopologyChanged === true,
  };
}

function authorityCarrierFrom(input) {
  if (isPlainObject(input.authorityCarrier)) return input.authorityCarrier;
  if (isPlainObject(input.analysis?.authorityCarrier)) return input.analysis.authorityCarrier;
  return {};
}

function selectedPayload(authorityCarrier) {
  const selected = isPlainObject(authorityCarrier.selectedCarrier)
    ? authorityCarrier.selectedCarrier
    : {};
  return isPlainObject(selected.payload) ? selected.payload : {};
}

function localBaselineFrom(input) {
  if (isPlainObject(input.localBaseline)) return input.localBaseline;
  if (isPlainObject(input.baseline)) return input.baseline;
  return {};
}

function baselineBlocks(localBaseline, payload) {
  const fromList = Array.isArray(localBaseline.sceneBlocks)
    ? localBaseline.sceneBlocks
    : (Array.isArray(localBaseline.blocks) ? localBaseline.blocks : []);
  const blocks = fromList.filter(isPlainObject).map((block) => ({
    blockId: normalizeString(block.blockId || block.id),
    sceneId: normalizeString(block.sceneId || localBaseline.sceneId || payload.sceneId),
    text: rawString(block.text || block.rawText || block.blockText),
    documentParagraphIndex: Number.isSafeInteger(block.documentParagraphIndex)
      ? block.documentParagraphIndex
      : null,
  }));
  const directText = rawString(localBaseline.blockText || localBaseline.text);
  const directBlockId = normalizeString(localBaseline.blockId);
  if (directText) {
    blocks.push({
      blockId: directBlockId || normalizeString(payload.blockId),
      sceneId: normalizeString(localBaseline.sceneId || payload.sceneId),
      text: directText,
      documentParagraphIndex: Number.isSafeInteger(localBaseline.documentParagraphIndex)
        ? localBaseline.documentParagraphIndex
        : null,
    });
  }
  return blocks.filter((block) => block.blockId || block.text);
}

function occurrenceRanges(haystack, needle) {
  const ranges = [];
  const source = rawString(haystack);
  const target = rawString(needle);
  if (!target) return ranges;
  let cursor = 0;
  while (cursor <= source.length) {
    const start = source.indexOf(target, cursor);
    if (start < 0) break;
    ranges.push({ start, end: start + target.length });
    cursor = start + 1;
  }
  return ranges;
}

function revisionParagraphIndex(value) {
  if (Number.isSafeInteger(value?.documentParagraphIndex) && value.documentParagraphIndex >= 0) {
    return value.documentParagraphIndex;
  }
  if (Number.isSafeInteger(value?.paragraphIndex) && value.paragraphIndex >= 0) {
    return value.paragraphIndex;
  }
  return null;
}

function commentParagraphIndex(thread) {
  const direct = revisionParagraphIndex(thread);
  if (direct !== null) return direct;
  return revisionParagraphIndex(isPlainObject(thread?.anchorLocator) ? thread.anchorLocator : {});
}

function signedSha256Text(cryptoPort, value) {
  const digest = normalizeString(cryptoPort.sha256Text(value));
  return digest.startsWith('sha256:') ? digest : `sha256:${digest}`;
}

function mainOwnedSceneOrdinalAuthorityProof(localBaseline, targetSceneId, targetBlockId, blocks, groups, reviewIr, cryptoPort) {
  const authority = isPlainObject(localBaseline.sceneOrdinalAuthority)
    ? localBaseline.sceneOrdinalAuthority
    : {};
  const reasons = [];
  const targetOrdinal = Number.isSafeInteger(authority.targetDocumentParagraphIndex)
    ? authority.targetDocumentParagraphIndex
    : null;
  const blockCount = Number.isSafeInteger(authority.blockCount) ? authority.blockCount : null;
  const returnedParagraphCount = Number.isSafeInteger(authority.returnedParagraphCount)
    ? authority.returnedParagraphCount
    : null;
  const providerLeadingBlankPrefixNormalized = authority.providerLeadingBlankPrefixNormalized === true;
  const paragraphIndexOffset = Number.isSafeInteger(authority.paragraphIndexOffset)
    ? authority.paragraphIndexOffset
    : 0;
  if (authority.schemaVersion !== 'yalken.rtk.return-intake.scene-ordinal-authority.v1'
    || authority.source !== 'main-owned-local-export-map') {
    reasons.push(reason(
      'RTK_BLOCKED_AUTHORITY_KIND_TAMPERED',
      'localBaseline.sceneOrdinalAuthority',
      'Main-owned scene ordinal authority capsule is required for Google C4 scene export-map authority.',
    ));
  }
  if (normalizeString(authority.sceneId) !== targetSceneId) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.sceneId',
      'Scene ordinal authority scene id must match the selected scene.',
      { expectedSceneId: targetSceneId, observedSceneId: normalizeString(authority.sceneId) },
    ));
  }
  if (normalizeString(authority.targetBlockId) !== targetBlockId) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.targetBlockId',
      'Scene ordinal authority target block must match the local selected block.',
      { expectedBlockId: targetBlockId, observedBlockId: normalizeString(authority.targetBlockId) },
    ));
  }
  const expectedReturnedParagraphCount = blocks.length + (providerLeadingBlankPrefixNormalized ? 1 : 0);
  if (
    blockCount !== blocks.length
    || returnedParagraphCount !== expectedReturnedParagraphCount
    || (providerLeadingBlankPrefixNormalized && paragraphIndexOffset !== 1)
    || (!providerLeadingBlankPrefixNormalized && paragraphIndexOffset !== 0)
  ) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.blockCount',
      'Scene ordinal authority must preserve exact local and returned paragraph cardinality.',
      {
        blockCount,
        returnedParagraphCount,
        localBlockCount: blocks.length,
        expectedReturnedParagraphCount,
        providerLeadingBlankPrefixNormalized,
        paragraphIndexOffset,
      },
    ));
  }
  const seenBlockIndexes = new Set();
  for (const [index, block] of blocks.entries()) {
    if (block.sceneId && block.sceneId !== targetSceneId) {
      reasons.push(reason(
        'RTK_COMMAND_ENVELOPE_TAMPERED',
        `localBaseline.sceneBlocks.${index}.sceneId`,
        'Scene ordinal authority blocks must all belong to the selected scene.',
        { expectedSceneId: targetSceneId, observedSceneId: block.sceneId },
      ));
    }
    if (block.documentParagraphIndex !== index || seenBlockIndexes.has(block.documentParagraphIndex)) {
      reasons.push(reason(
        'RTK_COMMAND_ENVELOPE_TAMPERED',
        `localBaseline.sceneBlocks.${index}.documentParagraphIndex`,
        'Scene ordinal authority blocks must preserve a contiguous document paragraph index sequence.',
        { expectedDocumentParagraphIndex: index, observedDocumentParagraphIndex: block.documentParagraphIndex },
      ));
    }
    seenBlockIndexes.add(block.documentParagraphIndex);
  }
  const currentRawSha256 = normalizeString(authority.currentRawSha256);
  const computedRawSha256 = signedSha256Text(cryptoPort, blocks.map((block) => rawString(block.text)).join('\n'));
  if (!currentRawSha256 || currentRawSha256 !== computedRawSha256) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.currentRawSha256',
      'Scene ordinal authority current raw hash must match the local scene block baseline.',
      { expectedRawSha256: computedRawSha256, observedRawSha256: currentRawSha256 },
    ));
  }
  const targetBlock = targetOrdinal === null ? null : blocks[targetOrdinal];
  if (!targetBlock || targetBlock.blockId !== targetBlockId) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.targetDocumentParagraphIndex',
      'Scene ordinal authority target paragraph must select the target block.',
      { targetOrdinal, targetBlockId },
    ));
  }
  if (targetBlock && targetBlock.documentParagraphIndex !== targetOrdinal) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.targetDocumentParagraphIndex',
      'Scene ordinal authority target block index must match the selected block document paragraph index.',
      {
        targetOrdinal,
        observedDocumentParagraphIndex: targetBlock.documentParagraphIndex,
        targetBlockId,
      },
    ));
  }
  if (authority.returnedGoogleBookmarkNamesAuthority !== false
    || authority.globalTextSearchAuthority !== false
    || authority.fuzzyMatchAuthority !== false) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.falseAuthorityFlags',
      'Returned Google bookmark names, global text search, and fuzzy matching must remain non-authoritative.',
    ));
  }
  const touched = Array.isArray(authority.touchedParagraphs)
    ? authority.touchedParagraphs.filter(isPlainObject)
    : [];
  if (groups.length > 0 && touched.length === 0) {
    reasons.push(reason(
      'RTK_COMMAND_ENVELOPE_TAMPERED',
      'localBaseline.sceneOrdinalAuthority.touchedParagraphs',
      'Replacement authority requires touched paragraph bindings from main intake.',
    ));
  }
  for (const entry of touched) {
    if (entry.documentParagraphIndex !== targetOrdinal || normalizeString(entry.blockId) !== targetBlockId) {
      reasons.push(reason(
        'RTK_COMMAND_ENVELOPE_TAMPERED',
        'localBaseline.sceneOrdinalAuthority.touchedParagraphs',
        'Touched returned paragraphs must bind to the selected target block.',
        {
          observedParagraphIndex: entry.documentParagraphIndex,
          observedBlockId: normalizeString(entry.blockId),
          targetOrdinal,
          targetBlockId,
        },
      ));
    }
  }
  const touchedKey = (kind, id) => `${kind}\n${id}`;
  const touchedByKey = new Map();
  for (const entry of touched) {
    const kind = normalizeString(entry.kind);
    const id = normalizeString(entry.id);
    if (kind && id) touchedByKey.set(touchedKey(kind, id), entry);
  }
  for (const group of groups) {
    for (const revision of Array.isArray(group.revisions) ? group.revisions : []) {
      const operation = normalizeString(revision.operation);
      const id = normalizeString(revision.nativeRevisionId);
      const index = revisionParagraphIndex(revision);
      if (index === null) {
        reasons.push(reason(
          'RTK_COMMAND_ENVELOPE_TAMPERED',
          `reviewIr.textRevisions.${id || operation}.paragraphIndex`,
          'Scene ordinal authority requires explicit paragraph indexes on paired text revisions.',
        ));
        continue;
      }
      const touchedEntry = touchedByKey.get(touchedKey(`textRevision:${operation}`, id));
      if (!touchedEntry || touchedEntry.rawReturnedParagraphIndex !== index || touchedEntry.documentParagraphIndex !== targetOrdinal) {
        reasons.push(reason(
          'RTK_COMMAND_ENVELOPE_TAMPERED',
          `localBaseline.sceneOrdinalAuthority.touchedParagraphs.${id || operation}`,
          'Scene ordinal authority touched records must correspond to the paired text revision paragraph index.',
          { operation, id, paragraphIndex: index, targetOrdinal },
        ));
      }
    }
  }
  for (const thread of list(reviewIr.commentThreads)) {
    const id = normalizeString(thread.threadId || thread.commentId);
    const index = commentParagraphIndex(thread);
    if (index === null) {
      reasons.push(reason(
        'RTK_COMMAND_ENVELOPE_TAMPERED',
        `reviewIr.commentThreads.${id || 'comment'}.paragraphIndex`,
        'Scene ordinal authority requires explicit paragraph indexes on anchored comment threads.',
      ));
      continue;
    }
    const touchedEntry = touchedByKey.get(touchedKey('commentThread', id));
    if (!touchedEntry || touchedEntry.rawReturnedParagraphIndex !== index || touchedEntry.documentParagraphIndex !== targetOrdinal) {
      reasons.push(reason(
        'RTK_COMMAND_ENVELOPE_TAMPERED',
        `localBaseline.sceneOrdinalAuthority.touchedParagraphs.${id || 'comment'}`,
        'Scene ordinal authority touched records must correspond to the anchored comment paragraph index.',
        { id, paragraphIndex: index, targetOrdinal },
      ));
    }
  }
  return {
    ok: reasons.length === 0,
    reasons,
    targetOrdinal,
    targetBlock,
  };
}

function candidateIdForGroup(group, cryptoPort) {
  if (group.kind === 'replacement-pair') {
    return cryptoPort.sha256Text(stableJson({
      groupId: group.groupId,
      operations: ['delete', 'insert'],
    }));
  }
  const revision = group.revisions[0] || {};
  return cryptoPort.sha256Text(stableJson({
    operation: revision.operation,
    id: revision.nativeRevisionId,
    textDigest: revision.textDigest,
  }));
}

function buildRevisionGroups(reviewIr, cryptoPort) {
  const reasons = [];
  const textRevisions = list(reviewIr.textRevisions);
  const seenRevisionIds = new Set();
  for (const revision of textRevisions) {
    const id = normalizeString(revision.nativeRevisionId);
    if (!id) {
      reasons.push(reason(
        'RTK_MANUAL_DEGRADED_LOCATOR',
        'reviewIr.textRevisions.nativeRevisionId',
        'Text revisions require native revision ids before block-local exact authority can be proven.',
      ));
      continue;
    }
    const operationId = `${normalizeString(revision.operation)}\n${id}`;
    if (seenRevisionIds.has(operationId)) {
      reasons.push(reason(
        'RTK_BLOCKED_DUPLICATE_TOKEN',
        `reviewIr.textRevisions.${id}`,
        'Duplicate native revision ids within the same operation cannot be granted exact authority.',
      ));
    }
    seenRevisionIds.add(operationId);
  }

  const grouped = new Map();
  const standalone = [];
  for (const revision of textRevisions) {
    const groupId = normalizeString(revision.replacementGroupId);
    if (!groupId) {
      standalone.push(revision);
      continue;
    }
    const group = grouped.get(groupId) || [];
    group.push(revision);
    grouped.set(groupId, group);
  }

  const groups = [];
  for (const [groupId, revisions] of grouped.entries()) {
    const deletes = revisions.filter((item) => item.operation === 'delete');
    const inserts = revisions.filter((item) => item.operation === 'insert');
    const supported = revisions.length === 2 && deletes.length === 1 && inserts.length === 1;
    const group = {
      kind: supported ? 'replacement-pair' : 'unsupported-group',
      groupId,
      revisions,
      sourceRevisionIds: revisions.map((item) => normalizeString(item.nativeRevisionId)).filter(Boolean),
      sourceRevisionRefs: revisions.map((item) => ({
        operation: normalizeString(item.operation),
        nativeRevisionId: normalizeString(item.nativeRevisionId),
      })).filter((item) => item.operation && item.nativeRevisionId),
      expectedText: rawString(deletes[0]?.text),
      replacementText: rawString(inserts[0]?.text),
      supported,
    };
    group.candidateId = candidateIdForGroup(group, cryptoPort);
    groups.push(group);
    if (!supported) {
      reasons.push(reason(
        'RTK_MANUAL_DEGRADED_LOCATOR',
        `reviewIr.textRevisions.${groupId}`,
        'Replacement groups must contain exactly one delete and one insert revision.',
      ));
    }
  }

  for (const revision of standalone) {
    const supported = revision.operation === 'delete';
    const group = {
      kind: supported ? 'delete' : 'unsupported-insert',
      groupId: '',
      revisions: [revision],
      sourceRevisionIds: [normalizeString(revision.nativeRevisionId)].filter(Boolean),
      expectedText: supported ? rawString(revision.text) : '',
      replacementText: '',
      supported,
    };
    group.candidateId = candidateIdForGroup(group, cryptoPort);
    groups.push(group);
    if (!supported) {
      reasons.push(reason(
        'RTK_MANUAL_DEGRADED_LOCATOR',
        `reviewIr.textRevisions.${normalizeString(revision.nativeRevisionId) || 'insert'}`,
        'Standalone insert revisions need a separately proven insertion anchor before exact authority.',
      ));
    }
  }

  return { groups, reasons };
}

function rangesOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}

function blockResult(reasons, details = {}) {
  const normalized = Array.isArray(reasons) ? reasons : [reasons];
  return {
    ok: false,
    schemaVersion: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA,
    profileId: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_PROFILE,
    status: 'blocked',
    code: normalized[0]?.code || 'RTK_WRITE_PRECONDITION_FAILED',
    reasons: normalized,
    canApply: false,
    canWriteManuscript: false,
    exactAuthority: {
      validSignedLocator: false,
      sceneRevisionUnchanged: false,
      rawSha256Unchanged: false,
      uniqueTarget: false,
      nonOverlapping: false,
      allRelevantXmlSemanticsAccounted: false,
      ambiguousDuplicate: false,
      crossScene: false,
      structuralTopologyChanged: false,
    },
    exactTextAnchors: [],
    summary: {
      exactEligibleTextGroups: 0,
      manualTextGroups: 0,
      blockedTextGroups: 0,
    },
    ...details,
  };
}

export function evaluateReviewTransportBlockExactAuthorityV2(input = {}, options = {}) {
  const cryptoState = resolveCryptoPort(options.cryptoPort);
  if (!cryptoState.ok) return blockResult(cryptoState.reasons);
  const cryptoPort = cryptoState.port;
  const reviewIr = reviewIrFrom(input);
  const authorityCarrier = authorityCarrierFrom(input);
  const payload = selectedPayload(authorityCarrier);
  const baseAuthority = exactAuthorityFrom(input);
  const localBaseline = localBaselineFrom(input);
  const localAuthorityKind = normalizeString(localBaseline.authorityKind);
  const targetBlockId = normalizeString(
    localAuthorityKind === 'main-owned-scene-export-map-ordinal-v1'
      ? localBaseline.blockId
      : (payload.blockId || localBaseline.blockId),
  );
  const targetSceneId = normalizeString(payload.sceneId || localBaseline.sceneId);
  const blocks = baselineBlocks(localBaseline, payload);
  const matchingBlocks = blocks.filter((block) => block.blockId === targetBlockId);
  const reasons = [];

  const localAuthorityKindTampered = localAuthorityKind && localAuthorityKind !== 'main-owned-scene-export-map-ordinal-v1';
  if (localAuthorityKindTampered) {
    reasons.push(reason(
      'RTK_BLOCKED_AUTHORITY_KIND_TAMPERED',
      'localBaseline.authorityKind',
      'Scene export-map ordinal authority kind is not the authenticated main-owned capsule kind.',
    ));
  }

  if (!baseAuthority.validSignedLocator) {
    reasons.push(reason(
      'RTK_MANUAL_DEGRADED_LOCATOR',
      'exactAuthority.validSignedLocator',
      'C03 requires a C02 verified signed locator before block-local exact authority.',
    ));
  }
  if (!baseAuthority.sceneRevisionUnchanged) {
    reasons.push(reason('RTK_BLOCKED_STALE_REVISION', 'exactAuthority.sceneRevisionUnchanged', 'Scene revision guard is stale.'));
  }
  if (!baseAuthority.rawSha256Unchanged) {
    reasons.push(reason('RTK_BLOCKED_STALE_BYTES', 'exactAuthority.rawSha256Unchanged', 'Raw text guard is stale.'));
  }
  if (!targetBlockId) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'authorityCarrier.payload.blockId', 'Signed block identity is required.'));
  }
  if (matchingBlocks.length === 0) {
    reasons.push(reason('RTK_MANUAL_DEGRADED_LOCATOR', 'localBaseline.blocks', 'Local baseline must contain the signed target block.'));
  }
  if (matchingBlocks.length > 1) {
    reasons.push(reason('RTK_BLOCKED_AMBIGUOUS_TEXT', 'localBaseline.blocks', 'Duplicate target block ids are ambiguous.'));
  }
  const targetBlock = matchingBlocks.length === 1 ? matchingBlocks[0] : null;
  const crossScene = targetBlock && targetSceneId && targetBlock.sceneId && targetBlock.sceneId !== targetSceneId;
  if (crossScene) {
    reasons.push(reason('RTK_BLOCKED_STRUCTURAL', 'localBaseline.sceneId', 'Signed scene identity does not match the local target block.'));
  }

  const structuralTopologyChanged =
    list(reviewIr.moveRevisions).length > 0
    || writerBlockingItems(reviewIr.structureChanges).length > 0;
  if (structuralTopologyChanged) {
    reasons.push(reason('RTK_BLOCKED_STRUCTURAL', 'reviewIr.structure', 'Move or structural changes are outside block-local exact text authority.'));
  }
  if (writerBlockingItems(reviewIr.opaqueUnsupported).length > 0) {
    reasons.push(reason('RTK_HOSTILE_PACKAGE_BLOCKED', 'reviewIr.opaqueUnsupported', 'Unknown OOXML semantics prevent exact authority.'));
  }

  const grouped = buildRevisionGroups(reviewIr, cryptoPort);
  reasons.push(...grouped.reasons);
  const exactTextAnchors = [];
  const ranges = [];
  // MATCH-01: uniqueTarget / ambiguousDuplicate are RECOMPUTED from the local
  // baseline + revision text via the placement-aware bijection
  // (recomputeAuthorityFromBijection). The caller-supplied booleans are
  // ignored for these two fields so a caller cannot force a unique-baseline
  // replacement pair into MANUAL_REVIEW by lying
  // (reviewTransportBlockExactAuthorityV2.mjs doctrine, M3).
  const mainOwnedOrdinalProof = localAuthorityKind === 'main-owned-scene-export-map-ordinal-v1'
    ? mainOwnedSceneOrdinalAuthorityProof(localBaseline, targetSceneId, targetBlockId, blocks, grouped.groups, reviewIr, cryptoPort)
    : null;
  if (mainOwnedOrdinalProof) reasons.push(...mainOwnedOrdinalProof.reasons);
  const recomputeAuthorityCarrier = localAuthorityKind === 'main-owned-scene-export-map-ordinal-v1'
    ? {
      ...cloneJsonSafe(authorityCarrier),
      selectedCarrier: {
        ...(isPlainObject(authorityCarrier.selectedCarrier) ? cloneJsonSafe(authorityCarrier.selectedCarrier) : {}),
        payload: {
          ...cloneJsonSafe(payload),
          blockId: targetBlockId,
        },
      },
    }
    : authorityCarrier;
  const recomputed = recomputeAuthorityFromBijection({
    localBaseline,
    authorityCarrier: recomputeAuthorityCarrier,
    reviewIr,
  });
  let ambiguousDuplicate = matchingBlocks.length > 1 || recomputed.ambiguousDuplicate;
  let uniqueTarget = recomputed.uniqueTarget && grouped.groups.length > 0 && Boolean(targetBlock);
  let allSupportedTextGroups = grouped.groups.length > 0;

  for (const group of grouped.groups) {
    if (!group.supported) {
      allSupportedTextGroups = false;
      uniqueTarget = false;
      continue;
    }
    const occurrences = occurrenceRanges(targetBlock?.text || '', group.expectedText);
    if (occurrences.length !== 1) {
      uniqueTarget = false;
      if (occurrences.length > 1) ambiguousDuplicate = true;
      reasons.push(reason(
        occurrences.length > 1 ? 'RTK_BLOCKED_AMBIGUOUS_TEXT' : 'RTK_MANUAL_DEGRADED_LOCATOR',
        `localBaseline.blocks.${targetBlockId}`,
        'Expected revision text must occur exactly once inside the signed target block.',
        {
          candidateId: group.candidateId,
          occurrenceCount: occurrences.length,
        },
      ));
      continue;
    }
    const range = {
      ...occurrences[0],
      candidateId: group.candidateId,
      kind: group.kind,
      sourceRevisionIds: group.sourceRevisionIds,
    };
    ranges.push(range);
    exactTextAnchors.push({
      candidateId: group.candidateId,
      kind: group.kind,
      blockId: targetBlockId,
      sceneId: targetSceneId,
      replacementGroupId: group.groupId,
      start: range.start,
      end: range.end,
      expectedTextDigest: cryptoPort.sha256Json({
        schemaVersion: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA,
        expectedText: group.expectedText,
      }),
      selectedTextDigest: cryptoPort.sha256Json({
        schemaVersion: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA,
        selectedText: group.expectedText,
      }),
      deletedTextDigest: cryptoPort.sha256Json({
        schemaVersion: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA,
        deletedText: group.expectedText,
      }),
      insertedTextDigest: cryptoPort.sha256Json({
        schemaVersion: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA,
        insertedText: group.replacementText,
      }),
      documentParagraphIndex: Number.isSafeInteger(targetBlock?.documentParagraphIndex)
        ? targetBlock.documentParagraphIndex
        : null,
      sourceRevisionIds: group.sourceRevisionIds,
      sourceRevisionRefs: group.sourceRevisionRefs,
    });
  }

  let nonOverlapping = ranges.length === grouped.groups.length && ranges.length > 0;
  const orderedRanges = ranges.slice().sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 0; index < orderedRanges.length - 1; index += 1) {
    if (rangesOverlap(orderedRanges[index], orderedRanges[index + 1])) {
      nonOverlapping = false;
      reasons.push(reason(
        'RTK_BLOCKED_TOKEN_CONTRADICTION',
        'reviewIr.textRevisions',
        'Block-local exact revision ranges must not overlap.',
        {
          leftCandidateId: orderedRanges[index].candidateId,
          rightCandidateId: orderedRanges[index + 1].candidateId,
        },
      ));
    }
  }

  const allRelevantXmlSemanticsAccounted =
    allSupportedTextGroups
    && !structuralTopologyChanged
    && writerBlockingItems(reviewIr.opaqueUnsupported).length === 0;

  if (ambiguousDuplicate) uniqueTarget = false;
  if (!allRelevantXmlSemanticsAccounted) nonOverlapping = false;
  if (localAuthorityKindTampered) {
    uniqueTarget = false;
    nonOverlapping = false;
  }
  if (mainOwnedOrdinalProof && !mainOwnedOrdinalProof.ok) {
    uniqueTarget = false;
    nonOverlapping = false;
  }
  if (!baseAuthority.validSignedLocator || !baseAuthority.sceneRevisionUnchanged || !baseAuthority.rawSha256Unchanged) {
    uniqueTarget = false;
    nonOverlapping = false;
  }
  if (crossScene) {
    uniqueTarget = false;
    nonOverlapping = false;
  }

  const exactAuthority = {
    validSignedLocator: baseAuthority.validSignedLocator,
    sceneRevisionUnchanged: baseAuthority.sceneRevisionUnchanged,
    rawSha256Unchanged: baseAuthority.rawSha256Unchanged,
    uniqueTarget,
    nonOverlapping,
    allRelevantXmlSemanticsAccounted,
    ambiguousDuplicate,
    crossScene: Boolean(crossScene || baseAuthority.crossScene),
    structuralTopologyChanged,
  };
  const ready = exactAuthority.validSignedLocator
    && exactAuthority.sceneRevisionUnchanged
    && exactAuthority.rawSha256Unchanged
    && exactAuthority.uniqueTarget
    && exactAuthority.nonOverlapping
    && exactAuthority.allRelevantXmlSemanticsAccounted
    && !exactAuthority.ambiguousDuplicate
    && !exactAuthority.crossScene
    && !exactAuthority.structuralTopologyChanged;
  const authorityUnsigned = {
    schemaVersion: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA,
    profileId: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_PROFILE,
    targetSceneId,
    targetBlockId,
    exactAuthority,
    exactTextAnchors,
  };
  return {
    ok: true,
    schemaVersion: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_SCHEMA,
    profileId: RTK_REVIEW_TRANSPORT_BLOCK_EXACT_AUTHORITY_V2_PROFILE,
    status: ready ? 'exact-authority-ready' : 'manual-or-blocked',
    code: ready ? 'RTK_EXACT_APPLICABLE' : (reasons[0]?.code || 'RTK_MANUAL_DEGRADED_LOCATOR'),
    reasons,
    canApply: false,
    canWriteManuscript: false,
    targetSceneId,
    targetBlockId,
    exactAuthority,
    exactTextAnchors,
    summary: {
      exactEligibleTextGroups: ready ? grouped.groups.length : 0,
      manualTextGroups: ready ? 0 : grouped.groups.length,
      blockedTextGroups: reasons.filter((item) => item.code && item.code.startsWith('RTK_BLOCKED')).length,
      commentThreadsPreserved: list(reviewIr.commentThreads).length,
      formattingDeltasPreserved: list(reviewIr.formattingDeltas).length,
    },
    authorityDigest: cryptoPort.sha256Json(authorityUnsigned),
    falseExactGuards: {
      globalTextSearchAuthority: false,
      fuzzyMatchAuthority: false,
      standaloneInsertExactAuthority: false,
      moveRevisionExactAuthority: false,
      parserWriteAuthority: false,
      blockAuthorityWriteAuthority: false,
    },
    baselineBlockDigest: targetBlock
      ? cryptoPort.sha256Json({
        blockId: targetBlock.blockId,
        sceneId: targetBlock.sceneId,
        text: targetBlock.text,
      })
      : '',
    authorityCarrier: cloneJsonSafe(authorityCarrier),
  };
}
