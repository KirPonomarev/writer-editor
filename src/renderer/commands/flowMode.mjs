import {
  composeDocumentContentFromBase,
  parseObservablePayload,
} from '../documentContentEnvelope.mjs';

function normalizeLineEndings(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function escapeTitle(title) {
  return String(title ?? '').replaceAll('\n', ' ').trim();
}

function normalizeSceneCount(sceneCount) {
  if (!Number.isInteger(sceneCount) || sceneCount < 0) return 0;
  return sceneCount;
}

function normalizeStableId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaselineHash(value) {
  const hash = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-f0-9]{64}$/u.test(hash) ? hash : '';
}

function normalizeFlowProjectionScene(scene, index) {
  const source = scene && typeof scene === 'object' && !Array.isArray(scene) ? scene : {};
  const sceneId = normalizeStableId(source.sceneId) || normalizeStableId(source.nodeId) || `flow-scene-${index + 1}`;
  const nodeId = normalizeStableId(source.nodeId);
  const baselineHash = normalizeBaselineHash(source.baselineHash);
  const title = typeof source.title === 'string' ? source.title : '';
  const kind = typeof source.kind === 'string' && source.kind ? source.kind : 'scene';
  const parsed = parseObservablePayload(typeof source.content === 'string' ? source.content : '');
  const missing = source.missing === true;
  return {
    sceneId,
    nodeId,
    baselineHash,
    title: escapeTitle(title) || 'Untitled',
    kind,
    order: index,
    missing,
    partial: missing || source.partial === true,
    text: missing ? '' : normalizeLineEndings(parsed.text || '').trimEnd(),
  };
}

export function normalizeFlowReadProjectionScenes(scenes = []) {
  const normalizedScenes = Array.isArray(scenes) ? scenes : [];
  return normalizedScenes.map(normalizeFlowProjectionScene);
}

export function sceneMarker(index, title) {
  return `---[ SCENE ${index}: ${escapeTitle(title) || 'Untitled'} ]---`;
}

