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

function prepare(db, seed) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
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
