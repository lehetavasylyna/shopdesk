const { ShopError } = require("./errors");
const { asInt, clean } = require("./db");
const { nowText } = require("./time");
const { addCustomer, getCustomer } = require("./customers");
const { getProduct } = require("./products");

const STATUSES = ["new", "confirmed", "shipped", "completed", "cancelled"];

// Shipped and completed orders do not go backwards.
const NEXT_STATUS = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

function orderLines(lines) {
  const merged = new Map();
  for (const line of lines) {
    const rawId = line.product_id;
    if (rawId === undefined || rawId === null || String(rawId).trim() === "") continue;
    const productId = asInt(rawId, "Invalid product");
    const qty = asInt(line.qty, "Quantity has to be a number");
    if (qty <= 0) throw new ShopError("Quantity has to be greater than zero");
    merged.set(productId, (merged.get(productId) || 0) + qty);
  }
  if (merged.size === 0) throw new ShopError("Add at least one product");
  return merged;
}

function createOrder(db, customerId, lines, comment, createdAt) {
  customerId = asInt(customerId, "Choose a customer");
  comment = clean(comment);
  if (comment.length > 400) throw new ShopError("The comment is too long");
  if (!getCustomer(db, customerId)) throw new ShopError("That customer does not exist");

  const merged = orderLines(lines || []);
  const created = createdAt || nowText();
  const updateStock = db.prepare(
    "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?"
  );
  const insertOrder = db.prepare(
    `INSERT INTO orders (customer_id, status, comment, total, created_at)
     VALUES (?, 'new', ?, ?, ?)`
  );
  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)"
  );
  const insertEvent = db.prepare(
    "INSERT INTO order_events (order_id, status, created_at) VALUES (?, 'new', ?)"
  );

  const run = db.transaction(() => {
    let total = 0;
    const prepared = [];
    for (const [productId, qty] of merged) {
      const product = getProduct(db, productId);
      if (!product) throw new ShopError("Product not found");
      if (product.stock < qty) {
        throw new ShopError(
          `Not enough "${product.name}": ${product.stock} in stock, ${qty} in the order`
        );
      }
      const updated = updateStock.run(qty, productId, qty);
      if (updated.changes !== 1) {
        throw new ShopError(`Not enough "${product.name}", the stock already changed`);
      }
      total += product.price * qty;
      prepared.push({ productId, qty, price: product.price });
    }

    const info = insertOrder.run(customerId, comment, total, created);
    const orderId = Number(info.lastInsertRowid);
    for (const row of prepared) insertItem.run(orderId, row.productId, row.qty, row.price);
    insertEvent.run(orderId, created);
    return orderId;
  });

  return run();
}

const OPEN_FOR_EDIT = ["new", "confirmed"];

function updateOrder(db, orderId, lines, comment) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) throw new ShopError("Order not found");
  if (!OPEN_FOR_EDIT.includes(order.status)) {
    throw new ShopError("This order is already on its way. The lines cannot be changed.");
  }

  comment = clean(comment);
  if (comment.length > 400) throw new ShopError("The comment is too long");
  const merged = orderLines(lines || []);

  const oldItems = db.prepare("SELECT product_id, price FROM order_items WHERE order_id = ?").all(orderId);
  const oldPrice = new Map();
  for (const item of oldItems) {
    if (!oldPrice.has(item.product_id)) oldPrice.set(item.product_id, item.price);
  }

  const giveBack = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
  const take = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?");
  const clearItems = db.prepare("DELETE FROM order_items WHERE order_id = ?");
  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)"
  );
  const saveOrder = db.prepare("UPDATE orders SET comment = ?, total = ? WHERE id = ?");

  const run = db.transaction(() => {
    const current = db.prepare("SELECT product_id, qty FROM order_items WHERE order_id = ?").all(orderId);
    for (const item of current) giveBack.run(item.qty, item.product_id);
    clearItems.run(orderId);

    let total = 0;
    for (const [productId, qty] of merged) {
      const product = getProduct(db, productId);
      if (!product) throw new ShopError("Product not found");
      if (product.stock < qty) {
        throw new ShopError(
          `Not enough "${product.name}": ${product.stock} in stock, ${qty} in the order`
        );
      }
      const updated = take.run(qty, productId, qty);
      if (updated.changes !== 1) {
        throw new ShopError(`Not enough "${product.name}", the stock already changed`);
      }
      const price = oldPrice.has(productId) ? oldPrice.get(productId) : product.price;
      insertItem.run(orderId, productId, qty, price);
      total += price * qty;
    }
    saveOrder.run(comment, total, orderId);
  });
  run();
}

function placeOrder(db, body) {
  const input = body || {};
  let customerId = input.customer_id;
  if (customerId === "new") {
    customerId = addCustomer(db, input.name, input.phone, input.city, input.address);
  } else if (!customerId) {
    throw new ShopError("Choose a customer or enter a new one");
  }
  const lines = Array.isArray(input.lines) ? input.lines : [];
  return createOrder(db, customerId, lines, input.comment);
}

function changeStatus(db, orderId, newStatus, when) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) throw new ShopError("Order not found");
  if (!STATUSES.includes(newStatus)) throw new ShopError("Unknown status");
  const allowed = NEXT_STATUS[order.status];
  if (!allowed.includes(newStatus)) {
    if (order.status === newStatus) throw new ShopError("The order is already in this status");
    throw new ShopError(`Cannot move from "${order.status}" to "${newStatus}"`);
  }

  const moment = when || nowText();
  const giveBack = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
  const setStatus = db.prepare("UPDATE orders SET status = ? WHERE id = ?");
  const insertEvent = db.prepare(
    "INSERT INTO order_events (order_id, status, created_at) VALUES (?, ?, ?)"
  );

  const run = db.transaction(() => {
    if (newStatus === "cancelled") {
      const items = db.prepare("SELECT product_id, qty FROM order_items WHERE order_id = ?").all(orderId);
      for (const item of items) giveBack.run(item.qty, item.product_id);
    }
    setStatus.run(newStatus, orderId);
    insertEvent.run(orderId, newStatus, moment);
  });
  run();
}

function listOrders(db, status, query) {
  let sql = `
    SELECT o.id, o.status, o.comment, o.total, o.created_at,
           c.name AS customer_name, c.phone,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS positions
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
  `;
  const params = [];
  if (status) {
    sql += " WHERE o.status = ?";
    params.push(status);
  }
  sql += " ORDER BY o.created_at DESC, o.id DESC";
  let rows = db.prepare(sql).all(...params);
  const needle = cleanQuery(query);
  if (needle) {
    // SQLite lower() does not handle every letter, so the short list is filtered here.
    rows = rows.filter(
      (row) =>
        row.customer_name.toLowerCase().includes(needle) || row.phone.toLowerCase().includes(needle)
    );
  }
  return rows;
}

function cleanQuery(query) {
  return String(query || "").trim().toLowerCase();
}

function ordersTotal(rows) {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

function getOrder(db, orderId) {
  const order = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.phone, c.city, c.address
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ?`
    )
    .get(orderId);
  if (!order) return null;
  const items = db
    .prepare(
      `SELECT oi.product_id, oi.qty, oi.price, p.name, oi.qty * oi.price AS line_sum
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`
    )
    .all(orderId);
  const events = db
    .prepare("SELECT status, created_at FROM order_events WHERE order_id = ? ORDER BY id")
    .all(orderId);
  return { order, items, events };
}

module.exports = {
  STATUSES,
  NEXT_STATUS,
  createOrder,
  placeOrder,
  updateOrder,
  changeStatus,
  listOrders,
  ordersTotal,
  getOrder,
};
