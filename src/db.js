const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const SCHEMA_PATH = path.join(__dirname, "..", "schema.sql");

const STATUSES = ["new", "confirmed", "shipped", "completed", "cancelled"];

// Shipped and completed orders do not go backwards.
const NEXT_STATUS = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

const CATEGORIES = ["Kitchen", "Tableware", "Textiles", "Household"];

class ShopError extends Error {
  constructor(message) {
    super(message);
    this.name = "ShopError";
  }
}

function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

function initDb(db) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function prepare(db, seed) {
  initDb(db);
  if (seed) seedIfEmpty(db);
}

function nowText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function showDate(value) {
  if (!value) return "";
  const [datePart, timePart = ""] = String(value).split(" ");
  const [year, month, day] = datePart.split("-");
  if (!timePart) return `${day}.${month}.${year}`;
  const [hour, minute] = timePart.split(":");
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

function clean(value) {
  return String(value || "").trim();
}

function asInt(value, message) {
  const text = String(
    value === undefined || value === null ? "" : value,
  ).trim();
  if (!/^-?\d+$/.test(text)) throw new ShopError(message);
  return Number(text);
}

function addCustomer(db, name, phone, city, address) {
  name = clean(name);
  phone = clean(phone);
  city = clean(city) || "Uzhhorod";
  address = clean(address);
  if (name.length < 2) throw new ShopError("Enter the customer name");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10)
    throw new ShopError("The phone number needs at least 10 digits");
  const info = db
    .prepare(
      "INSERT INTO customers (name, phone, city, address) VALUES (?, ?, ?, ?)",
    )
    .run(name, phone, city, address);
  return Number(info.lastInsertRowid);
}

function productFields(name, category, price, stock) {
  name = clean(name);
  category = clean(category);
  if (name.length < 2) throw new ShopError("Enter the product name");
  if (!CATEGORIES.includes(category))
    throw new ShopError("Pick a category from the list");
  price = asInt(price, "Price has to be a whole number");
  stock = asInt(stock, "Stock has to be a whole number");
  if (price <= 0) throw new ShopError("Price has to be greater than zero");
  if (stock < 0) throw new ShopError("Stock cannot be negative");
  return { name, category, price, stock };
}

function addProduct(db, name, category, price, stock) {
  const fields = productFields(name, category, price, stock);
  const info = db
    .prepare(
      "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
    )
    .run(fields.name, fields.category, fields.price, fields.stock);
  return Number(info.lastInsertRowid);
}

function updateProduct(db, productId, name, category, price, stock) {
  if (!getProduct(db, productId)) throw new ShopError("Product not found");
  const fields = productFields(name, category, price, stock);
  db.prepare(
    "UPDATE products SET name = ?, category = ?, price = ?, stock = ? WHERE id = ?",
  ).run(fields.name, fields.category, fields.price, fields.stock, productId);
}

function deleteProduct(db, productId) {
  try {
    const info = db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    if (info.changes === 0) throw new ShopError("Product not found");
  } catch (err) {
    if (err instanceof ShopError) throw err;
    if (String(err.code || "").includes("CONSTRAINT")) {
      throw new ShopError(
        "This product is already in an order, so it cannot be deleted",
      );
    }
    throw err;
  }
}

function listProducts(db) {
  return db.prepare("SELECT * FROM products ORDER BY category, name").all();
}

function getProduct(db, productId) {
  return db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
}

function listCustomers(db) {
  return db.prepare("SELECT * FROM customers ORDER BY name").all();
}

function getCustomer(db, customerId) {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
}

