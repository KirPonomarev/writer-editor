import { MINDMAP_EDGE_KIND, MINDMAP_NODE_KIND, sortMindMapEdges, sortMindMapNodes } from '../../../derived/mindmap/index.mjs';
import { appendLoss, createLossReport, finalizeLossReport } from './lossReport.mjs';

export const MINDMAP_EXPORT_SCHEMA_VERSION = 'mindmap.export.json.v1';
export const MINDMAP_EXPORT_FORMAT = 'mindmap-json';
export const MINDMAP_EXPORT_SOURCE_SCHEMA_VERSION = 'derived.mindmap.graph.v1';

export const MINDMAP_EXPORT_LOSS_REASON_CODES = Object.freeze({
  INVALID_GRAPH_SHAPE_DOWNGRADED: 'MMV1_INVALID_GRAPH_SHAPE_DOWNGRADED',
  INVALID_NODE_SHAPE_DROPPED: 'MMV1_INVALID_NODE_SHAPE_DROPPED',
  NODE_ID_NORMALIZED: 'MMV1_NODE_ID_NORMALIZED',
  NODE_LABEL_NORMALIZED: 'MMV1_NODE_LABEL_NORMALIZED',
  UNKNOWN_NODE_KIND_DOWNGRADED: 'MMV1_UNKNOWN_NODE_KIND_DOWNGRADED',
  NODE_DEPTH_NORMALIZED: 'MMV1_NODE_DEPTH_NORMALIZED',
  DUPLICATE_NODE_ID_REWRITTEN: 'MMV1_DUPLICATE_NODE_ID_REWRITTEN',
  INVALID_EDGE_SHAPE_DROPPED: 'MMV1_INVALID_EDGE_SHAPE_DROPPED',
  EDGE_ENDPOINT_MISSING_DROPPED: 'MMV1_EDGE_ENDPOINT_MISSING_DROPPED',
  EDGE_ENDPOINT_UNKNOWN_DROPPED: 'MMV1_EDGE_ENDPOINT_UNKNOWN_DROPPED',
  EDGE_KIND_DOWNGRADED: 'MMV1_EDGE_KIND_DOWNGRADED',
});

const KNOWN_NODE_KINDS = new Set([
  MINDMAP_NODE_KIND.PROJECT,
  MINDMAP_NODE_KIND.SCENE,
  MINDMAP_NODE_KIND.HEADING,
]);

const KNOWN_EDGE_KINDS = new Set([
  MINDMAP_EDGE_KIND.CONTAINS,
]);

function normalizeText(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim();
}

function appendExportLoss(report, reasonCode, path, note, evidence, kind = 'EXPORT_DOWNGRADE') {
  appendLoss(report, {
    kind,
    reasonCode,
    path,
    note,
    evidence,
  });
}

function nodePath(index) {
  return `node:${index + 1}`;
}

function edgePath(index) {
  return `edge:${index + 1}`;
}

function normalizeNodeKind(value, path, report) {
  const kind = normalizeText(value).toLowerCase();
  if (KNOWN_NODE_KINDS.has(kind)) return kind;
  appendExportLoss(
    report,
    MINDMAP_EXPORT_LOSS_REASON_CODES.UNKNOWN_NODE_KIND_DOWNGRADED,
    path,
    'Unknown mindmap node kind downgraded to "unknown".',
    String(value ?? ''),
  );
  return 'unknown';
}

function normalizeNodeDepth(value, path, report) {
  if (Number.isInteger(value) && value >= 0) return value;
  appendExportLoss(
    report,
    MINDMAP_EXPORT_LOSS_REASON_CODES.NODE_DEPTH_NORMALIZED,
    path,
    'Node depth normalized to safe integer.',
    String(value ?? ''),
  );
  return 0;
}

