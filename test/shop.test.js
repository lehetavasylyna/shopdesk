const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const db = require("../src/db");
const { createApp } = require("../src/server");

function tempDb(seed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  const database = db.openDb(dbPath);
  db.prepare(database, seed);
  return database;
}

function addBuyer(database, name, phone) {
  return db.addCustomer(database, name || "Olga Test", phone || "0501112233", "Uzhhorod", "3 Voloshyna St");
}

function addItem(database, name, price, stock) {
  return db.addProduct(database, name || "Sponge", "Household", price || 45, stock === undefined ? 5 : stock);
}

test("date is shown as day.month.year", () => {
  assert.equal(db.showDate("2026-09-21 10:15:00"), "21.09.2026 10:15");
});

test("a short phone and a zero price are rejected", () => {
  const database = tempDb(false);
  try {
    assert.throws(() => addBuyer(database, "Olga", "123"), /10/);
    assert.throws(() => db.addProduct(database, "Sponge", "Household", 0, 5), /zero/);
  } finally {
    database.close();
  }
});

test("an order reduces stock and keeps the old price", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = db.createOrder(database, buyer, [
      { product_id: item, qty: 2 },
      { product_id: item, qty: 1 },
    ]);
    assert.equal(db.getProduct(database, item).stock, 2);
    let pack = db.getOrder(database, orderId);
    assert.equal(pack.order.total, 135);
    assert.equal(pack.items[0].qty, 3);
    assert.equal(pack.items[0].price, 45);
    assert.equal(pack.events.length, 1);

    db.updateProduct(database, item, "Sponge", "Household", 90, 2);
    pack = db.getOrder(database, orderId);
    assert.equal(pack.items[0].price, 45);
    assert.equal(pack.order.total, 135);
  } finally {
    database.close();
  }
});

test("if the second line does not fit, nothing is saved", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const first = addItem(database, "Iron", 1190, 4);
    const second = addItem(database, "Lamp", 650, 1);
    assert.throws(
      () =>
        db.createOrder(database, buyer, [
          { product_id: first, qty: 1 },
          { product_id: second, qty: 2 },
        ]),
      /Lamp/
    );
    assert.equal(db.getProduct(database, first).stock, 4);
    assert.equal(db.getProduct(database, second).stock, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
  } finally {
    database.close();
  }
});

test("an empty order is not saved", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    assert.throws(() => db.createOrder(database, buyer, [{ product_id: "", qty: "1" }]), /at least one/);
  } finally {
    database.close();
  }
});

test("statuses move in order, and cancel puts the stock back", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = db.createOrder(database, buyer, [{ product_id: item, qty: 2 }]);
    assert.throws(() => db.changeStatus(database, orderId, "completed"), /Cannot/);
    db.changeStatus(database, orderId, "confirmed", "2026-09-22 09:00:00");
    db.changeStatus(database, orderId, "cancelled", "2026-09-22 09:10:00");
    assert.equal(db.getProduct(database, item).stock, 5);
    const pack = db.getOrder(database, orderId);
    assert.equal(pack.order.status, "cancelled");
    assert.deepEqual(
      pack.events.map((row) => row.status),
      ["new", "confirmed", "cancelled"]
    );
    assert.throws(() => db.changeStatus(database, orderId, "new"), /Cannot/);
  } finally {
    database.close();
  }
});

test("a shipped order cannot be cancelled", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = db.createOrder(database, buyer, [{ product_id: item, qty: 1 }]);
    db.changeStatus(database, orderId, "confirmed");
    db.changeStatus(database, orderId, "shipped");
    assert.throws(() => db.changeStatus(database, orderId, "cancelled"), /Cannot/);
    assert.equal(db.getProduct(database, item).stock, 4);
    assert.equal(db.getOrder(database, orderId).order.status, "shipped");
  } finally {
    database.close();
  }
});

