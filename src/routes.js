const express = require("express");
const { ShopError } = require("./errors");
const { addCustomer, listCustomers } = require("./customers");
const {
  CATEGORIES,
  addProduct,
  deleteProduct,
  getProduct,
  listProducts,
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
} = require("./orders");

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

function routes(db) {
  const router = express.Router();

  router.get("/orders", (req, res) => {
    let status = req.query.status || "";
    const query = req.query.q || "";
    if (status && !STATUSES.includes(status)) status = "";
    const orders = listOrders(db, status || null, query);
    res.json({
      orders,
      statuses: STATUSES,
      status,
      query,
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

  router.post(
    "/orders/:id/status",
    handle((req, res) => {
      changeStatus(db, paramId(req), req.body && req.body.status);
      res.json({ ok: true });
    })
  );

  router.get("/products", (req, res) => {
    res.json({ products: listProducts(db), categories: CATEGORIES });
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
    res.json({ customers: listCustomers(db) });
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
