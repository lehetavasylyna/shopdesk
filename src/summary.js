const { STATUSES } = require("./orders");

function summary(db) {
  const rowFor = db.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM orders WHERE status = ?"
  );
  const byStatus = STATUSES.map((status) => {
    const row = rowFor.get(status);
    return { status, count: row.count, total: row.total };
  });
  const lowStock = db
    .prepare("SELECT id, name, category, stock, price FROM products WHERE stock <= 3 ORDER BY stock, name")
    .all();
  return { byStatus, lowStock };
}

module.exports = { summary };
