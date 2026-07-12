function normalizeLossString(value) {
  return String(value ?? '').trim();
}

function stableLexCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function createLossReport() {
  return {
    count: 0,
    items: [],
  };
}

export function appendLoss(report, lossItem) {
  if (!report || typeof report !== 'object' || !Array.isArray(report.items)) return;
  const item = {
    kind: normalizeLossString(lossItem?.kind),
    reasonCode: normalizeLossString(lossItem?.reasonCode),
    code: normalizeLossString(lossItem?.code || lossItem?.reasonCode || lossItem?.kind),
    severity: normalizeLossString(lossItem?.severity || 'WARN'),
    action: normalizeLossString(lossItem?.action || 'DOWNGRADE'),
    path: normalizeLossString(lossItem?.path),
    note: normalizeLossString(lossItem?.note),
    message: normalizeLossString(lossItem?.message || lossItem?.note),
    evidence: normalizeLossString(lossItem?.evidence),
  };
  report.items.push(item);
}

export function finalizeLossReport(report) {
  const out = {
    count: 0,
    items: [],
  };
  if (!report || typeof report !== 'object' || !Array.isArray(report.items)) return out;

  const items = report.items
    .filter((it) => it && typeof it === 'object')
    .map((it) => ({
      kind: normalizeLossString(it.kind),
      reasonCode: normalizeLossString(it.reasonCode),
      code: normalizeLossString(it.code || it.reasonCode || it.kind),
      severity: normalizeLossString(it.severity || 'WARN'),
      action: normalizeLossString(it.action || 'DOWNGRADE'),
      path: normalizeLossString(it.path),
      note: normalizeLossString(it.note),
      message: normalizeLossString(it.message || it.note),
      evidence: normalizeLossString(it.evidence),
    }));

  items.sort((a, b) => {
    const ak = `${a.kind}\u0000${a.reasonCode}\u0000${a.code}\u0000${a.severity}\u0000${a.action}\u0000${a.path}\u0000${a.note}\u0000${a.message}\u0000${a.evidence}`;
    const bk = `${b.kind}\u0000${b.reasonCode}\u0000${b.code}\u0000${b.severity}\u0000${b.action}\u0000${b.path}\u0000${b.note}\u0000${b.message}\u0000${b.evidence}`;
    return stableLexCompare(ak, bk);
  });
  out.items = items;
  out.count = items.length;
  return out;
}

export function mergeLossReports(...reports) {
  const merged = createLossReport();
  for (const report of reports) {
    if (!report || typeof report !== 'object' || !Array.isArray(report.items)) continue;
    for (const item of report.items) appendLoss(merged, item);
  }
  return finalizeLossReport(merged);
}
