const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { openDb, prepare } = require("../src/db");
const { showDate } = require("../src/time");
const { addCustomer, listCustomers } = require("../src/customers");
const { addProduct, deleteProduct, getProduct, listProducts, updateProduct } = require("../src/products");
const { changeStatus, createOrder, getOrder, listOrders, placeOrder, updateOrder } = require("../src/orders");
const { customerWithOrders } = require("../src/customers");
const { summary } = require("../src/summary");
const { ensureStaff } = require("../src/auth");
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
  assert.equal(showDate("2026-09-21"), "21.09.2026");
  assert.equal(showDate(""), "");
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

    const helen = addBuyer(database, "Helen Parker", "0509998877");
    const anna = addBuyer(database, "Anna Kovacs", "0509998866");
    const mop = addItem(database, "Mop", 180, 8);
    const byHelen = createOrder(
      database,
      helen,
      [{ product_id: cheap, qty: 1 }],
      "",
      "2026-09-22 10:00:00"
    );
    const byAnna = createOrder(
      database,
      anna,
      [
        { product_id: cheap, qty: 1 },
        { product_id: mop, qty: 1 },
      ],
      "",
      "2026-09-23 10:00:00"
    );
    changeStatus(database, byAnna, "confirmed", "2026-09-23 12:00:00");

    const namesAsc = listOrders(database, null, "", { sort: "customer-asc" }).map(
      (row) => row.customer_name
    );
    const namesDesc = listOrders(database, null, "", { sort: "customer-desc" }).map(
      (row) => row.customer_name
    );
    assert.ok(namesAsc.indexOf("Anna Kovacs") < namesAsc.indexOf("Helen Parker"));
    assert.ok(namesDesc.indexOf("Helen Parker") < namesDesc.indexOf("Anna Kovacs"));
    assert.ok(byHelen);
    assert.equal(listOrders(database, null, "", { sort: "lines-desc" })[0].id, byAnna);
    assert.equal(listOrders(database, null, "", { sort: "lines-asc" })[0].positions, 1);
    assert.equal(listOrders(database, null, "", { sort: "id-desc" })[0].id, byAnna);
    assert.equal(listOrders(database, null, "", { sort: "status-asc" })[0].status, "new");
    const statusDesc = listOrders(database, null, "", { sort: "status-desc" });
    assert.equal(statusDesc[0].status, "confirmed");
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

test("a customer needs a real name, and an empty city becomes Uzhhorod", () => {
  const database = tempDb(false);
  try {
    assert.throws(() => addCustomer(database, "A", "0501112233", "Chop", "1 Street"), /name/);
    assert.throws(() => addCustomer(database, "Olga Test", "12345", "Chop", ""), /10/);
    const id = addCustomer(database, "  Olga Test  ", "050-111-22-33", "  ", "  ");
    const row = database.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    assert.equal(row.name, "Olga Test");
    assert.equal(row.phone, "050-111-22-33");
    assert.equal(row.city, "Uzhhorod");
    assert.equal(row.address, "");
  } finally {
    database.close();
  }
});

test("a product must come from the list, with a whole price and a stock that is not negative", () => {
  const database = tempDb(false);
  try {
    assert.throws(() => addProduct(database, "X", "Household", 45, 1), /name/);
    assert.throws(() => addProduct(database, "Sponge", "Garden", 45, 1), /category/);
    assert.throws(() => addProduct(database, "Sponge", "Household", "12.5", 1), /whole number/);
    assert.throws(() => addProduct(database, "Sponge", "Household", 45, -1), /negative/);
    assert.throws(() => updateProduct(database, 99, "Sponge", "Household", 45, 1), /not found/);
    assert.throws(() => deleteProduct(database, 99), /not found/);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM products").get().n, 0);
  } finally {
    database.close();
  }
});

