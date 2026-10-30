const FIELD_LABELS = Object.freeze({
  added: 'Words added',
  deleted: 'Words deleted',
  net: 'Net words',
  touched: 'Words touched',
  sessions: 'Sessions completed',
  sceneEdits: 'Scenes edited',
  declaredTasks: 'Declared tasks',
  manualPhase: 'Manual phase',
});

const CORRECTION_LABELS = Object.freeze({ ACTIVE_WRITING_SECONDS: 'Active writing seconds', SCENES_EDITED_COUNT: 'Scenes edited',
  SESSIONS_COMPLETED_COUNT: 'Sessions completed', WORDS_ADDED_COUNT: 'Words added', WORDS_DELETED_COUNT: 'Words deleted' });

const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;

function metric(value) {
  const source = object(value);
  if (source.status !== 'RECORDED') {
    return { status: 'NOT_RECORDED', value: null, displayValue: 'Not recorded', provenance: '' };
  }
  const recorded = Number.isSafeInteger(source.value) || typeof source.value === 'string' ? source.value : null;
  if (recorded === null) return { status: 'NOT_RECORDED', value: null, displayValue: 'Not recorded', provenance: '' };
  return {
    status: 'RECORDED',
    value: recorded,
    displayValue: String(recorded),
    provenance: typeof source.provenance === 'string' ? source.provenance : '',
  };
}

export function normalizePulseHistoryPresentation(source = {}) {
  const projection = object(source);
  const privacy = object(projection.privacy);
  const summary = object(projection.summary);
  const rawRows = Array.isArray(projection.rows) ? projection.rows.slice(0, 64) : [];
  const rows = rawRows.map((raw) => {
    const row = object(raw);
    return {
      sequence: count(row.sequence),
      sourceRevisionOrdinal: count(row.sourceRevisionOrdinal),
      generation: count(row.generation),
      metrics: Object.entries(FIELD_LABELS).map(([id, fieldLabel]) => ({ id, fieldLabel, ...metric(row[id]) })),
    };
  });
  const state = ['ready', 'degraded', 'empty', 'optedOut', 'unavailable', 'loading'].includes(projection.state)
    ? projection.state : 'unavailable';
  const currentPrivacy = !['unavailable', 'loading'].includes(state)
    && ['OPTED_IN', 'OPTED_OUT'].includes(privacy.collectionStatus)
    && Number.isSafeInteger(privacy.revision) && privacy.revision >= 0
    && typeof privacy.stateDigest === 'string' && /^[a-f0-9]{64}$/u.test(privacy.stateDigest);
  const review = object(projection.correctionReview), identity = object(review.identity);
  const validCorrectionIdentity = currentPrivacy && privacy.collectionStatus === 'OPTED_IN'
    && review.schemaVersion === 'yalken.r24.pulseAuthorCorrectionReview.v1'
    && identity.privacyRevision === privacy.revision && identity.privacyStateDigest === privacy.stateDigest
    && ['ledgerSequence', 'correctionSequence'].every(key => Number.isSafeInteger(identity[key]) && identity[key] >= 0 && identity[key] <= 4096)
    && ['ledgerHeadDigest', 'correctionHeadDigest'].every(key => typeof identity[key] === 'string' && /^[a-f0-9]{64}$/u.test(identity[key]));
  const correctionIdentity = validCorrectionIdentity ? { ...identity } : null;
  const correctionRows = validCorrectionIdentity && Array.isArray(review.rows) ? review.rows.slice(0, 64) : [];
  for (const row of rows) {
    const source = correctionRows.find(candidate => candidate?.ledgerSequence === row.sequence);
    row.corrections = source && typeof source.entryDigest === 'string' && /^[a-f0-9]{64}$/u.test(source.entryDigest) && Array.isArray(source.metrics)
      ? source.metrics.filter(metric => metric && Object.hasOwn(CORRECTION_LABELS, metric.metricId)
        && ['originalValue', 'effectiveValue'].every(key => Number.isSafeInteger(metric[key]) && metric[key] >= 0 && metric[key] <= 1000000000)
        && (metric.correctionSequence === null || Number.isSafeInteger(metric.correctionSequence) && metric.correctionSequence > 0 && metric.correctionSequence <= identity.correctionSequence))
        .map(metric => ({ ...metric, fieldLabel: CORRECTION_LABELS[metric.metricId], targetLedgerSequence: row.sequence, targetEntryDigest: source.entryDigest })) : [];
  }
  const totalRows = count(summary.totalRows);
  const visibleRows = Math.min(count(summary.visibleRows), rows.length);
  const omittedRows = count(summary.omittedRows);
  const statusText = state === 'optedOut'
    ? 'Writing history is off. Local history remains unread.'
    : state === 'empty'
      ? 'No local aggregate history has been recorded.'
      : state === 'unavailable'
        ? (typeof projection.unavailableReason === 'string' && projection.unavailableReason) || 'Writing history is unavailable.'
        : state === 'loading'
          ? 'Writing history is loading after explicit open.'
          : `${visibleRows} of ${totalRows} revisions shown · ${count(summary.recordedFields)} complete · ${count(summary.partialFields)} partial · ${count(summary.notRecordedFields)} not recorded`;
  return {
    schemaVersion: typeof projection.schemaVersion === 'string' ? projection.schemaVersion : 'yalken.r24.pulseClaim.v1',
    state,
    statusText,
    privacyStatus: privacy.collectionStatus === 'OPTED_IN' ? 'OPTED_IN' : 'OPTED_OUT',
    privacyRevision: currentPrivacy ? privacy.revision : null,
    privacyStateDigest: currentPrivacy ? privacy.stateDigest : '',
    correctionIdentity,
    aggregateOnly: privacy.aggregateOnly === true,
    totalRows,
    visibleRows,
    omittedRows,
    rows,
    claims: Array.isArray(projection.claims) ? projection.claims.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : [],
    readOnly: object(projection.authority).readOnly === true,
  };
}