function createOrder(db, customerId, lines, comment, createdAt) {
  customerId = asInt(customerId, "Choose a customer");
  comment = clean(comment);
  if (comment.length > 400) throw new ShopError("The comment is too long");
  if (!getCustomer(db, customerId))
    throw new ShopError("That customer does not exist");

  const merged = new Map();
  for (const line of lines) {
    const rawId = line.product_id;
    if (rawId === undefined || rawId === null || String(rawId).trim() === "")
      continue;
    const productId = asInt(rawId, "Invalid product");
    const qty = asInt(line.qty, "Quantity has to be a number");
    if (qty <= 0) throw new ShopError("Quantity has to be greater than zero");
    merged.set(productId, (merged.get(productId) || 0) + qty);
  }
  if (merged.size === 0) throw new ShopError("Add at least one product");

  const created = createdAt || nowText();
  const run = db.transaction(() => {
    let total = 0;
    const prepared = [];
    for (const [productId, qty] of merged) {
      const product = getProduct(db, productId);
      if (!product) throw new ShopError("Product not found");
      if (product.stock < qty) {
        throw new ShopError(
          `Not enough "${product.name}": ${product.stock} in stock, ${qty} in the order`,
        );
      }
      const updated = db
        .prepare(
          "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
        )
        .run(qty, productId, qty);
      if (updated.changes !== 1) {
        throw new ShopError(
          `Not enough "${product.name}", the stock already changed`,
        );
      }
      total += product.price * qty;
      prepared.push({ productId, qty, price: product.price });
    }

    const info = db
      .prepare(
        `INSERT INTO orders (customer_id, status, comment, total, created_at)
         VALUES (?, 'new', ?, ?, ?)`,
      )
      .run(customerId, comment, total, created);
    const orderId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)`,
    );
    for (const row of prepared) {
      insertItem.run(orderId, row.productId, row.qty, row.price);
    }
    db.prepare(
      "INSERT INTO order_events (order_id, status, created_at) VALUES (?, 'new', ?)",
    ).run(orderId, created);
    return orderId;
  });

  return run();
}

function changeStatus(db, orderId, newStatus, when) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) throw new ShopError("Order not found");
  if (!STATUSES.includes(newStatus)) throw new ShopError("Unknown status");
  const allowed = NEXT_STATUS[order.status];
  if (!allowed.includes(newStatus)) {
    if (order.status === newStatus)
      throw new ShopError("The order is already in this status");
    throw new ShopError(`Cannot move from "${order.status}" to "${newStatus}"`);
  }

  const moment = when || nowText();
  const run = db.transaction(() => {
    if (newStatus === "cancelled") {
      const items = db
        .prepare("SELECT product_id, qty FROM order_items WHERE order_id = ?")
        .all(orderId);
      const giveBack = db.prepare(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
      );
      for (const item of items) giveBack.run(item.qty, item.product_id);
    }
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(
      newStatus,
      orderId,
    );
    db.prepare(
      "INSERT INTO order_events (order_id, status, created_at) VALUES (?, ?, ?)",
    ).run(orderId, newStatus, moment);
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
  const needle = clean(query).toLowerCase();
  if (needle) {
    // SQLite lower() does not handle every letter, so the short list is filtered here.
    rows = rows.filter(
      (row) =>
        row.customer_name.toLowerCase().includes(needle) ||
        row.phone.toLowerCase().includes(needle),
    );
  }
  return rows;
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
       WHERE o.id = ?`,
    )
    .get(orderId);
  if (!order) return null;
  const items = db
    .prepare(
      `SELECT oi.qty, oi.price, p.name, oi.qty * oi.price AS line_sum
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
    )
    .all(orderId);
  const events = db
    .prepare(
      "SELECT status, created_at FROM order_events WHERE order_id = ? ORDER BY id",
    )
    .all(orderId);
  return { order, items, events };
}

function seedIfEmpty(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
  if (count) return;

  const products = [
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
  const customers = [
    ["Helen Parker", "050 123 45 67", "Uzhhorod", "12 Korzo St"],
    ["Mark Ellis", "0975552211", "Mukachevo", "4 Peace St"],
    ["Irene Berg", "063 777 88 99", "Uzhhorod", "8 Petefi Sq"],
    ["Thomas Wood", "0664411223", "Chop", "19 Main St"],
  ];

  const insertProduct = db.prepare(
    "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
  );
  const insertCustomer = db.prepare(
    "INSERT INTO customers (name, phone, city, address) VALUES (?, ?, ?, ?)",
  );
  const fill = db.transaction(() => {
    for (const row of products) insertProduct.run(...row);
    for (const row of customers) insertCustomer.run(...row);
  });
  fill();

  createOrder(
    db,
    1,
    [
      { product_id: 1, qty: 1 },
      { product_id: 7, qty: 2 },
    ],
    "call back after 6 pm",
    "2026-09-21 10:15:00",
  );
  const second = createOrder(
    db,
    2,
    [
      { product_id: 11, qty: 1 },
      { product_id: 9, qty: 1 },
    ],
    "",
    "2026-09-23 16:40:00",
  );
  changeStatus(db, second, "confirmed", "2026-09-23 17:05:00");
  const third = createOrder(
    db,
    3,
    [
      { product_id: 6, qty: 1 },
      { product_id: 5, qty: 2 },
    ],
    "leave it by the entrance",
    "2026-09-28 12:05:00",
  );
  changeStatus(db, third, "confirmed", "2026-09-28 15:00:00");
  changeStatus(db, third, "shipped", "2026-09-29 11:20:00");
  const fourth = createOrder(
    db,
    4,
    [
      { product_id: 4, qty: 1 },
      { product_id: 3, qty: 2 },
    ],
    "",
    "2026-10-01 09:30:00",
  );
  changeStatus(db, fourth, "confirmed", "2026-10-01 11:00:00");
  changeStatus(db, fourth, "shipped", "2026-10-01 14:10:00");
  changeStatus(db, fourth, "completed", "2026-10-01 18:00:00");
}

module.exports = {
  STATUSES,
  NEXT_STATUS,
  CATEGORIES,
  ShopError,
  openDb,
  prepare,
  showDate,
  addCustomer,
  addProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  getProduct,
  listCustomers,
  createOrder,
  changeStatus,
  listOrders,
  ordersTotal,
  getOrder,
};
