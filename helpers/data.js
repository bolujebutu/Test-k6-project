// Test data generators: every request gets different, valid input,
// so we exercise the API properly instead of replaying one request.

// Real topping names from the QuickPizza catalog. Base ingredients (olive oil, tomato,
// mozzarella) are never excluded: the API always adds one of each.
const INGREDIENTS = ["Pepperoni", "Mushrooms", "Onions", "Sausage", "Bacon", "Black olives", "Pineapple", "Ham", "Salami", "Chicken"];
const TOOLS = ["Knife", "Pizza cutter", "Scissors"];

export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const pickSome = (list, maxCount) => {
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, randomInt(0, maxCount));
};

export const uniqueRef = (prefix = "REQ") =>
  `${prefix}-${Date.now()}-${randomInt(1000, 9999)}`;

// Build a random but valid set of pizza restrictions for POST /api/pizza
export const pizzaRestrictions = () => {
  const minToppings = randomInt(2, 3);
  return {
    maxCaloriesPerSlice: randomInt(500, 1000),
    mustBeVegetarian: Math.random() < 0.3,
    excludedIngredients: pickSome(INGREDIENTS, 2),
    excludedTools: pickSome(TOOLS, 1),
    maxNumberOfToppings: randomInt(minToppings + 1, 6),
    minNumberOfToppings: minToppings,
  };
};
