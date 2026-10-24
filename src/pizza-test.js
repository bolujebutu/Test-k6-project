// Performance test for the QuickPizza demo API (POST /api/pizza).
//
// Run:   k6 run -e PROFILE=smoke src/pizza-test.js
// Then open reports/<profile>-report.html in a browser.
//
// The key idea: an API can return HTTP 200 and still give a wrong answer.
// So we track two kinds of failure separately:
//   - HTTP failures:     the request itself failed (timeouts, 4xx, 5xx)
//   - Business errors:   HTTP 200, but the pizza breaks the restrictions we asked for

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { getProfile } from "../config/profiles.js";
import { pizzaRestrictions, uniqueRef } from "../helpers/data.js";
import { buildSummary } from "../reporter/summary.js";
import { cliReport } from "../reporter/cli.js";
import { htmlReport } from "../reporter/html.js";

const BASE_URL = __ENV.BASE_URL || "https://quickpizza.grafana.com";
// QuickPizza accepts any 16-character token. This is the public demo token, not a secret.
const TOKEN = __ENV.API_TOKEN || "abcdef0123456789";
const PROFILE = getProfile(__ENV.PROFILE || "smoke");
const TESTER = __ENV.TESTER || "Moboluwaduro Jebutu";
const { sla } = PROFILE;

// ---------- Custom metrics ----------
const pizzaDuration = new Trend("pizza_response_time", true);
const businessErrors = new Rate("business_errors");
const successful = new Counter("successful_requests");
const failed = new Counter("failed_requests");

// One counter per failure reason, so reports show *why* requests failed, not just how many.
export const FAILURE_RULES = {
  http_error: "HTTP error (non-200 or timeout)",
  no_pizza: "No pizza in response",
  invalid_json: "Response was not valid JSON",
  too_many_toppings: "More toppings than the requested maximum",
  calories: "Calories over requested limit",
  vegetarian: "Not vegetarian when requested",
  excluded_ingredient: "Contains an excluded ingredient",
  excluded_tool: "Uses an excluded tool",
  // Known API issue, reported but not counted as a failure (see README "Findings")
  fewer_toppings: "Known issue: fewer toppings than the requested minimum",
};

// Rules listed here are tracked and reported, but don't fail a request or the SLA.
export const KNOWN_ISSUES = ["fewer_toppings"];

// The API always adds 3 base ingredients (olive oil, tomato, mozzarella) before the toppings.
const BASE_INGREDIENTS = 3;
const failureCounters = Object.fromEntries(
  Object.keys(FAILURE_RULES).map((rule) => [rule, new Counter(`fail_${rule}`)])
);

// ---------- k6 options: load shape + pass/fail thresholds from the SLA ----------
export const options = {
  scenarios: {
    pizza_recommendation: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: PROFILE.stages,
      gracefulRampDown: "10s",
      tags: { profile: PROFILE.name },
    },
  },
  thresholds: {
    http_req_failed: [`rate<${sla.maxHttpFailurePct / 100}`],
    business_errors: [`rate<${sla.maxBusinessErrorPct / 100}`],
    pizza_response_time: [
      `avg<${sla.responseTimeMs.avg}`,
      `p(95)<${sla.responseTimeMs.p95}`,
      `p(99)<${sla.responseTimeMs.p99}`,
    ],
  },
  summaryTrendStats: ["min", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ---------- Business rules: is the pizza we got back actually valid? ----------
export function validatePizza(body, rules) {
  // Each problem is { rule, detail } so it can be both counted and logged.
  const problems = [];
  const add = (rule, detail) => problems.push({ rule, detail });
  const pizza = body && body.pizza;
  if (!pizza || !pizza.id || !pizza.name) return [{ rule: "no_pizza", detail: "No pizza returned" }];

  const ingredients = pizza.ingredients || [];
  const names = ingredients.map((i) => i.name);

  const toppings = ingredients.length - BASE_INGREDIENTS;
  if (toppings > rules.maxNumberOfToppings) {
    add("too_many_toppings", `${toppings} toppings, max requested ${rules.maxNumberOfToppings}`);
  }
  if (toppings < rules.minNumberOfToppings) {
    add("fewer_toppings", `${toppings} toppings, min requested ${rules.minNumberOfToppings}`);
  }
  if (typeof body.calories === "number" && body.calories > rules.maxCaloriesPerSlice) {
    add("calories", `Calories ${body.calories} over limit ${rules.maxCaloriesPerSlice}`);
  }
  if (rules.mustBeVegetarian && body.vegetarian === false) {
    add("vegetarian", "Vegetarian requested but pizza is not vegetarian");
  }
  const banned = names.filter((n) => rules.excludedIngredients.includes(n));
  if (banned.length) add("excluded_ingredient", `Contains excluded ingredient(s): ${banned.join(", ")}`);
  if (rules.excludedTools.includes(pizza.tool)) add("excluded_tool", `Uses excluded tool: ${pizza.tool}`);

  return problems;
}

// ---------- The test: one virtual user's journey, repeated ----------
export default function () {
  const rules = pizzaRestrictions();
  const ref = uniqueRef("PIZZA");

  const res = http.post(`${BASE_URL}/api/pizza`, JSON.stringify(rules), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `token ${TOKEN}`,
      "X-Request-Ref": ref,
    },
    tags: { name: "POST /api/pizza" },
    timeout: "30s",
  });

  pizzaDuration.add(res.timings.duration);

  let problems = [];
  if (res.status === 200) {
    try {
      problems = validatePizza(res.json(), rules);
    } catch (e) {
      problems = [{ rule: "invalid_json", detail: "Response was not valid JSON" }];
    }
  }
  // Real failures exclude known issues; known issues are still counted and logged.
  const failures = problems.filter((p) => !KNOWN_ISSUES.includes(p.rule));
  if (res.status === 200) businessErrors.add(failures.length > 0);
  problems.forEach((p) => failureCounters[p.rule].add(1));

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "pizza meets all restrictions": () => res.status === 200 && failures.length === 0,
    [`response time < ${sla.responseTimeMs.p95} ms`]: (r) => r.timings.duration < sla.responseTimeMs.p95,
  });

  if (res.status === 200 && failures.length === 0) {
    successful.add(1);
  } else {
    failed.add(1);
    if (res.status !== 200) failureCounters.http_error.add(1);
    const reason = res.status !== 200
      ? `HTTP ${res.status}${res.error ? " (" + res.error + ")" : ""}`
      : failures.map((p) => p.detail).join("; ");
    console.warn(`[${ref}] FAILED: ${reason}`);
  }

  sleep(1); // think time between requests, like a real user
}

// ---------- Reports: console summary + HTML file ----------
export function handleSummary(data) {
  const summary = buildSummary(data, PROFILE, { baseUrl: BASE_URL, tester: TESTER, failureRules: FAILURE_RULES, knownIssues: KNOWN_ISSUES });
  return {
    stdout: cliReport(summary),
    [`reports/${PROFILE.name}-report.html`]: htmlReport(summary),
    [`reports/${PROFILE.name}-summary.json`]: JSON.stringify(summary, null, 2),
  };
}
