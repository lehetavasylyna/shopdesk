const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { openDb, prepare } = require("../src/db");
const { showDate } = require("../src/time");
const { addCustomer } = require("../src/customers");
const { addProduct, deleteProduct, getProduct, updateProduct } = require("../src/products");
const { changeStatus, createOrder, getOrder, listOrders, updateOrder } = require("../src/orders");
const { customerWithOrders } = require("../src/customers");
const { summary } = require("../src/summary");
const { createApp } = require("../src/server");

function tempDb(seed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  const database = openDb(dbPath);
  prepare(database, seed);
  return database;
}

function addBuyer(database, name, phone) {
  return addCustomer(database, name || "Olga Test", phone || "0501112233", "Uzhhorod", "3 Voloshyna St");
}

function addItem(database, name, price, stock) {
  return addProduct(database, name || "Sponge", "Household", price || 45, stock === undefined ? 5 : stock);
}

test("date is shown as day.month.year", () => {
  assert.equal(showDate("2026-09-21 10:15:00"), "21.09.2026 10:15");
});

test("a short phone and a zero price are rejected", () => {
  const database = tempDb(false);
  try {
    assert.throws(() => addBuyer(database, "Olga", "123"), /10/);
    assert.throws(() => addProduct(database, "Sponge", "Household", 0, 5), /zero/);
  } finally {
    database.close();
  }
});

test("an order reduces stock and keeps the old price", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = createOrder(database, buyer, [
      { product_id: item, qty: 2 },
      { product_id: item, qty: 1 },
    ]);
    assert.equal(getProduct(database, item).stock, 2);
    let pack = getOrder(database, orderId);
    assert.equal(pack.order.total, 135);
    assert.equal(pack.items[0].qty, 3);
    assert.equal(pack.items[0].price, 45);
    assert.equal(pack.events.length, 1);

    updateProduct(database, item, "Sponge", "Household", 90, 2);
    pack = getOrder(database, orderId);
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
        createOrder(database, buyer, [
          { product_id: first, qty: 1 },
          { product_id: second, qty: 2 },
        ]),
      /Lamp/
    );
    assert.equal(getProduct(database, first).stock, 4);
    assert.equal(getProduct(database, second).stock, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
  } finally {
    database.close();
  }
});

test("an empty order is not saved", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    assert.throws(() => createOrder(database, buyer, [{ product_id: "", qty: "1" }]), /at least one/);
  } finally {
    database.close();
  }
});

test("statuses move in order, and cancel puts the stock back", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = createOrder(database, buyer, [{ product_id: item, qty: 2 }]);
    assert.throws(() => changeStatus(database, orderId, "completed"), /Cannot/);
    changeStatus(database, orderId, "confirmed", "2026-09-22 09:00:00");
    changeStatus(database, orderId, "cancelled", "2026-09-22 09:10:00");
    assert.equal(getProduct(database, item).stock, 5);
    const pack = getOrder(database, orderId);
    assert.equal(pack.order.status, "cancelled");
    assert.deepEqual(
      pack.events.map((row) => row.status),
      ["new", "confirmed", "cancelled"]
    );
    assert.throws(() => changeStatus(database, orderId, "new"), /Cannot/);
  } finally {
    database.close();
  }
});

test("a shipped order cannot be cancelled", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = createOrder(database, buyer, [{ product_id: item, qty: 1 }]);
    changeStatus(database, orderId, "confirmed");
    changeStatus(database, orderId, "shipped");
    assert.throws(() => changeStatus(database, orderId, "cancelled"), /Cannot/);
    assert.equal(getProduct(database, item).stock, 4);
    assert.equal(getOrder(database, orderId).order.status, "shipped");
  } finally {
    database.close();
  }
});

test("search finds a name in lower case", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database, "Helen Parker", "050 123 45 67");
    const item = addItem(database);
    createOrder(database, buyer, [{ product_id: item, qty: 1 }]);
    assert.equal(listOrders(database, null, "helen").length, 1);
    assert.equal(listOrders(database, null, "123 45").length, 1);
    assert.equal(listOrders(database, null, "uzhhorod").length, 1);
    assert.equal(listOrders(database, "completed").length, 0);
    assert.equal(listOrders(database, "new").length, 1);
  } finally {
    database.close();
  }
});

test("a date range and a total sort narrow the list", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const cheap = addItem(database, "Sponge", 45, 5);
    const dear = addItem(database, "Iron", 1190, 2);
    createOrder(database, buyer, [{ product_id: cheap, qty: 1 }], "", "2026-09-21 10:00:00");
    createOrder(database, buyer, [{ product_id: dear, qty: 1 }], "call first", "2026-09-28 10:00:00");

    assert.equal(listOrders(database, null, "", { from: "2026-09-25" }).length, 1);
    assert.equal(listOrders(database, null, "", { to: "2026-09-22" }).length, 1);
    assert.equal(listOrders(database, null, "call first").length, 1);
    const sorted = listOrders(database, null, "", { sort: "total-asc" });
    assert.equal(sorted[0].total, 45);
    assert.equal(sorted[1].total, 1190);
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
    createOrder(database, buyer, [{ product_id: used, qty: 1 }]);
    assert.throws(() => deleteProduct(database, used), /order/);
    assert.ok(getProduct(database, used));
    deleteProduct(database, free);
    assert.equal(getProduct(database, free), undefined);
  } finally {
    database.close();
  }
});