test("search finds a name in lower case", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database, "Helen Parker", "050 123 45 67");
    const item = addItem(database);
    db.createOrder(database, buyer, [{ product_id: item, qty: 1 }]);
    assert.equal(db.listOrders(database, null, "helen").length, 1);
    assert.equal(db.listOrders(database, null, "123 45").length, 1);
    assert.equal(db.listOrders(database, "completed").length, 0);
    assert.equal(db.listOrders(database, "new").length, 1);
  } finally {
    database.close();
  }
});

test("a product that is on an order cannot be deleted", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const used = addItem(database, "Blanket", 790, 4);
    const free = addItem(database, "Hangers", 180, 10);
    db.createOrder(database, buyer, [{ product_id: used, qty: 1 }]);
    assert.throws(() => db.deleteProduct(database, used), /order/);
    assert.ok(db.getProduct(database, used));
    db.deleteProduct(database, free);
    assert.equal(db.getProduct(database, free), undefined);
  } finally {
    database.close();
  }
});

test("the sample data is not inserted twice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  let database = db.openDb(dbPath);
  db.prepare(database, true);
  database.close();
  database = db.openDb(dbPath);
  db.prepare(database, true);
  try {
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 4);
    const totals = {};
    for (const row of database.prepare("SELECT id, total FROM orders").all()) totals[row.id] = row.total;
    assert.equal(totals[1], 980);
    assert.equal(totals[2], 1370);
    assert.equal(totals[3], 1630);
    assert.equal(totals[4], 780);
    assert.equal(
      database.prepare("SELECT stock FROM products WHERE name = 'Desk lamp'").get().stock,
      3
    );
    assert.equal(
      database.prepare("SELECT stock FROM products WHERE name = 'Electric kettle 1.7 L'").get().stock,
      7
    );
  } finally {
    database.close();
  }
});

test("api opens and a new order reduces the lamp stock", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  const app = createApp(dbPath, { seed: true });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port;

  try {
    for (const url of ["/api/orders", "/api/products", "/api/customers", "/api/orders/1", "/api/products/10"]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 200, url);
    }
    const missing = await fetch(base + "/api/orders/999");
    assert.equal(missing.status, 404);

    const home = await (await fetch(base + "/api/orders")).json();
    assert.ok(home.orders.some((order) => order.customer_name === "Helen Parker"));
    assert.ok(home.orders.some((order) => String(order.created_at).startsWith("2026-09-21")));

    const products = await (await fetch(base + "/api/products")).json();
    const lamp = products.products.find((product) => product.name === "Desk lamp");
    assert.equal(lamp.stock, 3);

    const created = await fetch(base + "/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: "new",
        name: "Nina Harris",
        phone: "0509998877",
        city: "Uzhhorod",
        address: "5 Fentsika St",
        comment: "after lunch",
        lines: [
          { product_id: 10, qty: 1 },
          { product_id: "", qty: 1 },
        ],
      }),
    });
    assert.equal(created.status, 201);
    const saved = await created.json();
    const order = await (await fetch(base + "/api/orders/" + saved.id)).json();
    assert.equal(order.order.customer_name, "Nina Harris");
    assert.equal(app.locals.db.prepare("SELECT stock FROM products WHERE id = 10").get().stock, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.db.close();
  }
});

test("the api does not save an order when stock is short", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  const app = createApp(dbPath, { seed: false });
  addItem(app.locals.db, "Sponge", 45, 2);
  addBuyer(app.locals.db);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;

  try {
    const response = await fetch("http://127.0.0.1:" + port + "/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: 1,
        lines: [{ product_id: 1, qty: 5 }],
      }),
    });
    const data = await response.json();
    assert.equal(response.status, 400);
    assert.ok(data.error.includes("Not enough"));
    assert.equal(app.locals.db.prepare("SELECT stock FROM products WHERE id = 1").get().stock, 2);
    assert.equal(app.locals.db.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.db.close();
  }
});
