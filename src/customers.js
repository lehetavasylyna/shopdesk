const { ShopError } = require("./errors");
const { clean } = require("./db");

function addCustomer(db, name, phone, city, address) {
  name = clean(name);
  phone = clean(phone);
  city = clean(city) || "Uzhhorod";
  address = clean(address);
  if (name.length < 2) throw new ShopError("Enter the customer name");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) throw new ShopError("The phone number needs at least 10 digits");
  const info = db
    .prepare("INSERT INTO customers (name, phone, city, address) VALUES (?, ?, ?, ?)")
    .run(name, phone, city, address);
  return Number(info.lastInsertRowid);
}

const CUSTOMER_SORTS = {
  "name-asc": (a, b) =>
    String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" }) || a.id - b.id,
  "name-desc": (a, b) =>
    String(b.name).localeCompare(String(a.name), "en", { sensitivity: "base" }) || a.id - b.id,
};

function listCustomers(db, query, city, sort) {
  const all = db.prepare("SELECT * FROM customers").all();
  const cities = [...new Set(all.map((row) => row.city))].sort((a, b) =>
    String(a).localeCompare(String(b), "en", { sensitivity: "base" })
  );
  let rows = all;
  const needle = String(query || "").trim().toLowerCase();
  if (needle) {
    // Same reason as the order list: SQLite lower() is unreliable for every letter.
    rows = rows.filter((row) =>
      [row.name, row.phone, row.city, row.address].some((part) =>
        String(part || "").toLowerCase().includes(needle)
      )
    );
  }
  const wanted = String(city || "").trim();
  const applied = cities.includes(wanted) ? wanted : "";
  if (applied) rows = rows.filter((row) => row.city === applied);
  const key = CUSTOMER_SORTS[sort] ? sort : "name-asc";
  rows.sort(CUSTOMER_SORTS[key]);
  return { customers: rows, cities, city: applied, query: String(query || ""), sort: key };
}

function getCustomer(db, customerId) {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
}

function customerWithOrders(db, customerId) {
  const customer = getCustomer(db, customerId);
  if (!customer) return null;
  const orders = db
    .prepare(
      `SELECT id, status, total, created_at,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = orders.id) AS positions
       FROM orders
       WHERE customer_id = ?
       ORDER BY created_at DESC, id DESC`
    )
    .all(customerId);
  return { customer, orders };
}

module.exports = { addCustomer, listCustomers, CUSTOMER_SORTS, getCustomer, customerWithOrders };
