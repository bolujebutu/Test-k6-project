# k6 API Performance Testing Demo

A small, structured [k6](https://k6.io) project that load-tests a REST API, checks every response against business rules, compares the results with an SLA, and writes a console summary plus an HTML report.

It targets **QuickPizza**, a free public demo API from Grafana Labs (`POST /api/pizza`), so anyone can clone it and run it.

## What it demonstrates

- **Test profiles with SLAs.** Smoke, baseline, load and stress profiles, each with its own load shape and targets for response time (avg, p90, p95, p99, max), HTTP failure rate, business error rate and success rate.
- **Business-level validation, not just status codes.** A response can be `HTTP 200` and still be wrong. Each pizza returned is checked against the restrictions that were sent: topping count, calorie limit, vegetarian flag, excluded ingredients and excluded tools. HTTP failures and business errors are tracked as separate metrics.
- **Dynamic test data.** Every request sends a different, valid set of restrictions and a unique request reference.
- **k6 thresholds.** The SLA is enforced by k6 itself, so a run exits with a non-zero code when targets are missed, which suits CI.
- **Reporting.** A colour-coded console summary, a self-contained HTML report (no external files, light and dark mode) and a JSON summary.
- **CI.** A GitHub Actions workflow runs the smoke test on every push and uploads the report.
- **Fault injection.** A small local stub of the API can return deliberately wrong pizzas, to prove the business-error checks catch them.

## Project structure

```
config/profiles.js      Load shapes and SLA targets for each profile
helpers/data.js         Random test-data generators
src/pizza-test.js       The test: request, business-rule validation, metrics, thresholds
reporter/summary.js     Compares results with the SLA (PASS/FAIL and variance)
reporter/cli.js         Console summary
reporter/html.js        HTML report
mock/quickpizza_stub.py Local stand-in API with optional fault injection
reports/                Generated reports (git-ignored)
```

## Run it

1. [Install k6](https://grafana.com/docs/k6/latest/set-up/install-k6/).
2. From the project folder:

```bash
k6 run -e PROFILE=smoke src/pizza-test.js
```

3. Open `reports/smoke-report.html` in a browser.

Other profiles: `baseline`, `load`, `stress`.

| Variable    | Default                            | Purpose                                |
|-------------|------------------------------------|----------------------------------------|
| `PROFILE`   | `smoke`                            | Which profile to run                   |
| `BASE_URL`  | `https://quickpizza.grafana.com`   | API to test                            |
| `API_TOKEN` | `abcdef0123456789` (public demo)   | QuickPizza accepts any 16-char token   |
| `TESTER`    | `Moboluwaduro Jebutu`              | Name shown on the reports              |

> QuickPizza's public instance is meant for small-scale tests, so the profiles keep user counts low (20 at most). For heavier runs, start QuickPizza locally with Docker (`docker run --rm -p 3333:3333 ghcr.io/grafana/quickpizza-local:latest`) and pass `-e BASE_URL=http://localhost:3333`.

### Offline run with fault injection

```bash
python mock/quickpizza_stub.py 8000 0.15     # 15% of 200 responses break the rules
k6 run -e PROFILE=smoke -e BASE_URL=http://127.0.0.1:8000 src/pizza-test.js
```

The report then shows **0% HTTP failures but about 15% business errors**, and the run fails its SLA. That is the kind of defect a status-code-only check would miss.

## Sample console output

```
  RELIABILITY                   Target        Actual   Result
--------------------------------------------------------------------
  Success rate %                    99         95.83   FAIL  -3.2%
  HTTP failure rate %                1             0   PASS  -100%
  Business error rate %              1          4.17   FAIL  +316.67%

  OVERALL: FAIL - one or more SLA targets missed
```
