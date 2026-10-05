const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { ShopError } = require("./errors");

const SCHEMA_PATH = path.join(__dirname, "..", "schema.sql");

function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

function hasColumn(db, table, name) {
  return db.prepare("PRAGMA table_info(" + table + ")").all().some((column) => column.name === name);
}

function migrate(db) {
  if (!hasColumn(db, "orders", "delivery")) {
    db.exec("ALTER TABLE orders ADD COLUMN delivery TEXT NOT NULL DEFAULT 'pickup'");
  }
  if (!hasColumn(db, "orders", "delivery_fee")) {
    db.exec("ALTER TABLE orders ADD COLUMN delivery_fee INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn(db, "order_events", "staff_name")) {
    db.exec("ALTER TABLE order_events ADD COLUMN staff_name TEXT NOT NULL DEFAULT ''");
  }
}

function prepare(db, seed) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  migrate(db);
  if (seed) require("./seed").seedIfEmpty(db);
}

function clean(value) {
  return String(value || "").trim();
}

function asInt(value, message) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  if (!/^-?\d+$/.test(text)) throw new ShopError(message);
  return Number(text);
}

module.exports = { openDb, prepare, clean, asInt };
