# Local stand-in for the QuickPizza /api/pizza endpoint, for offline runs and fault injection.
# Usage: python mock/quickpizza_stub.py 8000 [bug_rate]
#   bug_rate (0-1) = share of HTTP 200 responses that deliberately break the restrictions,
#   to prove the business-error checks catch them.
#
# Mirrors the real API's behaviour: 3 base ingredients (olive oil, tomato, mozzarella),
# then toppings picked at random with duplicates merged, so a pizza can have fewer
# toppings than the requested minimum (the known issue the test reports).
import json, random, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASES = [("Extra-virgin olive oil", 40, True), ("Tomato", 30, True), ("Mozzarella", 100, True)]
TOPPINGS = [("Pepperoni", 120, False), ("Mushrooms", 30, True), ("Onions", 20, True), ("Sausage", 130, False),
            ("Bacon", 140, False), ("Black olives", 40, True), ("Pineapple", 50, True), ("Ham", 110, False),
            ("Salami", 125, False), ("Chicken", 90, False), ("Spinach", 15, True), ("Garlic", 10, True),
            ("Jalapenos", 10, True), ("Feta cheese", 70, True), ("Zucchini", 15, True), ("Fresh basil", 5, True)]
TOOLS = ["Knife", "Pizza cutter", "Scissors"]
BUG_RATE = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        if not self.headers.get("Authorization", "").lower().startswith("token "):
            self.send_response(401)
            self.end_headers()
            return
        r = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        time.sleep(random.uniform(0.05, 0.4))

        allowed = lambda i: i[0] not in r["excludedIngredients"] and (i[2] or not r["mustBeVegetarian"])
        tops = [t for t in TOPPINGS if allowed(t)]
        n = random.randint(r["minNumberOfToppings"], r["maxNumberOfToppings"])
        picked = {t[0]: t for t in (random.choice(tops) for _ in range(n))}  # duplicates merge, like the real API
        ings = BASES + list(picked.values())

        if random.random() < BUG_RATE:  # fault injection: too many toppings, ignoring exclusions
            ings = BASES + random.sample(TOPPINGS, min(len(TOPPINGS), r["maxNumberOfToppings"] + 2))

        tool = random.choice([t for t in TOOLS if t not in r["excludedTools"]])
        calories = 200 + sum(i[1] for i in ings) // 4
        body = {
            "pizza": {
                "id": random.randint(1, 10**6), "name": "Test pizza",
                "dough": {"id": 1, "name": "Thin", "caloriesPerSlice": 200},
                "ingredients": [{"id": k, "name": i[0], "caloriesPerSlice": i[1], "vegetarian": i[2]} for k, i in enumerate(ings)],
                "tool": tool,
            },
            "calories": calories,
            "vegetarian": all(i[2] for i in ings),
        }
        out = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
