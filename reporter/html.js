// Self-contained HTML report: no external scripts or stylesheets,
// so it opens anywhere and can be attached or committed as-is.

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// k6's JavaScript engine has no locale formatting, so add thousands separators by hand
const fmt = (n) => {
  const [int, dec] = String(Math.round(Number(n || 0) * 100) / 100).split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? "." + dec : "");
};

// Horizontal bar per metric: actual bar, with a tick at the target
function barChart(items, unit) {
  const max = Math.max(...items.map((c) => Math.max(c.actual, c.expected))) * 1.1 || 1;
  const rowH = 34, labelW = 90, chartW = 460, w = labelW + chartW + 90;
  const rows = items.map((c, i) => {
    const y = i * rowH + 8;
    const aw = (c.actual / max) * chartW;
    const tx = labelW + (c.expected / max) * chartW;
    return `
      <text x="${labelW - 10}" y="${y + 15}" text-anchor="end" class="lbl">${esc(c.metric)}</text>
      <rect x="${labelW}" y="${y + 2}" width="${Math.max(aw, 2)}" height="18" rx="3" class="${c.status === "PASS" ? "ok" : "bad"}"/>
      <line x1="${tx}" x2="${tx}" y1="${y - 2}" y2="${y + 24}" class="tgt"/>
      <text x="${labelW + Math.max(aw, 2) + 8}" y="${y + 15}" class="val">${fmt(c.actual)}${unit}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${items.length * rowH + 12}" role="img" aria-label="Actual versus target">${rows}</svg>`;
}

function table(items, unit) {
  return `<table><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Variance</th><th>Result</th></tr></thead><tbody>
  ${items.map((c) => `<tr><td>${esc(c.metric)}</td><td>${fmt(c.expected)}${unit}</td><td>${fmt(c.actual)}${unit}</td>
  <td>${c.variancePct > 0 ? "+" : ""}${fmt(c.variancePct)}%</td><td><span class="pill ${c.status === "PASS" ? "ok" : "bad"}">${c.status}</span></td></tr>`).join("")}
  </tbody></table>`;
}

export function htmlReport(s) {
  const passCount = [...s.responseTimes, ...s.rates].filter((c) => c.status === "PASS").length;
  const checks = s.responseTimes.length + s.rates.length;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.profile.label)} test - QuickPizza API</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#151a22;--muted:#5d6676;--line:#dfe3ea;--ok:#13804e;--okbg:#e2f4ea;--bad:#c0262f;--badbg:#fbe5e6;--tgt:#151a22}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--card:#171b23;--fg:#e7eaf0;--muted:#99a2b3;--line:#2b313d;--ok:#5fd19b;--okbg:#143021;--bad:#ff8a8f;--badbg:#3a1a1d;--tgt:#e7eaf0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:28px 16px 48px;display:grid;grid-template-columns:minmax(0,1fr);gap:18px}.card,header{min-width:0}h1{overflow-wrap:anywhere}
h1{margin:0;font-size:clamp(22px,4vw,30px)}h2{margin:0 0 10px;font-size:17px}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px}
.verdict{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between}
.big{font-size:22px;font-weight:700;padding:6px 14px;border-radius:8px}
.big.ok,.pill.ok{background:var(--okbg);color:var(--ok)}.big.bad,.pill.bad{background:var(--badbg);color:var(--bad)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.kpi b{display:block;font-size:24px;font-variant-numeric:tabular-nums}.kpi span{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;margin-top:12px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line)}th{font-size:12px;color:var(--muted);font-weight:600}
.pill.known{background:var(--line);color:var(--fg)}.pill{font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px}
svg{width:100%;height:auto}.lbl,.val{font-size:12px;fill:var(--fg)}rect.ok{fill:var(--ok)}rect.bad{fill:var(--bad)}.tgt{stroke:var(--tgt);stroke-width:2;stroke-dasharray:3 2}
.legend{font-size:12px;color:var(--muted)}.scroll{overflow-x:auto}
</style></head><body><div class="wrap">
<header><h1>${esc(s.title)}</h1><p class="muted">${esc(s.profile.label)} test · finished ${esc(s.finishedAt.replace("T", " ").slice(0, 19) + " UTC")}</p></header>

<section class="card verdict">
  <div><h2>Overall result</h2><div class="muted">${passCount} of ${checks} SLA targets met</div></div>
  <div class="big ${s.overall === "PASS" ? "ok" : "bad"}">${s.overall}</div>
</section>

<section class="card kpis">
  <div class="kpi"><b>${fmt(s.totals.requests)}</b><span>Requests</span></div>
  <div class="kpi"><b>${fmt(s.rates[0].actual)}%</b><span>Success rate</span></div>
  <div class="kpi"><b>${fmt(s.responseTime.avg)} ms</b><span>Average response</span></div>
  <div class="kpi"><b>${fmt(s.responseTime.p95)} ms</b><span>P95 response</span></div>
  <div class="kpi"><b>${fmt(s.totals.rps)}</b><span>Requests / sec</span></div>
</section>

<section class="card"><h2>Test details</h2><dl>
  <dt>Endpoint</dt><dd>${esc(s.endpoint)}</dd>
  <dt>Profile</dt><dd>${esc(s.profile.label)}: ${esc(s.profile.description)}</dd>
  <dt>Peak virtual users</dt><dd>${s.peakUsers}</dd>
  <dt>Duration</dt><dd>${s.durationSec}s</dd>
  <dt>Tester</dt><dd>${esc(s.tester)}</dd>
</dl></section>

<section class="card"><h2>Response time vs target</h2>
  <p class="legend">Bars show actual response time; the dashed line marks the SLA target. Green meets the target, red misses it.</p>
  ${barChart(s.responseTimes, " ms")}
  <div class="scroll">${table(s.responseTimes, " ms")}</div>
</section>

<section class="card"><h2>Reliability</h2>
  <p class="legend">HTTP failures are requests that failed outright. Business errors are HTTP 200 responses where the pizza broke the restrictions sent in the request.</p>
  <div class="scroll">${table(s.rates, "%")}</div>
</section>

<section class="card"><h2>Failure reasons and known issues</h2>
  ${s.failureReasons.length
    ? `<div class="scroll"><table><thead><tr><th>Reason</th><th>Type</th><th>Requests</th><th>Share of all requests</th></tr></thead><tbody>
      ${s.failureReasons.map((r) => `<tr><td>${esc(r.label)}</td><td><span class="pill ${r.knownIssue ? "known" : "bad"}">${r.knownIssue ? "Known issue" : "Failure"}</span></td><td>${fmt(r.count)}</td><td>${fmt(s.totals.successful + s.totals.failed ? (r.count / (s.totals.successful + s.totals.failed)) * 100 : 0)}%</td></tr>`).join("")}
      </tbody></table></div>`
    : `<p class="muted">None. Every request returned HTTP 200 with a pizza that met all restrictions.</p>`}
</section>

<p class="muted legend">Generated by k6 · demo API: QuickPizza by Grafana Labs</p>
</div></body></html>`;
}