test("customers and products filter by search, city, category and low stock", () => {
  const database = tempDb(false);
  try {
    addCustomer(database, "Helen Parker", "0501234567", "Uzhhorod", "12 Korzo St");
    addCustomer(database, "Mark Ellis", "0975552211", "Mukachevo", "4 Peace St");
    addProduct(database, "Desk lamp", "Household", 650, 3);
    addProduct(database, "Electric kettle 1.7 L", "Kitchen", 890, 8);

    const helen = listCustomers(database, "helen");
    assert.equal(helen.customers.length, 1);
    assert.equal(helen.customers[0].name, "Helen Parker");
    assert.equal(listCustomers(database, "555").customers[0].name, "Mark Ellis");
    assert.equal(listCustomers(database, "korzo").customers[0].name, "Helen Parker");

    const city = listCustomers(database, "", "Mukachevo");
    assert.equal(city.customers.length, 1);
    assert.equal(city.city, "Mukachevo");
    assert.deepEqual(city.cities, ["Mukachevo", "Uzhhorod"]);
    assert.equal(listCustomers(database, "", "Kyiv").customers.length, 2);
    assert.equal(listCustomers(database, "", "", "name-asc").customers[0].name, "Helen Parker");
    assert.equal(listCustomers(database, "", "", "name-desc").customers[0].name, "Mark Ellis");

    assert.equal(listProducts(database, "LAMP").length, 1);
    assert.equal(listProducts(database, "lamp", "Kitchen").length, 0);
    assert.equal(listProducts(database, "", "Household", "low").length, 1);
    assert.equal(listProducts(database, "", "", "low").length, 1);
    assert.equal(listProducts(database, "", "Garden").length, 2);
    assert.equal(listProducts(database, "", "", "", "name-asc")[0].name, "Desk lamp");
    assert.equal(listProducts(database, "", "", "", "name-desc")[0].name, "Electric kettle 1.7 L");
    assert.equal(listProducts(database, "", "", "", "price-asc")[0].price, 650);
    assert.equal(listProducts(database, "", "", "", "price-desc")[0].price, 890);
    assert.equal(listProducts(database, "", "", "", "stock-asc")[0].stock, 3);
    assert.equal(listProducts(database, "", "", "", "stock-desc")[0].stock, 8);
  } finally {
    database.close();
  }
});

test("an order needs a real customer, a short comment and a positive quantity", () => {
  const database = tempDb(false);
  try {
    const item = addItem(database);
    assert.throws(() => createOrder(database, 99, [{ product_id: item, qty: 1 }]), /does not exist/);
    const buyer = addBuyer(database);
    assert.throws(() => createOrder(database, buyer, [{ product_id: item, qty: 0 }]), /greater than zero/);
    assert.throws(() => createOrder(database, buyer, [{ product_id: item, qty: -2 }]), /greater than zero/);
    assert.throws(() => createOrder(database, buyer, [{ product_id: 99, qty: 1 }]), /not found/);
    assert.throws(
      () => createOrder(database, buyer, [{ product_id: item, qty: 1 }], "x".repeat(401)),
      /too long/
    );
    assert.throws(() => placeOrder(database, { lines: [{ product_id: item, qty: 1 }] }), /Choose a customer/);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
    assert.equal(getProduct(database, item).stock, 5);
  } finally {
    database.close();
  }
});

test("a new customer stays even when the order does not fit on the shelf", () => {
  const database = tempDb(false);
  try {
    const item = addItem(database, "Sponge", 45, 1);
    assert.throws(
      () =>
        placeOrder(database, {
          customer_id: "new",
          name: "Nina Harris",
          phone: "0509998877",
          city: "Chop",
          address: "1 Street",
          lines: [{ product_id: item, qty: 5 }],
        }),
      /Not enough/
    );
    const customers = database.prepare("SELECT name, city FROM customers").all();
    assert.deepEqual(customers, [{ name: "Nina Harris", city: "Chop" }]);
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 0);
    assert.equal(getProduct(database, item).stock, 1);
  } finally {
    database.close();
  }
});

test("the full path ends at completed, and the taken stock is not returned", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Sponge", 45, 5);
    const orderId = createOrder(database, buyer, [{ product_id: item, qty: 2 }]);
    changeStatus(database, orderId, "confirmed", "2026-09-22 09:00:00", "Shop desk");
    changeStatus(database, orderId, "shipped", "2026-09-22 11:00:00", "Shop desk");
    changeStatus(database, orderId, "completed", "2026-09-23 15:00:00", "Shop desk");

    const pack = getOrder(database, orderId);
    assert.equal(pack.order.status, "completed");
    assert.equal(getProduct(database, item).stock, 3);
    assert.deepEqual(
      pack.events.map((row) => row.status),
      ["new", "confirmed", "shipped", "completed"]
    );
    assert.equal(pack.events[3].staff_name, "Shop desk");

    assert.throws(() => changeStatus(database, orderId, "completed"), /already/);
    assert.throws(() => changeStatus(database, orderId, "cancelled"), /Cannot/);
    assert.throws(() => changeStatus(database, orderId, "shipped"), /Cannot/);
    assert.throws(() => changeStatus(database, orderId, "lost"), /Unknown status/);
    assert.throws(() => changeStatus(database, 99, "confirmed"), /not found/);
    assert.throws(() => updateOrder(database, orderId, [{ product_id: item, qty: 1 }], ""), /on its way/);
    assert.equal(getProduct(database, item).stock, 3);
  } finally {
    database.close();
  }
});

