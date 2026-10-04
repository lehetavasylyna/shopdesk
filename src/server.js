const path = require("path");
const express = require("express");
const db = require("./db");

function createApp(dbPath, options) {
  const seed = !options || options.seed !== false;
  const database = db.openDb(dbPath);
  db.prepare(database, seed);

  const app = express();
  app.locals.db = database;
  app.use(express.json());

  function fail(res, err) {
    if (err instanceof db.ShopError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  app.get("/api/orders", (req, res) => {
    let status = req.query.status || "";
    const query = req.query.q || "";
    if (status && !db.STATUSES.includes(status)) status = "";
    const orders = db.listOrders(database, status || null, query);
    res.json({
      orders,
      statuses: db.STATUSES,
      status,
      query,
      totalSum: db.ordersTotal(orders),
    });
  });

  app.post("/api/orders", (req, res) => {
    try {
      const body = req.body || {};
      let customerId = body.customer_id;
      if (customerId === "new") {
        customerId = db.addCustomer(database, body.name, body.phone, body.city, body.address);
      } else if (!customerId) {
        throw new db.ShopError("Choose a customer or enter a new one");
      }
      const lines = Array.isArray(body.lines) ? body.lines : [];
      const orderId = db.createOrder(database, customerId, lines, body.comment);
      res.status(201).json({ id: orderId });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get("/api/orders/:id", (req, res) => {
    const pack = db.getOrder(database, Number(req.params.id));
    if (!pack) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json({
      order: pack.order,
      items: pack.items,
      events: pack.events,
      nextStatuses: db.NEXT_STATUS[pack.order.status],
    });
  });

  app.post("/api/orders/:id/status", (req, res) => {
    try {
      db.changeStatus(database, Number(req.params.id), req.body && req.body.status);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get("/api/products", (req, res) => {
    res.json({
      products: db.listProducts(database),
      categories: db.CATEGORIES,
    });
  });

  app.post("/api/products", (req, res) => {
    try {
      const body = req.body || {};
      const id = db.addProduct(database, body.name, body.category, body.price, body.stock);
      res.status(201).json({ id });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get("/api/products/:id", (req, res) => {
    const product = db.getProduct(database, Number(req.params.id));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ product, categories: db.CATEGORIES });
  });

  app.put("/api/products/:id", (req, res) => {
    try {
      const body = req.body || {};
      db.updateProduct(database, Number(req.params.id), body.name, body.category, body.price, body.stock);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    try {
      db.deleteProduct(database, Number(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get("/api/customers", (req, res) => {
    res.json({ customers: db.listCustomers(database) });
  });

  app.post("/api/customers", (req, res) => {
    try {
      const body = req.body || {};
      const id = db.addCustomer(database, body.name, body.phone, body.city, body.address);
      res.status(201).json({ id });
    } catch (err) {
      fail(res, err);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp(path.join(__dirname, "..", "shop.db"));
  app.listen(5000, () => {
    console.log("API http://127.0.0.1:5000");
  });
}

module.exports = { createApp };