test("the sample data is not inserted twice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  let database = openDb(dbPath);
  prepare(database, true);
  database.close();
  database = openDb(dbPath);
  prepare(database, true);
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

test("an open order can be rewritten, a shipped one cannot", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const sponge = addItem(database, "Sponge", 45, 5);
    const soap = addItem(database, "Soap", 80, 2);
    const orderId = createOrder(database, buyer, [{ product_id: sponge, qty: 2 }]);
    updateProduct(database, sponge, "Sponge", "Household", 90, 3);

    updateOrder(database, orderId, [
      { product_id: sponge, qty: 1 },
      { product_id: soap, qty: 1 },
    ], "call in the morning");

    const pack = getOrder(database, orderId);
    assert.equal(pack.order.comment, "call in the morning");
    assert.equal(pack.order.total, 45 + 80);
    assert.equal(pack.items.find((row) => row.product_id === sponge).price, 45);
    assert.equal(pack.items.find((row) => row.product_id === soap).price, 80);
    assert.equal(getProduct(database, sponge).stock, 4);
    assert.equal(getProduct(database, soap).stock, 1);

    assert.throws(
      () => updateOrder(database, orderId, [{ product_id: sponge, qty: 20 }], "too many"),
      /Sponge/
    );
    assert.equal(getOrder(database, orderId).order.total, 125);
    assert.equal(getProduct(database, sponge).stock, 4);

    changeStatus(database, orderId, "confirmed");
    changeStatus(database, orderId, "shipped");
    assert.throws(() => updateOrder(database, orderId, [{ product_id: sponge, qty: 1 }], ""), /on its way/);
    assert.equal(getProduct(database, sponge).stock, 4);
  } finally {
    database.close();
  }
});

test("summary and a customer's orders", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const other = addBuyer(database, "Mark Ellis", "0502223344");
    const item = addItem(database, "Lamp", 650, 3);
    createOrder(database, buyer, [{ product_id: item, qty: 1 }]);
    const second = createOrder(database, buyer, [{ product_id: item, qty: 1 }]);
    changeStatus(database, second, "cancelled");

    const report = summary(database);
    const byName = {};
    for (const row of report.byStatus) byName[row.status] = row;
    assert.equal(byName.new.count, 1);
    assert.equal(byName.new.total, 650);
    assert.equal(byName.cancelled.count, 1);
    assert.equal(report.lowStock[0].name, "Lamp");
    assert.equal(report.lowStock[0].stock, 2);

    const pack = customerWithOrders(database, buyer);
    assert.equal(pack.orders.length, 2);
    assert.equal(customerWithOrders(database, other).orders.length, 0);
    assert.equal(customerWithOrders(database, 99), null);
  } finally {
    database.close();
  }
});

test("api opens and a new order reduces the lamp stock", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  const app = createApp(dbPath, { seed: true, auth: false });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port;

  try {
    for (const url of ["/api/orders", "/api/products", "/api/customers", "/api/orders/1", "/api/products/10", "/api/summary", "/api/customers/1"]) {
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
  const app = createApp(dbPath, { seed: false, auth: false });
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

test("courier adds 80, and an open order older than two days is waiting", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = createOrder(
      database,
      buyer,
      [{ product_id: item, qty: 2 }],
      "",
      "2026-09-21 10:00:00",
      "courier"
    );
    let pack = getOrder(database, orderId);
    assert.equal(pack.order.delivery, "courier");
    assert.equal(pack.order.delivery_fee, 80);
    assert.equal(pack.order.total, 170);

    updateOrder(database, orderId, [{ product_id: item, qty: 2 }], "", "pickup");
    pack = getOrder(database, orderId);
    assert.equal(pack.order.total, 90);
    assert.equal(pack.order.delivery_fee, 0);

    changeStatus(database, orderId, "confirmed", "2026-09-21 12:00:00", "Shop desk");
    pack = getOrder(database, orderId);
    assert.equal(pack.events[1].staff_name, "Shop desk");
    const later = Date.parse("2026-09-25T12:00:00");
    assert.equal(listOrders(database, null, "", { now: later })[0].waiting, 1);

    changeStatus(database, orderId, "shipped", "2026-09-25 13:00:00", "Shop desk");
    assert.equal(listOrders(database, null, "", { now: later })[0].waiting, 0);
    assert.throws(() => createOrder(database, buyer, [{ product_id: item, qty: 1 }], "", null, "post"), /courier/);
  } finally {
    database.close();
  }
});

test("the desk stays closed until the password is right", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const dbPath = path.join(dir, "shop.db");
  const app = createApp(dbPath, { seed: false, auth: true });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;

  try {
    const closed = await fetch(base + "/api/orders");
    assert.equal(closed.status, 401);

    const wrong = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: "desk", password: "nope" }),
    });
    assert.equal(wrong.status, 400);

    const ok = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: "desk", password: "shelf2026" }),
    });
    assert.equal(ok.status, 200);
    const cookie = ok.headers.get("set-cookie").split(";")[0];
    const open = await fetch(base + "/api/products", { headers: { cookie } });
    assert.equal(open.status, 200);

    await fetch(base + "/api/logout", { method: "POST", headers: { cookie } });
    const again = await fetch(base + "/api/orders", { headers: { cookie } });
    assert.equal(again.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.db.close();
  }
});
