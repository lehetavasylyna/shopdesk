const path = require("path");
const { openDb, prepare } = require("../src/db");
const { addCustomer } = require("../src/customers");
const { addProduct } = require("../src/products");
const { changeStatus, createOrder } = require("../src/orders");

const PRODUCTS = [
  ["Electric kettle 1.7 L", "Kitchen", 890, 14],
  ["Pot 3 L", "Kitchen", 540, 11],
  ["Frying pan 24 cm", "Kitchen", 690, 9],
  ["Cutting board", "Kitchen", 240, 15],
  ["Oven mitt", "Kitchen", 120, 20],
  ["Food containers, set of 3", "Kitchen", 210, 22],
  ["Mugs, set of 6", "Tableware", 360, 12],
  ["Glasses, set of 4", "Tableware", 310, 12],
  ["Towel set, 2 pcs", "Textiles", 420, 16],
  ["Blanket 140x200", "Textiles", 790, 8],
  ["Bed sheet 160x200", "Textiles", 560, 7],
  ["Bath mat", "Textiles", 280, 4],
  ["Dish sponges, 5 pcs", "Household", 45, 36],
  ["Dish soap, 1 L", "Household", 72, 28],
  ["Hangers, 10 pcs", "Household", 180, 18],
  ["Desk lamp", "Household", 650, 5],
  ["Iron", "Household", 1190, 6],
  ["Clothes drying rack", "Household", 980, 6],
  ["Laundry basket", "Household", 430, 8],
  ["Broom", "Household", 190, 3],
];

const CUSTOMERS = [
  ["Helen Parker", "050 123 45 67", "Uzhhorod", "12 Korzo St"],
  ["Mark Ellis", "097 555 22 11", "Mukachevo", "4 Peace St"],
  ["Irene Berg", "063 777 88 99", "Uzhhorod", "8 Petefi Sq"],
  ["Thomas Wood", "066 441 12 23", "Chop", "19 Main St"],
  ["Anna Kovacs", "050 321 67 90", "Uzhhorod", "3 Lermontova St"],
  ["Peter Nagy", "067 214 80 15", "Berehove", "11 Koshuta Sq"],
  ["Sofia March", "095 880 14 22", "Uzhhorod", "27 Voloshyna St"],
  ["Ivan Horvat", "066 903 55 41", "Mukachevo", "6 Myru Ave"],
  ["Laura Klein", "073 640 28 19", "Chop", "2 Station St"],
  ["Olena Savka", "097 118 43 76", "Uzhhorod", "15 Drugetiv St"],
  ["Andriy Fedak", "050 776 09 34", "Vynohradiv", "8 Miru St"],
  ["Marta Shepa", "063 255 71 08", "Uzhhorod", "21 Kapitulna St"],
];

