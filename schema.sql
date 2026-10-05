-- The Shelf. One local SQLite file, no separate database server.
-- Prices are whole hryvnias, no kopiykas.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Uzhhorod',
    address TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    stock INTEGER NOT NULL CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers (id),
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'confirmed', 'shipped', 'completed', 'cancelled')),
    comment TEXT NOT NULL DEFAULT '',
    total INTEGER NOT NULL CHECK (total >= 0),
    created_at TEXT NOT NULL,
    delivery TEXT NOT NULL DEFAULT 'pickup',
    delivery_fee INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products (id),
    qty INTEGER NOT NULL CHECK (qty > 0),
    -- price at the time of the order, not the current product price
    price INTEGER NOT NULL CHECK (price > 0)
);

CREATE TABLE IF NOT EXISTS order_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    staff_name TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items (order_id);

CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff (id),
    created_at TEXT NOT NULL
);
