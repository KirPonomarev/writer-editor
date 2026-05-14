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
    path: normalizeLossString(lossItem?.path),
    note: normalizeLossString(lossItem?.note),
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
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      kind: normalizeLossString(item.kind),
      reasonCode: normalizeLossString(item.reasonCode),
      path: normalizeLossString(item.path),
      note: normalizeLossString(item.note),
      evidence: normalizeLossString(item.evidence),
    }));

  items.sort((a, b) => {
    const ak = `${a.kind}\u0000${a.reasonCode}\u0000${a.path}\u0000${a.note}\u0000${a.evidence}`;
    const bk = `${b.kind}\u0000${b.reasonCode}\u0000${b.path}\u0000${b.note}\u0000${b.evidence}`;
    return stableLexCompare(ak, bk);
  });

  out.items = items;
  out.count = items.length;
  return out;
}