test("taking a line off an open order puts that stock back", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const sponge = addItem(database, "Sponge", 45, 5);
    const soap = addItem(database, "Soap", 80, 2);
    const orderId = createOrder(database, buyer, [
      { product_id: sponge, qty: 2 },
      { product_id: soap, qty: 1 },
    ]);
    updateOrder(database, orderId, [{ product_id: soap, qty: 1 }], "only soap");

    const pack = getOrder(database, orderId);
    assert.equal(pack.items.length, 1);
    assert.equal(pack.items[0].product_id, soap);
    assert.equal(pack.order.total, 80);
    assert.equal(getProduct(database, sponge).stock, 5);
    assert.equal(getProduct(database, soap).stock, 1);

    assert.throws(
      () =>
        updateOrder(
          database,
          orderId,
          [
            { product_id: soap, qty: 1 },
            { product_id: sponge, qty: 9 },
          ],
          "too many"
        ),
      /Sponge/
    );
    assert.equal(getProduct(database, sponge).stock, 5);
    assert.equal(getProduct(database, soap).stock, 1);
    assert.equal(getOrder(database, orderId).order.comment, "only soap");
  } finally {
    database.close();
  }
});

test("search by the order number, and two days on the dot is not yet waiting", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database, "Olga Test", "0670000000");
    const item = addItem(database);
    const early = createOrder(database, buyer, [{ product_id: item, qty: 1 }], "first", "2026-09-21 10:00:00");
    const later = createOrder(database, buyer, [{ product_id: item, qty: 1 }], "second", "2026-09-28 10:00:00");

    assert.equal(listOrders(database, null, String(early)).length, 1);
    assert.equal(listOrders(database, null, String(early))[0].id, early);

    const oldest = listOrders(database, null, "", { sort: "oldest" });
    assert.deepEqual(
      oldest.map((row) => row.id),
      [early, later]
    );
    const richest = listOrders(database, null, "", { sort: "total-desc" });
    assert.equal(richest[0].id, later);
    assert.equal(richest[1].id, early);

    const both = listOrders(database, null, "", { from: "21.09.2026" });
    assert.equal(both.length, 2);

    const created = Date.parse("2026-09-21T10:00:00");
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    const onTheDot = listOrders(database, null, String(early), { now: created + twoDays });
    assert.equal(onTheDot[0].waiting, 0);
    const justAfter = listOrders(database, null, String(early), { now: created + twoDays + 1 });
    assert.equal(justAfter[0].waiting, 1);
  } finally {
    database.close();
  }
});

test("summary lists every status, and three left on the shelf is already low", () => {
  const database = tempDb(false);
  try {
    addItem(database, "Lamp", 650, 3);
    addItem(database, "Iron", 1190, 4);
    const report = summary(database);
    assert.deepEqual(
      report.byStatus.map((row) => row.status),
      ["new", "confirmed", "shipped", "completed", "cancelled"]
    );
    assert.ok(report.byStatus.every((row) => row.count === 0 && row.total === 0));
    assert.deepEqual(
      report.lowStock.map((row) => row.name),
      ["Lamp"]
    );
    assert.deepEqual(report.attention, []);
  } finally {
    database.close();
  }
});

test("attention follows the status change, not the day the order was written", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database, "Kettle", 890, 10);
    const now = Date.parse("2026-10-07T12:00:00");
    const old = createOrder(
      database,
      buyer,
      [{ product_id: item, qty: 1 }],
      "",
      "2026-09-21 10:15:00"
    );
    createOrder(database, buyer, [{ product_id: item, qty: 1 }], "", "2026-10-07 11:00:00");
    const justConfirmed = createOrder(
      database,
      buyer,
      [{ product_id: item, qty: 1 }],
      "",
      "2026-09-20 10:00:00"
    );
    changeStatus(database, justConfirmed, "confirmed", "2026-10-07 11:30:00", "Shop desk");
    const stuckConfirmed = createOrder(
      database,
      buyer,
      [{ product_id: item, qty: 1 }],
      "",
      "2026-10-01 10:00:00"
    );
    changeStatus(database, stuckConfirmed, "confirmed", "2026-10-05 10:00:00", "Shop desk");
    const shipped = createOrder(
      database,
      buyer,
      [{ product_id: item, qty: 1 }],
      "",
      "2026-09-01 10:00:00"
    );
    changeStatus(database, shipped, "confirmed", "2026-09-01 11:00:00", "Shop desk");
    changeStatus(database, shipped, "shipped", "2026-09-02 11:00:00", "Shop desk");

    const report = summary(database, now);
    assert.deepEqual(
      report.attention.map((row) => row.id),
      [old, stuckConfirmed]
    );
    assert.equal(report.attention[0].status, "new");
    assert.equal(report.attention[0].staff_name, "");
    assert.equal(report.attention[0].dwell_ms, now - Date.parse("2026-09-21T10:15:00"));
    assert.equal(report.attention[1].status, "confirmed");
    assert.equal(report.attention[1].staff_name, "Shop desk");
    assert.equal(report.attention[1].dwell_ms, now - Date.parse("2026-10-05T10:00:00"));
    assert.ok(!report.attention.some((row) => row.id === justConfirmed));
  } finally {
    database.close();
  }
});

