const { addCustomer } = require("./customers");
const { addProduct } = require("./products");
const { changeStatus, createOrder } = require("./orders");

const PRODUCTS = [
  ["Electric kettle 1.7 L", "Kitchen", 890, 8],
  ["Pot 3 L", "Kitchen", 540, 10],
  ["Food containers, set of 3", "Kitchen", 210, 18],
  ["Mugs, set of 6", "Tableware", 360, 12],
  ["Towel set, 2 pcs", "Textiles", 420, 15],
  ["Blanket 140x200", "Textiles", 790, 7],
  ["Dish sponges, 5 pcs", "Household", 45, 40],
  ["Dish soap, 1 L", "Household", 72, 30],
  ["Hangers, 10 pcs", "Household", 180, 20],
  ["Desk lamp", "Household", 650, 3],
  ["Iron", "Household", 1190, 5],
  ["Clothes drying rack", "Household", 980, 4],
];

const CUSTOMERS = [
  ["Helen Parker", "050 123 45 67", "Uzhhorod", "12 Korzo St"],
  ["Mark Ellis", "0975552211", "Mukachevo", "4 Peace St"],
  ["Irene Berg", "063 777 88 99", "Uzhhorod", "8 Petefi Sq"],
  ["Thomas Wood", "0664411223", "Chop", "19 Main St"],
];

function seedIfEmpty(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
  if (count) return;

  const fill = db.transaction(() => {
    for (const row of PRODUCTS) addProduct(db, ...row);
    for (const row of CUSTOMERS) addCustomer(db, ...row);
  });
  fill();

  const productId = db.prepare("SELECT id FROM products WHERE name = ?");
  const customerId = db.prepare("SELECT id FROM customers WHERE name = ?");
  const product = (name) => productId.get(name).id;
  const customer = (name) => customerId.get(name).id;

  createOrder(
    db,
    customer("Helen Parker"),
    [
      { product_id: product("Electric kettle 1.7 L"), qty: 1 },
      { product_id: product("Dish sponges, 5 pcs"), qty: 2 },
    ],
    "call back after 6 pm",
    "2026-09-21 10:15:00"
  );
  const second = createOrder(
    db,
    customer("Mark Ellis"),
    [
      { product_id: product("Iron"), qty: 1 },
      { product_id: product("Hangers, 10 pcs"), qty: 1 },
    ],
    "",
    "2026-09-23 16:40:00"
  );
  changeStatus(db, second, "confirmed", "2026-09-23 17:05:00");

  const third = createOrder(
    db,
    customer("Irene Berg"),
    [
      { product_id: product("Blanket 140x200"), qty: 1 },
      { product_id: product("Towel set, 2 pcs"), qty: 2 },
    ],
    "leave it by the entrance",
    "2026-09-28 12:05:00"
  );
  changeStatus(db, third, "confirmed", "2026-09-28 15:00:00");
  changeStatus(db, third, "shipped", "2026-09-29 11:20:00");

  const fourth = createOrder(
    db,
    customer("Thomas Wood"),
    [
      { product_id: product("Mugs, set of 6"), qty: 1 },
      { product_id: product("Food containers, set of 3"), qty: 2 },
    ],
    "",
    "2026-10-01 09:30:00"
  );
  changeStatus(db, fourth, "confirmed", "2026-10-01 11:00:00");
  changeStatus(db, fourth, "shipped", "2026-10-01 14:10:00");
  changeStatus(db, fourth, "completed", "2026-10-01 18:00:00");
}

module.exports = { seedIfEmpty };
