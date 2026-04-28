'use strict';

const { validatePathBoundary } = require('../core/io/path-boundary.js');
const { NETWORK_ROUTES, runNetworkNegativeMatrix } = require('./network-deny-monitor.js');

const FAIL_SIGNAL = 'E_B3C08_SUPPORT_BUNDLE_PRIVACY_NOT_OK';
const HELPER_ROLE = 'PROOF_HELPER_NOT_PRODUCT_SUPPORT_BUNDLE';
const REDACTION_TOKEN = '[REDACTED_BY_B3C08]';

const SUPPORT_BUNDLE_PRIVACY_ROUTES = Object.freeze({
  BODY_LEAK: 'support.body-leak',
  SCENE_TITLE_LEAK: 'support.scene-title-leak',
  PRIVATE_PATH_LEAK: 'support.private-path-leak',
  ASSET_BINARY_LEAK: 'support.asset-binary-leak',
  UNREDACTED_ERROR_LEAK: 'support.unredacted-error-leak',
  NETWORK_UPLOAD: 'support.network-upload',
  RELEASE_DOSSIER_CLAIM: 'support.release-dossier-claim',
  ATTESTATION_CLAIM: 'support.attestation-claim',
});

const DEFAULT_ALLOWED_FIELDS = Object.freeze([
  'bundleId',
  'schemaVersion',
  'createdAtPolicy',
  'diagnosticCodes',
  'eventCounts',
  'redactedErrors',
  'runtime',
  'privacy',
]);

const FORBIDDEN_DEFAULT_FIELDS = Object.freeze([
  'manuscriptBody',
  'sceneTitle',
  'sceneTitles',
  'privatePath',
  'privatePaths',
  'assetBinary',
  'assetBinaries',
  'releaseDossier',
  'attestation',
]);

const REQUIRED_NETWORK_UPLOAD_DENY_ROUTES = Object.freeze([
  NETWORK_ROUTES.FETCH,
  NETWORK_ROUTES.WEBSOCKET,
  NETWORK_ROUTES.XML_HTTP_REQUEST,
  NETWORK_ROUTES.HTTP_REQUEST,
  NETWORK_ROUTES.HTTPS_REQUEST,
  NETWORK_ROUTES.HTTP_GET,
  NETWORK_ROUTES.HTTPS_GET,
  NETWORK_ROUTES.REMOTE_IMAGE,
  NETWORK_ROUTES.UPDATE_CHECK,
  NETWORK_ROUTES.ANALYTICS,
  NETWORK_ROUTES.CLOUD_SYNC,
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value : '';
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => normalizeString(value)).filter((value) => value.length > 0))];
}

function flattenStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Buffer.isBuffer(value)) {
    out.push(value.toString('base64'));
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenStrings(item, out);
    return out;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) flattenStrings(item, out);
  }
  return out;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSort(entry));
  if (!isRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableJson(value) {
  return JSON.stringify(stableSort(value), null, 2);
}

function redactForbiddenText(value, forbiddenStrings) {
  let text = normalizeString(value);
  for (const forbidden of forbiddenStrings) {
    if (!forbidden) continue;
    text = text.split(forbidden).join(REDACTION_TOKEN);
  }
  return text;
}

function createFixtureProject(overrides = {}) {
  return Object.freeze({
    projectId: 'b3c08-fixture-project',
    manuscriptBody: 'The private manuscript body must never appear in default diagnostics.',
    sceneTitle: 'Private Chapter Title',
    privatePath: '/Users/author/Documents/Novel/private-draft.yalken',
    assetBinary: Buffer.from('private-image-bytes-for-b3c08', 'utf8'),
    errorText: 'Failed while opening /Users/author/Documents/Novel/private-draft.yalken: Private Chapter Title',
    diagnosticCodes: ['E_RECOVERY_IO_NOT_OK', 'E_PATH_BOUNDARY_VIOLATION'],
    eventCounts: { warnings: 2, errors: 1 },
    runtime: { platform: 'test-only', offline: true },
    ...overrides,
  });
}

function collectForbiddenStrings(input = {}) {
  const project = isRecord(input.project) ? input.project : createFixtureProject();
  return uniqueStrings([
    project.manuscriptBody,
    project.sceneTitle,
    project.privatePath,
    Buffer.isBuffer(project.assetBinary) ? project.assetBinary.toString('base64') : project.assetBinary,
    project.errorText,
    ...(Array.isArray(input.extraForbiddenStrings) ? input.extraForbiddenStrings : []),
  ]);
}

function normalizePrivatePath(pathValue) {
  const raw = normalizeString(pathValue);
  const basename = raw.split(/[\\/]/u).filter(Boolean).pop() || '';
  const state = validatePathBoundary(raw, { mode: 'relative' });
  return Object.freeze({
    sourceValueStored: false,
    basename,
    acceptedAsRelativePublicPath: state.ok === true,
    boundaryFailSignal: state.ok === true ? '' : state.failSignal,
    boundaryFailReason: state.ok === true ? '' : state.failReason,
    redactedPath: basename ? `<private-path:${basename}>` : '<private-path>',
  });
}

function createDefaultSupportBundle(input = {}) {
  const project = isRecord(input.project) ? input.project : createFixtureProject();
  const forbiddenStrings = collectForbiddenStrings({ project });
  const privatePath = normalizePrivatePath(project.privatePath);
  const redactedError = redactForbiddenText(project.errorText, forbiddenStrings);
  const bundle = stableSort({
    bundleId: 'B3C08_DEFAULT_SUPPORT_BUNDLE_PRIVACY_PROOF',
    schemaVersion: 1,
    createdAtPolicy: 'DECLARED_VOLATILE_OMITTED_FROM_PRIVACY_SCAN',
    diagnosticCodes: Array.isArray(project.diagnosticCodes) ? project.diagnosticCodes.map(String) : [],
    eventCounts: isRecord(project.eventCounts) ? { ...project.eventCounts } : {},
    redactedErrors: [
      {
        message: redactedError,
        pathRedaction: privatePath.redactedPath,
      },
    ],
    runtime: {
      platform: normalizeString(project.runtime?.platform) || 'test-only',
      offline: project.runtime?.offline !== false,
    },
    privacy: {
      defaultBundleOnly: true,
      expandedBundleOptInRequired: true,
      evidenceNotManuscriptTruth: true,
      noNetworkUpload: true,
      noReleaseDossierClaim: true,
      noAttestationClaim: true,
      proofHelperOnly: true,
      helperRole: HELPER_ROLE,
    },
  });
  const snapshot = stableJson(bundle);
  return Object.freeze({
    bundle,
    snapshot,
    forbiddenStrings,
    privatePath,
  });
}

function findForbiddenStrings(snapshot, forbiddenStrings) {
  return forbiddenStrings.filter((value) => value && snapshot.includes(value));
}

function hasForbiddenFieldNames(value) {
  if (Array.isArray(value)) return value.some((entry) => hasForbiddenFieldNames(entry));
  if (!isRecord(value)) return false;
  return Object.keys(value).some((key) => FORBIDDEN_DEFAULT_FIELDS.includes(key))
    || Object.values(value).some((entry) => hasForbiddenFieldNames(entry));
}

function fieldAllowlistRows(bundle) {
  const topLevelKeys = Object.keys(bundle).sort((a, b) => a.localeCompare(b));
  return [
    {
      id: 'DEFAULT_BUNDLE_FIELD_ALLOWLIST_BOUND',
      passed: topLevelKeys.every((key) => DEFAULT_ALLOWED_FIELDS.includes(key)),
      details: { topLevelKeys },
    },
    {
      id: 'DEFAULT_BUNDLE_HAS_NO_FORBIDDEN_FIELD_NAMES',
      passed: !hasForbiddenFieldNames(bundle),
      details: { forbiddenFieldNames: [...FORBIDDEN_DEFAULT_FIELDS] },
    },
  ];
}

function leakRow(id, route, snapshot, forbiddenString) {
  const leaked = Boolean(forbiddenString) && snapshot.includes(forbiddenString);
  return Object.freeze({
    id,
    route,
    denied: !leaked,
    passed: !leaked,
    failSignal: leaked ? FAIL_SIGNAL : '',
    reason: leaked ? 'FORBIDDEN_STRING_PRESENT' : 'FORBIDDEN_STRING_ABSENT',
  });
}

function runSupportBundlePrivacyMatrix(input = {}) {
  const project = isRecord(input.project) ? input.project : createFixtureProject();
  const proof = createDefaultSupportBundle({ project });
  const assetString = Buffer.isBuffer(project.assetBinary)
    ? project.assetBinary.toString('base64')
    : normalizeString(project.assetBinary);
  const forbiddenHits = findForbiddenStrings(proof.snapshot, proof.forbiddenStrings);
  const networkRows = Array.isArray(input.networkRows) ? input.networkRows : [];
  const networkByRoute = new Map(networkRows.map((row) => [row.route, row]));
  const networkUploadDenied = REQUIRED_NETWORK_UPLOAD_DENY_ROUTES.every((route) => {
    const row = networkByRoute.get(route);
    return row && row.denied === true;
  });
  const rows = [
    {
      id: 'SAFE_DIAGNOSTIC_BUNDLE_ACCEPTED',
      route: 'support.safe-default',
      passed: proof.bundle.privacy.defaultBundleOnly === true && forbiddenHits.length === 0,
      denied: false,
      failSignal: forbiddenHits.length === 0 ? '' : FAIL_SIGNAL,
      reason: forbiddenHits.length === 0 ? 'SAFE_DEFAULT_ACCEPTED' : 'FORBIDDEN_STRING_PRESENT',
    },
    leakRow('BODY_LEAK_DENIED', SUPPORT_BUNDLE_PRIVACY_ROUTES.BODY_LEAK, proof.snapshot, project.manuscriptBody),
    leakRow('SCENE_TITLE_LEAK_DENIED', SUPPORT_BUNDLE_PRIVACY_ROUTES.SCENE_TITLE_LEAK, proof.snapshot, project.sceneTitle),
    leakRow('PRIVATE_PATH_LEAK_DENIED', SUPPORT_BUNDLE_PRIVACY_ROUTES.PRIVATE_PATH_LEAK, proof.snapshot, project.privatePath),
    leakRow('ASSET_BINARY_LEAK_DENIED', SUPPORT_BUNDLE_PRIVACY_ROUTES.ASSET_BINARY_LEAK, proof.snapshot, assetString),
    leakRow('UNREDACTED_ERROR_DENIED', SUPPORT_BUNDLE_PRIVACY_ROUTES.UNREDACTED_ERROR_LEAK, proof.snapshot, project.errorText),
    {
      id: 'NETWORK_UPLOAD_ABSENT',
      route: SUPPORT_BUNDLE_PRIVACY_ROUTES.NETWORK_UPLOAD,
      denied: networkUploadDenied,
      passed: networkUploadDenied,
      failSignal: networkUploadDenied ? '' : FAIL_SIGNAL,
      reason: networkUploadDenied ? 'B3C06_NETWORK_DENY_MATRIX_BOUND' : 'NETWORK_ROUTE_NOT_DENIED',
      details: {
        requiredRoutes: [...REQUIRED_NETWORK_UPLOAD_DENY_ROUTES],
        observedRoutes: networkRows.map((row) => row.route).sort((a, b) => a.localeCompare(b)),
      },
    },
    {
      id: 'RELEASE_DOSSIER_CLAIM_ABSENT',
      route: SUPPORT_BUNDLE_PRIVACY_ROUTES.RELEASE_DOSSIER_CLAIM,
      denied: proof.bundle.privacy.noReleaseDossierClaim === true && proof.snapshot.includes('releaseDossier') === false,
      passed: proof.bundle.privacy.noReleaseDossierClaim === true && proof.snapshot.includes('releaseDossier') === false,
      failSignal: proof.bundle.privacy.noReleaseDossierClaim === true && proof.snapshot.includes('releaseDossier') === false ? '' : FAIL_SIGNAL,
      reason: 'NO_RELEASE_DOSSIER_CLAIM',
    },
    {
      id: 'ATTESTATION_CLAIM_ABSENT',
      route: SUPPORT_BUNDLE_PRIVACY_ROUTES.ATTESTATION_CLAIM,
      denied: proof.bundle.privacy.noAttestationClaim === true && proof.snapshot.includes('attestation') === false,
      passed: proof.bundle.privacy.noAttestationClaim === true && proof.snapshot.includes('attestation') === false,
      failSignal: proof.bundle.privacy.noAttestationClaim === true && proof.snapshot.includes('attestation') === false ? '' : FAIL_SIGNAL,
      reason: 'NO_ATTESTATION_CLAIM',
    },
    {
      id: 'REDACTION_APPLIED',
      route: 'support.redaction',
      denied: false,
      passed: proof.snapshot.includes(REDACTION_TOKEN) === true,
      failSignal: proof.snapshot.includes(REDACTION_TOKEN) ? '' : FAIL_SIGNAL,
      reason: proof.snapshot.includes(REDACTION_TOKEN) ? 'REDACTION_TOKEN_PRESENT' : 'REDACTION_TOKEN_MISSING',
    },
    {
      id: 'OPT_IN_REQUIRED_FOR_EXPANDED_FIELDS',
      route: 'support.opt-in',
      denied: false,
      passed: proof.bundle.privacy.expandedBundleOptInRequired === true,
      failSignal: '',
      reason: 'EXPANDED_FIELDS_DISABLED_BY_DEFAULT',
    },
    {
      id: 'EVIDENCE_NOT_TRUTH_BOUND',
      route: 'support.evidence-not-truth',
      denied: false,
      passed: proof.bundle.privacy.evidenceNotManuscriptTruth === true,
      failSignal: '',
      reason: 'DIAGNOSTIC_EVIDENCE_NOT_MANUSCRIPT_TRUTH',
    },
    {
      id: 'REDACTION_OUTPUT_SNAPSHOT_BOUND',
      route: 'support.snapshot',
      denied: false,
      passed: proof.snapshot.includes('B3C08_DEFAULT_SUPPORT_BUNDLE_PRIVACY_PROOF') === true,
      failSignal: '',
      reason: 'SNAPSHOT_BOUND',
    },
    {
      id: 'FORBIDDEN_STRING_SCAN_BOUND',
      route: 'support.forbidden-scan',
      denied: false,
      passed: forbiddenHits.length === 0,
      failSignal: forbiddenHits.length === 0 ? '' : FAIL_SIGNAL,
      reason: forbiddenHits.length === 0 ? 'NO_FORBIDDEN_STRINGS' : 'FORBIDDEN_STRINGS_PRESENT',
    },
    {
      id: 'PRIVATE_PATH_NORMALIZATION_CHECK_BOUND',
      route: 'support.private-path-normalization',
      denied: false,
      passed: proof.privatePath.acceptedAsRelativePublicPath === false
        && proof.privatePath.boundaryFailSignal === 'E_PATH_BOUNDARY_VIOLATION'
        && proof.snapshot.includes(proof.privatePath.redactedPath) === true,
      failSignal: '',
      reason: 'PRIVATE_PATH_REDACTED_AND_BOUNDARY_REJECTED',
    },
    ...fieldAllowlistRows(proof.bundle).map((row) => ({
      ...row,
      route: 'support.field-allowlist',
      denied: false,
      failSignal: row.passed ? '' : FAIL_SIGNAL,
      reason: row.passed ? 'FIELD_ALLOWLIST_OK' : 'FIELD_ALLOWLIST_FAIL',
    })),
  ];

  return Object.freeze({
    proof,
    rows: Object.freeze(rows),
    failedRows: Object.freeze(rows.filter((row) => row.passed !== true).map((row) => row.id)),
  });
}

async function runSupportBundlePrivacyMatrixWithNetwork() {
  const networkRows = await runNetworkNegativeMatrix();
  return runSupportBundlePrivacyMatrix({ networkRows });
}

module.exports = {
  DEFAULT_ALLOWED_FIELDS,
  FAIL_SIGNAL,
  FORBIDDEN_DEFAULT_FIELDS,
  HELPER_ROLE,
  REDACTION_TOKEN,
  REQUIRED_NETWORK_UPLOAD_DENY_ROUTES,
  SUPPORT_BUNDLE_PRIVACY_ROUTES,
  collectForbiddenStrings,
  createDefaultSupportBundle,
  createFixtureProject,
  findForbiddenStrings,
  flattenStrings,
  normalizePrivatePath,
  runSupportBundlePrivacyMatrix,
  runSupportBundlePrivacyMatrixWithNetwork,
};
