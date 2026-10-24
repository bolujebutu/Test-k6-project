// Readable console summary printed at the end of every run.

const C = { green: "\x1b[32m", red: "\x1b[31m", grey: "\x1b[90m", bold: "\x1b[1m", reset: "\x1b[0m" };
const paint = (status, text) => `${status === "PASS" ? C.green : C.red}${text}${C.reset}`;
const line = (ch = "-") => ch.repeat(68);

const row = (c, unit = "") =>
  `  ${c.metric.padEnd(24)}${(c.expected + unit).padStart(12)}${(c.actual + unit).padStart(14)}   ${paint(c.status, c.status.padEnd(6))}${C.grey}${(c.variancePct > 0 ? "+" : "") + c.variancePct}%${C.reset}`;

export function cliReport(s) {
  return `
${line("=")}
  ${C.bold}${s.title}${C.reset}
${line("=")}
  Endpoint     ${s.endpoint}
  Profile      ${s.profile.label} - ${s.profile.description}
  Tester       ${s.tester}
  Duration     ${s.durationSec}s    Peak users: ${s.peakUsers}
  Requests     ${s.totals.requests} total, ${s.totals.successful} passed, ${s.totals.failed} failed  (${s.totals.rps} req/s)

  ${"RESPONSE TIME (ms)".padEnd(24)}${"Target".padStart(12)}${"Actual".padStart(14)}   Result
${line()}
${s.responseTimes.map((c) => row(c)).join("\n")}

  ${"RELIABILITY".padEnd(24)}${"Target".padStart(12)}${"Actual".padStart(14)}   Result
${line()}
${s.rates.map((c) => row(c)).join("\n")}

  FAILURE REASONS
${line()}
${s.failureReasons.length ? s.failureReasons.map((r) => `  ${r.label.padEnd(44)}${String(r.count).padStart(8)}`).join("\n") : "  None - every request passed"}

${line()}
  OVERALL: ${paint(s.overall, s.overall === "PASS" ? "PASS - all SLA targets met" : "FAIL - one or more SLA targets missed")}
  HTML report: reports/${s.profile.name}-report.html
${line("=")}
`;
}