function main() {
  const dbPath = path.join(__dirname, "..", "shop.db");
  const db = openDb(dbPath);
  prepare(db, false);

  const clear = db.transaction(() => {
    db.exec(`
      DELETE FROM order_events;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM customers;
      DELETE FROM products;
    `);
    try {
      db.exec("DELETE FROM sqlite_sequence");
    } catch (err) {
      // A brand new file has no sequence table yet.
    }
  });
  clear();

  const fillGoods = db.transaction(() => {
    for (const row of PRODUCTS) addProduct(db, ...row);
    for (const row of CUSTOMERS) addCustomer(db, ...row);
  });
  fillGoods();

  const productId = db.prepare("SELECT id FROM products WHERE name = ?");
  const customerId = db.prepare("SELECT id FROM customers WHERE name = ?");
  const product = (name) => productId.get(name).id;
  const customer = (name) => customerId.get(name).id;

  function order(person, lines, comment, at, delivery) {
    return createOrder(
      db,
      customer(person),
      lines.map((line) => ({ product_id: product(line[0]), qty: line[1] })),
      comment,
      at,
      delivery
    );
  }

  function move(id, steps) {
    for (const step of steps) changeStatus(db, id, step[0], step[1]);
  }

  const helen = order(
    "Helen Parker",
    [["Electric kettle 1.7 L", 1], ["Dish sponges, 5 pcs", 2]],
    "call back after 6 pm",
    "2026-09-21 10:15:00"
  );

  const mark = order(
    "Mark Ellis",
    [["Iron", 1], ["Hangers, 10 pcs", 1]],
    "",
    "2026-09-22 11:20:00"
  );
  move(mark, [["confirmed", "2026-09-22 12:05:00"]]);

  const irene = order(
    "Irene Berg",
    [["Blanket 140x200", 1], ["Towel set, 2 pcs", 2]],
    "leave it by the entrance",
    "2026-09-23 14:05:00",
    "courier"
  );
  move(irene, [
    ["confirmed", "2026-09-23 15:10:00"],
    ["shipped", "2026-09-24 09:40:00"],
  ]);

  const thomas = order(
    "Thomas Wood",
    [["Mugs, set of 6", 1], ["Food containers, set of 3", 2]],
    "",
    "2026-09-24 09:40:00"
  );
  move(thomas, [
    ["confirmed", "2026-09-24 10:15:00"],
    ["shipped", "2026-09-24 16:00:00"],
    ["completed", "2026-09-25 11:20:00"],
  ]);

  order(
    "Anna Kovacs",
    [["Frying pan 24 cm", 1], ["Oven mitt", 2]],
    "gift wrap if you have it",
    "2026-09-24 16:10:00"
  );

  const peter = order(
    "Peter Nagy",
    [["Desk lamp", 1], ["Cutting board", 1]],
    "",
    "2026-09-25 12:30:00"
  );
  move(peter, [["confirmed", "2026-09-25 13:10:00"]]);

  const sofiaWrong = order(
    "Sofia March",
    [["Bed sheet 160x200", 1], ["Bath mat", 1]],
    "wrong size",
    "2026-09-25 18:05:00"
  );
  move(sofiaWrong, [
    ["confirmed", "2026-09-25 18:20:00"],
    ["cancelled", "2026-09-26 09:00:00"],
  ]);

  const ivan = order(
    "Ivan Horvat",
    [["Clothes drying rack", 1], ["Laundry basket", 1]],
    "",
    "2026-09-28 10:00:00"
  );
  move(ivan, [
    ["confirmed", "2026-09-28 11:30:00"],
    ["shipped", "2026-09-29 08:50:00"],
  ]);

  const laura = order(
    "Laura Klein",
    [["Glasses, set of 4", 2], ["Mugs, set of 6", 1]],
    "",
    "2026-09-29 13:25:00"
  );
  move(laura, [
    ["confirmed", "2026-09-29 14:00:00"],
    ["shipped", "2026-09-30 10:10:00"],
    ["completed", "2026-09-30 18:40:00"],
  ]);

  order(
    "Olena Savka",
    [["Dish soap, 1 L", 3], ["Dish sponges, 5 pcs", 4], ["Broom", 1]],
    "",
    "2026-09-29 17:40:00"
  );

  const andriy = order(
    "Andriy Fedak",
    [["Pot 3 L", 1], ["Frying pan 24 cm", 1]],
    "call before delivery",
    "2026-09-30 11:15:00"
  );
  move(andriy, [["confirmed", "2026-09-30 12:00:00"]]);

  const marta = order(
    "Marta Shepa",
    [["Electric kettle 1.7 L", 1], ["Desk lamp", 1]],
    "leave with the neighbour",
    "2026-10-01 09:50:00",
    "courier"
  );
  move(marta, [
    ["confirmed", "2026-10-01 10:20:00"],
    ["shipped", "2026-10-01 14:05:00"],
    ["completed", "2026-10-01 19:10:00"],
  ]);

  const helenAgain = order(
    "Helen Parker",
    [["Blanket 140x200", 1], ["Bath mat", 1]],
    "",
    "2026-10-01 15:20:00"
  );
  move(helenAgain, [
    ["confirmed", "2026-10-01 15:40:00"],
    ["shipped", "2026-10-02 09:15:00"],
  ]);

  const sofiaMistake = order(
    "Sofia March",
    [["Broom", 1]],
    "ordered by mistake",
    "2026-09-26 09:10:00"
  );
  move(sofiaMistake, [["cancelled", "2026-09-26 09:25:00"]]);

  const counts = {
    customers: db.prepare("SELECT COUNT(*) AS n FROM customers").get().n,
    products: db.prepare("SELECT COUNT(*) AS n FROM products").get().n,
    orders: db.prepare("SELECT COUNT(*) AS n FROM orders").get().n,
  };
  const low = db.prepare("SELECT name, stock FROM products WHERE stock <= 3 ORDER BY stock, name").all();

  db.close();
  console.log("Mock data written to shop.db");
  console.log(counts.customers + " customers, " + counts.products + " products, " + counts.orders + " orders");
  console.log("Low stock: " + low.map((row) => row.name + " (" + row.stock + ")").join(", "));
  console.log("First order id is " + helen);
}

main();
