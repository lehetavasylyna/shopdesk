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

function listCustomers(db) {
  return db.prepare("SELECT * FROM customers ORDER BY name").all();
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

module.exports = { addCustomer, listCustomers, getCustomer, customerWithOrders };