function normalizeNode(rawNode, index, usedIds, report) {
  if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.INVALID_NODE_SHAPE_DROPPED,
      nodePath(index),
      'Invalid node shape dropped.',
      String(rawNode),
      'EXPORT_DROP',
    );
    return null;
  }

  const path = nodePath(index);
  let id = normalizeText(rawNode.id);
  if (!id) {
    id = `node:${index + 1}`;
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.NODE_ID_NORMALIZED,
      path,
      'Node id was missing and was normalized.',
      String(rawNode.id ?? ''),
    );
  }

  if (usedIds.has(id)) {
    const next = `${id}#${index + 1}`;
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.DUPLICATE_NODE_ID_REWRITTEN,
      path,
      'Duplicate node id rewritten to deterministic suffix.',
      id,
    );
    id = next;
  }
  usedIds.add(id);

  let label = normalizeText(rawNode.label);
  if (!label) {
    label = id;
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.NODE_LABEL_NORMALIZED,
      path,
      'Node label was empty and normalized from node id.',
      String(rawNode.label ?? ''),
    );
  }

  const kind = normalizeNodeKind(rawNode.kind, path, report);
  const depth = normalizeNodeDepth(rawNode.depth, path, report);
  const parentId = normalizeText(rawNode.parentId);

  const out = { id, label, kind, depth };
  if (parentId) out.parentId = parentId;
  return out;
}

function normalizeEdgeKind(value, path, report) {
  const kind = normalizeText(value).toLowerCase();
  if (KNOWN_EDGE_KINDS.has(kind)) return kind;
  appendExportLoss(
    report,
    MINDMAP_EXPORT_LOSS_REASON_CODES.EDGE_KIND_DOWNGRADED,
    path,
    'Unknown edge kind downgraded to "contains".',
    String(value ?? ''),
  );
  return MINDMAP_EDGE_KIND.CONTAINS;
}

function normalizeEdge(rawEdge, index, validNodeIds, report) {
  if (!rawEdge || typeof rawEdge !== 'object' || Array.isArray(rawEdge)) {
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.INVALID_EDGE_SHAPE_DROPPED,
      edgePath(index),
      'Invalid edge shape dropped.',
      String(rawEdge),
      'EXPORT_DROP',
    );
    return null;
  }

  const path = edgePath(index);
  const from = normalizeText(rawEdge.from);
  const to = normalizeText(rawEdge.to);
  if (!from || !to) {
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.EDGE_ENDPOINT_MISSING_DROPPED,
      path,
      'Edge endpoints are required.',
      JSON.stringify({ from: rawEdge.from, to: rawEdge.to }),
      'EXPORT_DROP',
    );
    return null;
  }

  if (!validNodeIds.has(from) || !validNodeIds.has(to)) {
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.EDGE_ENDPOINT_UNKNOWN_DROPPED,
      path,
      'Edge references unknown node ids and was dropped.',
      JSON.stringify({ from, to }),
      'EXPORT_DROP',
    );
    return null;
  }

  const kind = normalizeEdgeKind(rawEdge.kind, path, report);
  return { from, to, kind };
}

function normalizeGraph(graph, report) {
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    appendExportLoss(
      report,
      MINDMAP_EXPORT_LOSS_REASON_CODES.INVALID_GRAPH_SHAPE_DOWNGRADED,
      'graph',
      'Invalid graph shape downgraded to empty graph.',
      String(graph),
    );
    return {
      sourceSchemaVersion: MINDMAP_EXPORT_SOURCE_SCHEMA_VERSION,
      nodes: [],
      edges: [],
    };
  }

  const sourceSchemaVersion = normalizeText(graph.schemaVersion) || MINDMAP_EXPORT_SOURCE_SCHEMA_VERSION;
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const usedIds = new Set();
  const nodes = [];
  for (let index = 0; index < rawNodes.length; index += 1) {
    const node = normalizeNode(rawNodes[index], index, usedIds, report);
    if (node) nodes.push(node);
  }

  const validNodeIds = new Set(nodes.map((node) => node.id));
  const edges = [];
  for (let index = 0; index < rawEdges.length; index += 1) {
    const edge = normalizeEdge(rawEdges[index], index, validNodeIds, report);
    if (edge) edges.push(edge);
  }

  return {
    sourceSchemaVersion,
    nodes: sortMindMapNodes(nodes),
    edges: sortMindMapEdges(edges),
  };
}

export function serializeMindMapExportJsonV1WithLossReport(graph) {
  const lossReport = createLossReport();
  const normalized = normalizeGraph(graph, lossReport);
  const payload = {
    schemaVersion: MINDMAP_EXPORT_SCHEMA_VERSION,
    format: MINDMAP_EXPORT_FORMAT,
    sourceSchemaVersion: normalized.sourceSchemaVersion,
    nodes: normalized.nodes,
    edges: normalized.edges,
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  return {
    json,
    lossReport: finalizeLossReport(lossReport),
  };
}

export function serializeMindMapExportJsonV1(graph) {
  return serializeMindMapExportJsonV1WithLossReport(graph).json;
}
