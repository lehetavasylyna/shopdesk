const express = require("express");
const { ShopError } = require("./errors");
const { addCustomer, CUSTOMER_SORTS, customerWithOrders, listCustomers } = require("./customers");
const {
  CATEGORIES,
  addProduct,
  deleteProduct,
  getProduct,
  listProducts,
  PRODUCT_SORTS,
  updateProduct,
} = require("./products");
const {
  NEXT_STATUS,
  STATUSES,
  changeStatus,
  getOrder,
  listOrders,
  ordersTotal,
  placeOrder,
  SORTS,
  updateOrder,
} = require("./orders");
const { summary } = require("./summary");
const { ensureStaff, signIn, signOut, staffFromRequest, writeSessionCookie } = require("./auth");

function handle(fn) {
  return function (req, res, next) {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof ShopError) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  };
}

function paramId(req) {
  return Number(req.params.id);
}

function routes(db, options) {
  const auth = !options || options.auth !== false;
  const router = express.Router();
  if (auth) ensureStaff(db);

  router.post(
    "/login",
    handle((req, res) => {
      const body = req.body || {};
      const result = signIn(db, body.login, body.password);
      writeSessionCookie(res, result.token);
      res.json({ staff: result.staff });
    })
  );

  router.post("/logout", (req, res) => {
    signOut(db, req);
    writeSessionCookie(res, "");
    res.json({ ok: true });
  });

  router.get("/me", (req, res) => {
    if (!auth) {
      res.json({ staff: { id: 0, name: "Shop desk", login: "desk" } });
      return;
    }
    const staff = staffFromRequest(db, req);
    if (!staff) {
      res.status(401).json({ error: "Sign in first" });
      return;
    }
    res.json({ staff });
  });

  if (auth) {
    router.use((req, res, next) => {
      const staff = staffFromRequest(db, req);
      if (staff) {
        req.staff = staff;
        next();
        return;
      }
      res.status(401).json({ error: "Sign in first" });
    });
  }

  router.get("/summary", (req, res) => {
    res.json(summary(db));
  });

  router.get("/orders", (req, res) => {
    let status = req.query.status || "";
    const query = req.query.q || "";
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    let sort = req.query.sort || "newest";
    if (status && !STATUSES.includes(status)) status = "";
    if (!SORTS[sort]) sort = "newest";
    const orders = listOrders(db, status || null, query, { from, to, sort });
    res.json({
      orders,
      statuses: STATUSES,
      sorts: Object.keys(SORTS),
      status,
      query,
      from,
      to,
      sort,
      totalSum: ordersTotal(orders),
    });
  });

  router.post(
    "/orders",
    handle((req, res) => {
      const id = placeOrder(db, req.body);
      res.status(201).json({ id });
    })
  );

  router.get("/orders/:id", (req, res) => {
    const pack = getOrder(db, paramId(req));
    if (!pack) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json({
      order: pack.order,
      items: pack.items,
      events: pack.events,
      nextStatuses: NEXT_STATUS[pack.order.status],
    });
  });

  router.put(
    "/orders/:id",
    handle((req, res) => {
      const body = req.body || {};
      updateOrder(db, paramId(req), body.lines, body.comment, body.delivery);
      res.json({ ok: true });
    })
  );

  router.post(
    "/orders/:id/status",
    handle((req, res) => {
      changeStatus(db, paramId(req), req.body && req.body.status, null, req.staff && req.staff.name);
      res.json({ ok: true });
    })
  );

  router.get("/products", (req, res) => {
    const query = req.query.q || "";
    let category = req.query.category || "";
    let stock = req.query.stock || "";
    let sort = req.query.sort || "name-asc";
    if (category && !CATEGORIES.includes(category)) category = "";
    if (stock !== "low") stock = "";
    if (!PRODUCT_SORTS[sort]) sort = "name-asc";
    res.json({
      products: listProducts(db, query, category, stock, sort),
      categories: CATEGORIES,
      sorts: Object.keys(PRODUCT_SORTS),
      category,
      stock,
      query,
      sort,
    });
  });

  router.post(
    "/products",
    handle((req, res) => {
      const body = req.body || {};
      const id = addProduct(db, body.name, body.category, body.price, body.stock);
      res.status(201).json({ id });
    })
  );

  router.get("/products/:id", (req, res) => {
    const product = getProduct(db, paramId(req));
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json({ product, categories: CATEGORIES });
  });

  router.put(
    "/products/:id",
    handle((req, res) => {
      const body = req.body || {};
      updateProduct(db, paramId(req), body.name, body.category, body.price, body.stock);
      res.json({ ok: true });
    })
  );

  router.delete(
    "/products/:id",
    handle((req, res) => {
      deleteProduct(db, paramId(req));
      res.json({ ok: true });
    })
  );

  router.get("/customers", (req, res) => {
    let sort = req.query.sort || "name-asc";
    if (!CUSTOMER_SORTS[sort]) sort = "name-asc";
    res.json(listCustomers(db, req.query.q || "", req.query.city || "", sort));
  });

  router.get("/customers/:id", (req, res) => {
    const pack = customerWithOrders(db, paramId(req));
    if (!pack) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(pack);
  });

  router.post(
    "/customers",
    handle((req, res) => {
      const body = req.body || {};
      const id = addCustomer(db, body.name, body.phone, body.city, body.address);
      res.status(201).json({ id });
    })
  );

  return router;
}

module.exports = { routes };
