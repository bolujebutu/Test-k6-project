// Turns k6's raw end-of-test data into one tidy summary object,
// comparing every result against the profile's SLA.

const round = (n, dp = 2) => Number((n || 0).toFixed(dp));

const compare = (metric, actual, expected, lowerIsBetter = true) => {
  const pass = lowerIsBetter ? actual <= expected : actual >= expected;
  const variancePct = expected ? ((actual - expected) / expected) * 100 : 0;
  return { metric, actual: round(actual), expected, status: pass ? "PASS" : "FAIL", variancePct: round(variancePct) };
};

export function buildSummary(data, profile, meta) {
  const m = data.metrics || {};
  const rt = (m.pizza_response_time && m.pizza_response_time.values) || {};
  const reqs = (m.http_reqs && m.http_reqs.values) || {};
  const ok = (m.successful_requests && m.successful_requests.values.count) || 0;
  const bad = (m.failed_requests && m.failed_requests.values.count) || 0;
  const total = ok + bad;

  const httpFailurePct = ((m.http_req_failed && m.http_req_failed.values.rate) || 0) * 100;
  const businessErrorPct = ((m.business_errors && m.business_errors.values.rate) || 0) * 100;
  const successPct = total ? (ok / total) * 100 : 0;
  const sla = profile.sla;

  const responseTimes = [
    compare("Average", rt.avg, sla.responseTimeMs.avg),
    compare("P90", rt["p(90)"], sla.responseTimeMs.p90),
    compare("P95", rt["p(95)"], sla.responseTimeMs.p95),
    compare("P99", rt["p(99)"], sla.responseTimeMs.p99),
    compare("Max", rt.max, sla.responseTimeMs.max),
  ];
  const rates = [
    compare("Success rate %", successPct, sla.minSuccessPct, false),
    compare("HTTP failure rate %", httpFailurePct, sla.maxHttpFailurePct),
    compare("Business error rate %", businessErrorPct, sla.maxBusinessErrorPct),
  ];
  const allChecks = [...responseTimes, ...rates];

  // Why requests failed, most common first
  const failureReasons = Object.entries(meta.failureRules || {})
    .map(([rule, label]) => ({ rule, label, count: (m[`fail_${rule}`] && m[`fail_${rule}`].values.count) || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    title: "QuickPizza API - Performance Test Report",
    endpoint: `POST ${meta.baseUrl}/api/pizza`,
    tester: meta.tester,
    profile: { name: profile.name, label: profile.label, description: profile.description },
    finishedAt: new Date().toISOString(),
    durationSec: round(((data.state && data.state.testRunDurationMs) || 0) / 1000, 1),
    peakUsers: Math.max(...profile.stages.map((s) => s.target)),
    totals: { requests: reqs.count || 0, successful: ok, failed: bad, rps: round(reqs.rate) },
    responseTime: {
      min: round(rt.min), avg: round(rt.avg), median: round(rt.med),
      p90: round(rt["p(90)"]), p95: round(rt["p(95)"]), p99: round(rt["p(99)"]), max: round(rt.max),
    },
    responseTimes,
    rates,
    failureReasons,
    overall: allChecks.every((c) => c.status === "PASS") ? "PASS" : "FAIL",
  };
}
