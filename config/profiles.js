// Test profiles: how much load to apply and what "good" looks like (the SLA).
// Pick one at run time:  k6 run -e PROFILE=baseline src/pizza-test.js
//
// QuickPizza is a free public demo run by Grafana for small-scale tests,
// so the user counts here are deliberately modest. Don't raise them much
// against the public instance; run QuickPizza locally (see README) for heavier tests.

export const PROFILES = {
  smoke: {
    label: "Smoke",
    description: "1 user for 30s, to check the script and API work before any real load",
    stages: [
      { duration: "1s", target: 1 },
      { duration: "29s", target: 1 },
    ],
    sla: {
      responseTimeMs: { avg: 800, p90: 1000, p95: 1200, p99: 1500, max: 3000 },
      maxHttpFailurePct: 1,
      maxBusinessErrorPct: 1,
      minSuccessPct: 99,
    },
  },

  baseline: {
    label: "Baseline",
    description: "Steady 5 users for 2 minutes, to set the normal performance reference",
    stages: [
      { duration: "15s", target: 5 },
      { duration: "2m", target: 5 },
      { duration: "10s", target: 0 },
    ],
    sla: {
      responseTimeMs: { avg: 800, p90: 1000, p95: 1200, p99: 1500, max: 3000 },
      maxHttpFailurePct: 1,
      maxBusinessErrorPct: 1,
      minSuccessPct: 99,
    },
  },

  load: {
    label: "Load",
    description: "Ramp to 10 users and hold for 3 minutes, to simulate expected peak traffic",
    stages: [
      { duration: "30s", target: 10 },
      { duration: "3m", target: 10 },
      { duration: "15s", target: 0 },
    ],
    sla: {
      responseTimeMs: { avg: 1000, p90: 1500, p95: 1800, p99: 2500, max: 5000 },
      maxHttpFailurePct: 1,
      maxBusinessErrorPct: 1,
      minSuccessPct: 99,
    },
  },

  stress: {
    label: "Stress",
    description: "Step up to 20 users, to see where response times and errors start to degrade",
    stages: [
      { duration: "30s", target: 10 },
      { duration: "1m", target: 15 },
      { duration: "1m", target: 20 },
      { duration: "30s", target: 0 },
    ],
    sla: {
      responseTimeMs: { avg: 1500, p90: 2500, p95: 3000, p99: 4000, max: 8000 },
      maxHttpFailurePct: 2,
      maxBusinessErrorPct: 2,
      minSuccessPct: 97,
    },
  },
};

export function getProfile(name) {
  const profile = PROFILES[name];
  if (!profile) {
    throw new Error(
      `Unknown PROFILE "${name}". Use one of: ${Object.keys(PROFILES).join(", ")}`
    );
  }
  return { name, ...profile };
}
