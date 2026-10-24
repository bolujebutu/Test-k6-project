# Local stand-in for the QuickPizza /api/pizza endpoint, for offline runs and fault injection.
# Usage: python mock/quickpizza_stub.py 8000 [bug_rate]
#   bug_rate (0-1) = share of HTTP 200 responses that deliberately break the restrictions,
#   to prove the business-error checks catch them.
import json, random, time, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ING = [("Mozzarella", 80, True), ("Pepperoni", 120, False), ("Bacon", 140, False), ("Mushrooms", 30, True),
       ("Olives", 40, True), ("Pineapple", 50, True), ("Anchovies", 60, False), ("Basil", 5, True), ("Tomato", 20, True)]
BUG_RATE = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        if not self.headers.get("Authorization", "").lower().startswith("token "):
            self.send_response(401); self.end_headers(); return
        r = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        time.sleep(random.uniform(0.05, 0.4))
        pool = [i for i in ING if i[0] not in r["excludedIngredients"] and (i[2] or not r["mustBeVegetarian"])]
        n = random.randint(r["minNumberOfToppings"], min(r["maxNumberOfToppings"], len(pool)))
        if random.random() < BUG_RATE: n = r["maxNumberOfToppings"] + 1; pool = ING
        ings = random.sample(pool, min(n, len(pool)))
        tool = random.choice([t for t in ["Knife", "Pizza cutter", "Scissors"] if t not in r["excludedTools"]])
        body = {"pizza": {"id": random.randint(1, 10**6), "name": "Test pizza", "dough": {"id": 1, "name": "Thin", "caloriesPerSlice": 200},
                "ingredients": [{"id": k, "name": i[0], "caloriesPerSlice": i[1], "vegetarian": i[2]} for k, i in enumerate(ings)], "tool": tool},
                "calories": min(200 + sum(i[1] for i in ings), r["maxCaloriesPerSlice"]), "vegetarian": all(i[2] for i in ings)}
        out = json.dumps(body).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out)

ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
