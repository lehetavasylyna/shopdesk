const { ShopError } = require("./errors");
const { asInt, clean } = require("./db");

const CATEGORIES = ["Kitchen", "Tableware", "Textiles", "Household"];

function productFields(name, category, price, stock) {
  name = clean(name);
  category = clean(category);
  if (name.length < 2) throw new ShopError("Enter the product name");
  if (!CATEGORIES.includes(category)) throw new ShopError("Pick a category from the list");
  price = asInt(price, "Price has to be a whole number");
  stock = asInt(stock, "Stock has to be a whole number");
  if (price <= 0) throw new ShopError("Price has to be greater than zero");
  if (stock < 0) throw new ShopError("Stock cannot be negative");
  return { name, category, price, stock };
}

function addProduct(db, name, category, price, stock) {
  const fields = productFields(name, category, price, stock);
  const info = db
    .prepare("INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)")
    .run(fields.name, fields.category, fields.price, fields.stock);
  return Number(info.lastInsertRowid);
}

function updateProduct(db, productId, name, category, price, stock) {
  if (!getProduct(db, productId)) throw new ShopError("Product not found");
  const fields = productFields(name, category, price, stock);
  db.prepare("UPDATE products SET name = ?, category = ?, price = ?, stock = ? WHERE id = ?").run(
    fields.name,
    fields.category,
    fields.price,
    fields.stock,
    productId
  );
}

function deleteProduct(db, productId) {
  try {
    const info = db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    if (info.changes === 0) throw new ShopError("Product not found");
  } catch (err) {
    if (err instanceof ShopError) throw err;
    if (String(err.code || "").includes("CONSTRAINT")) {
      throw new ShopError("This product is already in an order, so it cannot be deleted");
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

module.exports = {
  CATEGORIES,
  addProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  getProduct,
};