export function composeFlowDocument(scenes = []) {
  const normalizedScenes = Array.isArray(scenes) ? scenes : [];
  const lines = [];
  for (let i = 0; i < normalizedScenes.length; i += 1) {
    const scene = normalizedScenes[i] && typeof normalizedScenes[i] === 'object' ? normalizedScenes[i] : {};
    lines.push(sceneMarker(i + 1, scene.title));
    const parsed = parseObservablePayload(scene.content || '');
    lines.push(normalizeLineEndings(parsed.text || '').trimEnd());
    if (i < normalizedScenes.length - 1) lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function composeFlowReadProjection(scenes = []) {
  const normalizedScenes = normalizeFlowReadProjectionScenes(scenes);
  const lines = [];
  const boundaries = [];
  let cursor = 0;

  normalizedScenes.forEach((scene, index) => {
    if (index > 0) {
      lines.push('');
      cursor += 1;
    }

    const heading = scene.title;
    const content = scene.missing ? '[missing source scene]' : scene.text;
    const block = [heading, '', content].join('\n').trimEnd();
    const start = cursor;
    lines.push(block);
    cursor += block.length;
    const headingPrefix = `${heading}\n\n`;
    boundaries.push({
      sceneId: scene.sceneId,
      nodeId: scene.nodeId,
      baselineHash: scene.baselineHash,
      title: scene.title,
      kind: scene.kind,
      order: scene.order,
      missing: scene.missing,
      start,
      contentStart: start + headingPrefix.length,
      contentEnd: cursor,
      end: cursor,
    });
    if (index < normalizedScenes.length - 1) cursor += 1;
  });

  const text = `${lines.join('\n').trimEnd()}\n`;
  return {
    ok: true,
    text,
    scenes: normalizedScenes.map((scene) => ({
      sceneId: scene.sceneId,
      nodeId: scene.nodeId,
      baselineHash: scene.baselineHash,
      title: scene.title,
      kind: scene.kind,
      order: scene.order,
      missing: scene.missing,
      partial: scene.partial,
    })),
    boundaries,
    partial: normalizedScenes.some((scene) => scene.partial),
    missingSceneIds: normalizedScenes.filter((scene) => scene.missing).map((scene) => scene.sceneId),
  };
}

export function findFlowProjectionSceneAtOffset(projection, offset) {
  const source = projection && typeof projection === 'object' && !Array.isArray(projection) ? projection : {};
  const boundaries = Array.isArray(source.boundaries) ? source.boundaries : [];
  if (!boundaries.length) return null;
  const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
  const match = boundaries.find((boundary) => safeOffset >= boundary.start && safeOffset <= boundary.end)
    || boundaries.find((boundary) => safeOffset < boundary.start)
    || boundaries[boundaries.length - 1];
  if (!match) return null;
  return {
    sceneId: normalizeStableId(match.sceneId),
    nodeId: normalizeStableId(match.nodeId),
    baselineHash: normalizeBaselineHash(match.baselineHash),
    title: typeof match.title === 'string' ? match.title : '',
    kind: typeof match.kind === 'string' ? match.kind : 'scene',
    order: Number.isInteger(match.order) ? match.order : 0,
    missing: match.missing === true,
  };
}

export function buildFlowModeStatus(kind, sceneCount) {
  const count = normalizeSceneCount(sceneCount);
  const label = kind === 'save' ? 'saved' : 'opened';
  return `Flow mode ${label} (${count}) · Shift+S save · ArrowUp/ArrowDown jump scenes`;
}

export function buildFlowModeKickoffStatus(kind, sceneCount, options = {}) {
  const base = buildFlowModeStatus(kind, sceneCount);
  if (!options || options.m8Kickoff !== true) return base;
  return `${base} · M8 kickoff`;
}

export function buildFlowModeCoreStatus(sceneCount, options = {}) {
  const count = normalizeSceneCount(sceneCount);
  const dirty = options && options.dirty === true;
  return dirty
    ? `Flow mode core (${count}) · unsaved changes · Shift+S save`
    : `Flow mode core (${count}) · synced`;
}

export function buildFlowModeReopenBlockedStatus(sceneCount) {
  const count = normalizeSceneCount(sceneCount);
  return `Flow mode core (${count}) · unsaved changes blocked reopen · Shift+S save`;
}

export function buildFlowModeM9KickoffStatus(kind, sceneCount, options = {}) {
  const base = buildFlowModeKickoffStatus(kind, sceneCount, options);
  if (!options || options.m9Kickoff !== true) return base;
  return `${base} · M9 kickoff`;
}

export function buildFlowModeM9CoreSaveErrorStatus(error, sceneCount) {
  const count = normalizeSceneCount(sceneCount);
  const reason = error && typeof error === 'object' && !Array.isArray(error)
    ? String(error.reason || '')
    : '';

  if (reason === 'flow_marker_count_mismatch') {
    return `Flow mode core (${count}) · save blocked: marker count mismatch · reopen flow mode`;
  }
  if (reason === 'flow_marker_sequence_invalid') {
    return `Flow mode core (${count}) · save blocked: marker sequence invalid · reopen flow mode`;
  }
  if (reason === 'flow_scene_path_missing') {
    return `Flow mode core (${count}) · save blocked: scene path missing · reopen flow mode`;
  }
  if (reason === 'flow_scene_id_missing') {
    return `Flow mode core (${count}) · save blocked: scene id missing · reopen flow mode`;
  }
  if (reason === 'flow_scene_baseline_hash_missing') {
    return `Flow mode core (${count}) · save blocked: baseline hash missing · reopen flow mode`;
  }
  if (reason === 'flow_scene_missing') {
    return `Flow mode core (${count}) · save blocked: source scene missing · reopen flow mode`;
  }
  if (reason === 'flow_boundary_damaged') {
    return `Flow mode core (${count}) · save blocked: scene boundary changed · reopen flow mode`;
  }
  if (reason === 'flow_boundary_ambiguous') {
    return `Flow mode core (${count}) · save blocked: scene boundary ambiguous · reopen flow mode`;
  }
  if (reason === 'flow_stale_source') {
    return `Flow mode core (${count}) · save blocked: source changed · reopen flow mode`;
  }
  if (reason === 'flow_scene_rich_content_unsupported') {
    return `Flow mode core (${count}) · save blocked: rich scene content unsupported · reopen flow mode`;
  }
  return `Flow mode core (${count}) · save blocked: invalid flow payload · reopen flow mode`;
}

export function buildFlowModeM9NextNoopSaveStatus(sceneCount) {
  const count = normalizeSceneCount(sceneCount);
  return `Flow mode core (${count}) · no changes to save · edit and press Shift+S`;
}

function parseSceneMarker(line) {
  const match = /^---\[ SCENE (\d+): .* \]---$/.exec(String(line || '').trim());
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  if (!Number.isInteger(index) || index <= 0) return null;
  return { index };
}

function splitFlowScenes(flowText, expectedCount) {
  const text = normalizeLineEndings(flowText);
  const lines = text.split('\n');
  const markers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseSceneMarker(lines[i]);
    if (parsed) markers.push({ markerIndex: parsed.index, line: i });
  }

  if (markers.length !== expectedCount) {
    return {
      ok: false,
      code: 'M7_FLOW_MARKER_COUNT_MISMATCH',
      reason: 'flow_marker_count_mismatch',
      details: { expectedCount, foundCount: markers.length },
    };
  }

  const scenes = [];
  for (let i = 0; i < markers.length; i += 1) {
    if (markers[i].markerIndex !== i + 1) {
      return {
        ok: false,
        code: 'M7_FLOW_MARKER_SEQUENCE_INVALID',
        reason: 'flow_marker_sequence_invalid',
        details: { expected: i + 1, found: markers[i].markerIndex },
      };
    }
    const contentStart = markers[i].line + 1;
    const contentEnd = i + 1 < markers.length ? markers[i + 1].line : lines.length;
    const content = lines.slice(contentStart, contentEnd).join('\n').replace(/\n+$/u, '');
    scenes.push(content);
  }

  return { ok: true, scenes };
}

function failProjectionSave(code, reason, details = {}) {
  return { ok: false, error: { code, reason, details } };
}

function findUniqueBoundaryIndex(text, needle, fromIndex) {
  const first = text.indexOf(needle, fromIndex);
  if (first < 0) return { ok: false, reason: 'missing' };
  const second = text.indexOf(needle, first + needle.length);
  if (second >= 0) return { ok: false, reason: 'ambiguous' };
  return { ok: true, index: first };
}

function splitFlowProjectionScenes(flowText, sceneRefs = []) {
  const text = normalizeLineEndings(flowText).replace(/\n$/u, '');
  const refs = Array.isArray(sceneRefs) ? sceneRefs : [];
  const scenes = [];
  let cursor = 0;

  for (let index = 0; index < refs.length; index += 1) {
    const ref = refs[index] && typeof refs[index] === 'object' ? refs[index] : {};
    const title = escapeTitle(ref.title) || 'Untitled';
    const heading = `${title}\n\n`;
    if (text.slice(cursor, cursor + heading.length) !== heading) {
      return failProjectionSave(
        'M15_FLOW_BOUNDARY_DAMAGED',
        'flow_boundary_damaged',
        { sceneId: normalizeStableId(ref.sceneId), index },
      );
    }
    const contentStart = cursor + heading.length;
    let contentEnd = text.length;

    if (index < refs.length - 1) {
      const nextTitle = escapeTitle(refs[index + 1]?.title) || 'Untitled';
      const nextNeedle = `\n\n${nextTitle}\n\n`;
      const found = findUniqueBoundaryIndex(text, nextNeedle, contentStart);
      if (!found.ok) {
        return failProjectionSave(
          found.reason === 'ambiguous' ? 'M15_FLOW_BOUNDARY_AMBIGUOUS' : 'M15_FLOW_BOUNDARY_DAMAGED',
          found.reason === 'ambiguous' ? 'flow_boundary_ambiguous' : 'flow_boundary_damaged',
          { sceneId: normalizeStableId(ref.sceneId), nextSceneId: normalizeStableId(refs[index + 1]?.sceneId), index },
        );
      }
      contentEnd = found.index;
      cursor = found.index + 2;
    }

    scenes.push(text.slice(contentStart, contentEnd).replace(/\n+$/u, ''));
  }

  return { ok: true, scenes };
}

export function buildFlowProjectionSavePayload(flowText, sceneRefs = []) {
  const refs = Array.isArray(sceneRefs) ? sceneRefs : [];
  const invalidRef = refs.find((ref) => !ref || typeof ref !== 'object' || Array.isArray(ref));
  if (invalidRef) {
    return failProjectionSave('M15_FLOW_INVALID_SCENE_ITEM', 'flow_scene_invalid');
  }
  if (refs.some((ref) => !normalizeStableId(ref.sceneId))) {
    return failProjectionSave('M15_FLOW_SCENE_ID_MISSING', 'flow_scene_id_missing');
  }
  if (refs.some((ref) => !normalizeBaselineHash(ref.baselineHash))) {
    return failProjectionSave('M15_FLOW_SCENE_BASELINE_HASH_MISSING', 'flow_scene_baseline_hash_missing');
  }
  if (refs.some((ref) => ref.missing === true || ref.partial === true)) {
    return failProjectionSave('M15_FLOW_SCENE_MISSING', 'flow_scene_missing');
  }

  const split = splitFlowProjectionScenes(flowText, refs);
  if (!split.ok) return split;

  const scenes = refs.map((ref, idx) => {
    const nextContent = composeDocumentContentFromBase({
      baseContent: String(ref && ref.content ? ref.content : ''),
      nextVisibleText: split.scenes[idx],
    });
    if (!nextContent.ok) {
      return {
        path: String(ref && ref.path ? ref.path : ''),
        sceneId: normalizeStableId(ref.sceneId),
        nodeId: normalizeStableId(ref.nodeId),
        baselineHash: normalizeBaselineHash(ref.baselineHash),
        title: String(ref && ref.title ? ref.title : ''),
        kind: String(ref && ref.kind ? ref.kind : 'scene'),
        error: nextContent.error,
      };
    }

    return {
      path: String(ref && ref.path ? ref.path : ''),
      sceneId: normalizeStableId(ref.sceneId),
      nodeId: normalizeStableId(ref.nodeId),
      baselineHash: normalizeBaselineHash(ref.baselineHash),
      title: String(ref && ref.title ? ref.title : ''),
      kind: String(ref && ref.kind ? ref.kind : 'scene'),
      content: nextContent.content,
    };
  });

  if (scenes.some((scene) => scene.path.length === 0)) {
    return failProjectionSave('M7_FLOW_SCENE_PATH_MISSING', 'flow_scene_path_missing');
  }

  const invalidScene = scenes.find((scene) => scene.error);
  if (invalidScene) {
    return { ok: false, error: invalidScene.error };
  }

  return { ok: true, scenes };
}

export function buildFlowSavePayload(flowText, sceneRefs = []) {
  const refs = Array.isArray(sceneRefs) ? sceneRefs : [];
  const split = splitFlowScenes(flowText, refs.length);
  if (!split.ok) {
    return { ok: false, error: { code: split.code, reason: split.reason, details: split.details } };
  }

  const scenes = refs.map((ref, idx) => {
    const nextContent = composeDocumentContentFromBase({
      baseContent: String(ref && ref.content ? ref.content : ''),
      nextVisibleText: split.scenes[idx],
    });
    if (!nextContent.ok) {
      return {
        path: String(ref && ref.path ? ref.path : ''),
        title: String(ref && ref.title ? ref.title : ''),
        kind: String(ref && ref.kind ? ref.kind : 'scene'),
        error: nextContent.error,
      };
    }

    return {
      path: String(ref && ref.path ? ref.path : ''),
      title: String(ref && ref.title ? ref.title : ''),
      kind: String(ref && ref.kind ? ref.kind : 'scene'),
      content: nextContent.content,
    };
  });

  if (scenes.some((scene) => scene.path.length === 0)) {
    return {
      ok: false,
      error: {
        code: 'M7_FLOW_SCENE_PATH_MISSING',
        reason: 'flow_scene_path_missing',
      },
    };
  }

  const invalidScene = scenes.find((scene) => scene.error);
  if (invalidScene) {
    return {
      ok: false,
      error: invalidScene.error,
    };
  }

  return { ok: true, scenes };
}

function sceneContentRanges(flowText) {
  const text = normalizeLineEndings(flowText);
  const markerRegex = /^---\[ SCENE (\d+): .* \]---$/gmu;
  const markers = [];
  let match = markerRegex.exec(text);
  while (match) {
    markers.push({
      markerOffset: match.index,
      markerLength: match[0].length,
    });
    match = markerRegex.exec(text);
  }
  if (!markers.length) return [];

  const ranges = [];
  for (let i = 0; i < markers.length; i += 1) {
    const markerEnd = markers[i].markerOffset + markers[i].markerLength;
    let start = markerEnd;
    if (text[start] === '\n') start += 1;
    const end = i + 1 < markers.length ? Math.max(start, markers[i + 1].markerOffset - 1) : text.length;
    ranges.push({ start, end });
  }
  return ranges;
}

export function nextSceneCaretAtBoundary(flowText, caret) {
  const ranges = sceneContentRanges(flowText);
  if (!ranges.length) return null;
  for (let i = 0; i < ranges.length - 1; i += 1) {
    if (caret >= ranges[i].end) {
      return ranges[i + 1].start;
    }
  }
  return null;
}

export function previousSceneCaretAtBoundary(flowText, caret) {
  const ranges = sceneContentRanges(flowText);
  if (!ranges.length) return null;
  for (let i = 1; i < ranges.length; i += 1) {
    if (caret <= ranges[i].start) {
      return ranges[i - 1].end;
    }
  }
  return null;
}
