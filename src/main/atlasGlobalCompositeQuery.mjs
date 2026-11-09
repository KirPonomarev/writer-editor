import {
  createAtlasGlobalCompositeGraphJob,
  runAtlasGlobalCompositeGraphJob,
  acceptAtlasGlobalCompositeGraphResult,
} from '../derived/atlas/scheduleAtlasGlobalCompositeGraph.mjs';
import { deriveAtlasGlobalCompositeGraphNavigationPacket } from '../derived/atlas/deriveAtlasGlobalCompositeGraphNavigation.mjs';
import { buildAtlasGlobalCompositeGraphLodPlan } from '../derived/atlas/atlasGlobalCompositeGraphLayoutPlanner.mjs';

const FIELDS = new Set(['projectId', 'explicitOpen', 'projection', 'trust', 'offset', 'selectedNodeId']);
const PROJECTIONS = Object.freeze({ all: null, atlas: ['atlas.localGraph', 'atlas.temporalContinuity'],
  plot: ['plot.projection'], idea: ['idea.projection'], meaning: ['meaning.projection'],
  map: ['manualMap.graph'], source: ['crossProjection.impactPreview'] });
const TRUST = ['ALL', 'AUTHOR_CONFIRMED', 'ALGORITHMIC_OBSERVATION', 'UNKNOWN'];
const PAGE = 24;
const denied = code => ({ ok: false, error: { code } });

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(payload))) return null;
  const keys = Reflect.ownKeys(payload);
  if (keys.some(key => !FIELDS.has(key))) return null;
  const safe = {};
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(payload, key);
    if (!field?.enumerable || !Object.hasOwn(field, 'value')) return null;
    safe[key] = field.value;
  }
  if (typeof safe.projectId !== 'string' || !/^[A-Za-z0-9:_-]{1,200}$/u.test(safe.projectId)
    || ['__proto__', 'prototype', 'constructor'].includes(safe.projectId) || safe.explicitOpen !== true) return null;
  const projection = Object.hasOwn(safe, 'projection') ? safe.projection : 'all';
  const trust = Object.hasOwn(safe, 'trust') ? safe.trust : 'ALL';
  const offset = Object.hasOwn(safe, 'offset') ? safe.offset : 0;
  const selectedNodeId = Object.hasOwn(safe, 'selectedNodeId') ? safe.selectedNodeId : '';
  if (typeof projection !== 'string' || !Object.hasOwn(PROJECTIONS, projection) || !TRUST.includes(trust)
    || !Number.isSafeInteger(offset) || offset < 0 || offset > 50_000
    || typeof selectedNodeId !== 'string' || selectedNodeId.length > 512
    || (selectedNodeId && !/^[A-Za-z0-9:_-]+$/u.test(selectedNodeId))) return null;
  return { projectId: safe.projectId, explicitOpen: true, projection, trust, offset, selectedNodeId };
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}

