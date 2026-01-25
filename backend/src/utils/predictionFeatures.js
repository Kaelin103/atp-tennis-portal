function buildPredictionFeatures(radar) {
  const labels = radar.labels ?? [];
  const a = (radar.a?.values ?? []).map(Number);
  const b = (radar.b?.values ?? []).map(Number);

  const diffVector = labels.map((_, i) => (Number(a[i] ?? 0) - Number(b[i] ?? 0)));
  const absDiffVector = diffVector.map(v => Math.abs(v));

  return {
    labels,
    aVector: a,
    bVector: b,
    diffVector,
    absDiffVector,
    distanceL2: radar.meta?.distance ?? null,
    context: radar.meta ?? {},
  };
}

module.exports = { buildPredictionFeatures };
