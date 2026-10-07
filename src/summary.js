const { STATUSES } = require("./orders");

const DAY_MS = 24 * 60 * 60 * 1000;

// How long an order may sit in this status before the desk should look at it.
// The clock starts at the history row for that status, not at orders.created_at.
const SIT_LIMIT = {
  new: 2 * DAY_MS,
  confirmed: DAY_MS,
};

function parseStamp(value) {
  const parsed = Date.parse(String(value).replace(" ", "T"));
  return Number.isNaN(parsed) ? null : parsed;
}

function sittingTooLong(db, now) {
  const moment = now || Date.now();
  const rows = db
    .prepare(
      `SELECT o.id, o.status, c.name AS customer_name,
              e.created_at AS since, e.staff_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN order_events e ON e.id = (
         SELECT id FROM order_events
         WHERE order_id = o.id AND status = o.status
         ORDER BY id DESC
         LIMIT 1
       )
       WHERE o.status IN ('new', 'confirmed')`
    )
    .all();

  const late = [];
  for (const row of rows) {
    const since = parseStamp(row.since);
    if (since === null) continue;
    const dwell = moment - since;
    if (dwell <= SIT_LIMIT[row.status]) continue;
    late.push({
      id: row.id,
      status: row.status,
      customer_name: row.customer_name,
      since: row.since,
      staff_name: row.staff_name,
      dwell_ms: dwell,
    });
  }
  late.sort((a, b) => b.dwell_ms - a.dwell_ms || a.id - b.id);
  return late;
}

function summary(db, now) {
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
  return { byStatus, lowStock, attention: sittingTooLong(db, now) };
}

module.exports = { summary, SIT_LIMIT };