function surface(graph, safe, sourceRevision) {
  const navigation = deriveAtlasGlobalCompositeGraphNavigationPacket({ graph,
    trustFilter: { allowedTrustStates: safe.trust === 'ALL' ? TRUST.slice(1) : [safe.trust], includeUnknown: safe.trust === 'ALL' },
  });
  const families = PROJECTIONS[safe.projection];
  const nodes = navigation.nodes.filter(node => !families || families.includes(node.sourceProjection));
  const ids = new Set(nodes.map(node => node.nodeId));
  const nodeById = new Map(nodes.map(node => [node.nodeId, node]));
  const ordinalById = new Map(nodes.map((node, index) => [node.nodeId, index]));
  const edges = navigation.edges.filter(edge => ids.has(edge.fromNodeId) && ids.has(edge.toNodeId));
  const edgeIds = new Set(edges.map(edge => edge.edgeId));
  const offset = nodes.length ? Math.min(safe.offset, Math.floor((nodes.length - 1) / PAGE) * PAGE) : 0;
  const rows = nodes.slice(offset, offset + PAGE);
  const selected = nodes.find(node => node.nodeId === safe.selectedNodeId) || null;
  const incident = selected ? edges.filter(edge => edge.fromNodeId === selected.nodeId || edge.toNodeId === selected.nodeId) : [];
  // Plan the unfiltered source once. Filtering never moves its retained nodes.
  const fullPlan = buildAtlasGlobalCompositeGraphLodPlan({ graph,
    limits: { maxNodes: 120, maxEdges: 240, labelNodeBudget: 24 } });
  const visibleNodes = fullPlan.nodes.filter(node => ids.has(node.nodeId)).map(node => ({ ...node,
    sourceProjection: nodeById.get(node.nodeId).sourceProjection,
    trustState: nodeById.get(node.nodeId).trustState,
    listOffset: Math.floor(ordinalById.get(node.nodeId) / PAGE) * PAGE,
  }));
  const visibleIds = new Set(visibleNodes.map(node => node.nodeId));
  const visibleEdges = fullPlan.edges.filter(edge => visibleIds.has(edge.fromNodeId) && visibleIds.has(edge.toNodeId)
    && edgeIds.has(edge.edgeId));
  const refs = new Set([...rows, ...nodes.filter(node => visibleIds.has(node.nodeId)), ...(selected ? [selected] : [])]
    .flatMap(node => node.sourceRefIds || []));
  const sourceRefs = graph.sourceRefs.length <= 160 ? graph.sourceRefs : graph.sourceRefs.filter(ref => refs.has(ref.sourceRefId));
  const selectedRefs = selected ? sourceRefs.filter(ref => selected.sourceRefIds.includes(ref.sourceRefId)) : [];
  return freeze({
    schemaVersion: 'atlas.globalCompositeSurface.v1', state: nodes.length ? 'ready' : 'empty',
    projectId: graph.projectId, sourceRevision, compositeHash: graph.meta.compositeHash,
    projection: safe.projection, trust: safe.trust,
    sourceRefs,
    summary: { sourceNodeCount: graph.nodes.length, sourceEdgeCount: graph.edges.length,
      sourceProjectionCount: graph.sourceRefs.length, filteredNodeCount: nodes.length, filteredEdgeCount: edges.length,
      omittedGraphNodes: nodes.length - visibleNodes.length, omittedGraphEdges: edges.length - visibleEdges.length,
      omittedSourceRefs: graph.sourceRefs.length - sourceRefs.length },
    graph: { nodes: visibleNodes, edges: visibleEdges },
    list: { offset, total: nodes.length, pageSize: PAGE, hasMore: offset + rows.length < nodes.length, rows },
    selection: selected ? { node: selected, sourceRefs: selectedRefs, edges: incident.slice(0, PAGE).map(edge => ({ ...edge,
      fromLabel: nodeById.get(edge.fromNodeId).label, toLabel: nodeById.get(edge.toNodeId).label,
    })),
      edgeTotal: incident.length } : null,
    authority: { readModelOnly: true, sourceProjectionWriteBack: false, projectTruthMutation: false,
      manuscriptMutation: false, storageMutation: false, persistentDerivedTruth: false,
      commandAuthority: 'none', sourceNavigation: 'explicit-existing-source-surface-intent-only' },
  });
}

export function createAtlasGlobalCompositeQuery({ canRead, captureContext, isContextCurrent, readCoreState, schedule }) {
  if ([canRead, captureContext, isContextCurrent, readCoreState, schedule].some(fn => typeof fn !== 'function')) {
    throw new TypeError('ATLAS_COMPOSITE_OWNER_CONTRACT_REQUIRED');
  }
  let sequence = 0;
  return async payload => {
    const safe = validatePayload(payload);
    if (!safe) return denied('E_ATLAS_COMPOSITE_PAYLOAD_INVALID');
    if (!canRead()) return denied('E_ATLAS_COMPOSITE_CAPABILITY_DISABLED');
    const context = captureContext(), generation = ++sequence;
    const current = () => generation === sequence && canRead() && isContextCurrent(context);
    if (!current()) return denied('E_ATLAS_COMPOSITE_CONTEXT_STALE');
    try {
      const result = await schedule(safe, async () => {
        if (!current()) return denied('E_ATLAS_COMPOSITE_CONTEXT_STALE');
        const source = await readCoreState();
        if (!current()) return denied('E_ATLAS_COMPOSITE_CONTEXT_STALE');
        if (source.projectId !== safe.projectId) return denied('E_ATLAS_COMPOSITE_PROJECT_MISMATCH');
        const created = createAtlasGlobalCompositeGraphJob({ coreState: source.coreState, projectId: source.projectId,
          triggerMode: 'explicitOpen', sequence: generation,
          capabilitySnapshot: { capabilities: { atlasGlobalCompositeGraph: true, atlasMentionIndex: true,
            atlasLocalGraph: true, atlasTemporalContinuity: true, plotProjection: true, ideaProjection: true,
            meaningProjection: true, crossProjectionImpactPreview: true, manualMapView: true } },
        });
        if (!created.ok) return created;
        const calculated = runAtlasGlobalCompositeGraphJob(created.value);
        if (!calculated.ok) return calculated;
        const accepted = acceptAtlasGlobalCompositeGraphResult({ activeJob: created.value, result: calculated.value,
          currentCoreState: source.coreState });
        if (!accepted.ok) return accepted;
        if (!current()) return denied('E_ATLAS_COMPOSITE_CONTEXT_STALE');
        return { ok: true, atlasGlobalCompositeGraph: surface(calculated.value.compositeGraph, safe, created.value.sourceRevision) };
      });
      return current() ? result : denied('E_ATLAS_COMPOSITE_CONTEXT_STALE');
    } catch (error) {
      return denied(typeof error?.code === 'string' ? error.code : 'E_ATLAS_COMPOSITE_READ_FAILED');
    }
  };
}
