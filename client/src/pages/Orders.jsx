import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrders } from "../api";
import { money, when } from "../format";

const EMPTY = { status: "", q: "", from: "", to: "", sort: "newest" };

const SORT_FIELDS = {
  id: { asc: "id-asc", desc: "id-desc" },
  date: { asc: "oldest", desc: "newest" },
  customer: { asc: "customer-asc", desc: "customer-desc" },
  lines: { asc: "lines-asc", desc: "lines-desc" },
  total: { asc: "total-asc", desc: "total-desc" },
  status: { asc: "status-asc", desc: "status-desc" },
};

const SORT_LABELS = {
  "id-asc": "number, low to high",
  "id-desc": "number, high to low",
  oldest: "date, oldest first",
  newest: "date, newest first",
  "customer-asc": "customer, A to Z",
  "customer-desc": "customer, Z to A",
  "lines-asc": "lines, fewest first",
  "lines-desc": "lines, most first",
  "total-asc": "total, smallest first",
  "total-desc": "total, largest first",
  "status-asc": "status, new first",
  "status-desc": "status, cancelled first",
};

function sortField(sort) {
  for (const field of Object.keys(SORT_FIELDS)) {
    const pair = SORT_FIELDS[field];
    if (pair.asc === sort || pair.desc === sort) return field;
  }
  return "date";
}

function sortDir(sort) {
  const pair = SORT_FIELDS[sortField(sort)];
  return pair.asc === sort ? "asc" : "desc";
}

export default function Orders() {
  const [filters, setFilters] = useState(EMPTY);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  function load(next) {
    setFilters(next);
    getOrders(next)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load(EMPTY);
  }, []);

  function change(field, value) {
    load({ ...filters, [field]: value });
  }

  function onSort(field) {
    const current = filters.sort;
    if (sortField(current) === field) {
      const pair = SORT_FIELDS[field];
      change("sort", sortDir(current) === "asc" ? pair.desc : pair.asc);
      return;
    }
    change("sort", SORT_FIELDS[field].asc);
  }

  const active =
    filters.status ||
    filters.q ||
    filters.from ||
    filters.to ||
    filters.sort !== "newest";

  return (
    <>
      <div className="head">
        <div>
          <h2>Orders</h2>
        </div>
        <Link className="button primary" to="/orders/new">
          New order
        </Link>
      </div>
      {error ? <p className="flash err">{error}</p> : null}

      <div className="chips">
        <button
          type="button"
          className={filters.status ? "" : "on"}
          onClick={() => change("status", "")}
        >
          All
        </button>
        {(data
          ? data.statuses
          : ["new", "confirmed", "shipped", "completed", "cancelled"]
        ).map((item) => (
          <button
            key={item}
            type="button"
            className={filters.status === item ? "on" : ""}
            onClick={() => change("status", item)}
          >
            {item}
          </button>
        ))}
      </div>

      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Search
          <input
            type="text"
            value={filters.q}
            placeholder="Helen, 050, Uzhhorod, 12"
            onChange={(event) => change("q", event.target.value)}
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(event) => change("from", event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(event) => change("to", event.target.value)}
          />
        </label>
        <label>
          Sort
          <select
            value={filters.sort}
            onChange={(event) => change("sort", event.target.value)}
          >
            {Object.keys(SORT_LABELS).map((item) => (
              <option key={item} value={item}>
                {SORT_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        {active ? (
          <button type="button" onClick={() => load(EMPTY)}>
            Clear
          </button>
        ) : null}
      </form>

      {data ? (
        <p className="hint">
          Found {data.orders.length}, total {money(data.totalSum)}. A marked
          date has been new or confirmed for more than two days.
        </p>
      ) : null}

      {data && data.orders.length ? (
        <table>
          <tbody>
            <tr>
              <SortHead field="id" sort={filters.sort} onSort={onSort} className="num">
                No.
              </SortHead>
              <SortHead field="date" sort={filters.sort} onSort={onSort}>
                Date
              </SortHead>
              <th>Delivery</th>
              <SortHead field="customer" sort={filters.sort} onSort={onSort}>
                Customer
              </SortHead>
              <th>City</th>
              <th>Phone</th>
              <SortHead field="lines" sort={filters.sort} onSort={onSort}>
                Lines
              </SortHead>
              <SortHead field="total" sort={filters.sort} onSort={onSort} className="money">
                Total
              </SortHead>
              <SortHead field="status" sort={filters.sort} onSort={onSort}>
                Status
              </SortHead>
            </tr>
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td className="num">
                  <Link to={"/orders/" + order.id}>{order.id}</Link>
                </td>
                <td className={order.waiting ? "wait" : undefined}>
                  {when(order.created_at)}
                </td>
                <td>{order.delivery}</td>
                <td>{order.customer_name}</td>
                <td>{order.city}</td>
                <td>{order.phone}</td>
                <td>{order.positions}</td>
                <td className="money">{money(order.total)}</td>
                <td>
                  <span className={"status s-" + order.status}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {data && !data.orders.length ? <p>Nothing found.</p> : null}
    </>
  );
}

function SortHead({ field, sort, onSort, className, children }) {
  const active = sortField(sort) === field;
  const dir = active ? sortDir(sort) : "";
  return (
    <th
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className={active ? "sort on" : "sort"}
        onClick={() => onSort(field)}
      >
        {children}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