test("an older shop file receives delivery and the staff name", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const database = openDb(path.join(dir, "shop.db"));
  try {
    database.exec(`
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT 'Uzhhorod',
        address TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        stock INTEGER NOT NULL
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        comment TEXT NOT NULL DEFAULT '',
        total INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        price INTEGER NOT NULL
      );
      CREATE TABLE order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    prepare(database, false);
    const orderCols = database.prepare("PRAGMA table_info(orders)").all().map((column) => column.name);
    const eventCols = database.prepare("PRAGMA table_info(order_events)").all().map((column) => column.name);
    assert.ok(orderCols.includes("delivery"));
    assert.ok(orderCols.includes("delivery_fee"));
    assert.ok(eventCols.includes("staff_name"));
  } finally {
    database.close();
  }
});

test("the database itself refuses a broken row, and a customer with an order stays", () => {
  const database = tempDb(false);
  try {
    const buyer = addBuyer(database);
    const item = addItem(database);
    createOrder(database, buyer, [{ product_id: item, qty: 1 }]);
    assert.throws(() =>
      database.prepare("INSERT INTO products (name, category, price, stock) VALUES ('Bad', 'Household', 0, 1)").run()
    );
    assert.throws(() =>
      database
        .prepare("INSERT INTO products (name, category, price, stock) VALUES ('Bad', 'Household', 10, -1)")
        .run()
    );
    assert.throws(() =>
      database
        .prepare(
          "INSERT INTO orders (customer_id, status, total, created_at) VALUES (?, 'lost', 10, '2026-09-21 10:00:00')"
        )
        .run(buyer)
    );
    assert.throws(() => database.prepare("DELETE FROM customers WHERE id = ?").run(buyer));
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM customers").get().n, 1);
  } finally {
    database.close();
  }
});

test("the desk password is stored as a hash, and the account is created once", () => {
  const database = tempDb(false);
  try {
    ensureStaff(database);
    ensureStaff(database);
    const rows = database.prepare("SELECT login, password_hash FROM staff").all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].login, "desk");
    assert.notEqual(rows[0].password_hash, "shelf2026");
    assert.equal(rows[0].password_hash.includes(":"), true);
  } finally {
    database.close();
  }
});

test("api saves a product, refuses a bad one, and records who moved the status", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "polychka-"));
  const app = createApp(path.join(dir, "shop.db"), { seed: false, auth: true });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;

  try {
    const signed = await fetch(base + "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login: "desk", password: "shelf2026" }),
    });
    const cookie = signed.headers.get("set-cookie").split(";")[0];
    const headers = { "content-type": "application/json", cookie };

    const me = await fetch(base + "/api/me", { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).staff.login, "desk");

    const missing = await fetch(base + "/api/nowhere", { headers: { cookie } });
    assert.equal(missing.status, 404);

    const bad = await fetch(base + "/api/products", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Sponge", category: "Garden", price: 45, stock: 5 }),
    });
    assert.equal(bad.status, 400);

    const made = await fetch(base + "/api/products", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Sponge", category: "Household", price: 45, stock: 5 }),
    });
    assert.equal(made.status, 201);
    const productId = (await made.json()).id;

    const buyer = await fetch(base + "/api/customers", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Olga Test", phone: "0501112233", city: "Uzhhorod", address: "3 Street" }),
    });
    assert.equal(buyer.status, 201);

    const created = await fetch(base + "/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer_id: (await buyer.json()).id,
        lines: [{ product_id: productId, qty: 1 }],
      }),
    });
    assert.equal(created.status, 201);
    const orderId = (await created.json()).id;

    const moved = await fetch(base + "/api/orders/" + orderId + "/status", {
      method: "POST",
      headers,
      body: JSON.stringify({ status: "confirmed" }),
    });
    assert.equal(moved.status, 200);
    const pack = await (await fetch(base + "/api/orders/" + orderId, { headers: { cookie } })).json();
    assert.equal(pack.order.status, "confirmed");
    assert.equal(pack.events[1].staff_name, "Shop desk");
    assert.deepEqual(pack.nextStatuses, ["shipped", "cancelled"]);

    const list = await (await fetch(base + "/api/orders", { headers: { cookie } })).json();
    assert.equal(list.totalSum, 45);

    const removed = await fetch(base + "/api/products/" + productId, { method: "DELETE", headers: { cookie } });
    const removedBody = await removed.json();
    assert.equal(removed.status, 400);
    assert.ok(removedBody.error.includes("order"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.db.close();
  }
});
