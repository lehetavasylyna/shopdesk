import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrders } from "../api";
import { money, when } from "../format";

const EMPTY = { status: "", q: "", from: "", to: "", sort: "newest" };

const SORT_LABELS = {
  newest: "newest first",
  oldest: "oldest first",
  "total-desc": "largest total",
  "total-asc": "smallest total",
};

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

  const active = filters.status || filters.q || filters.from || filters.to || filters.sort !== "newest";

  return (
    <>
      <div className="head">
        <div>
          <h2>Orders</h2>
          <p className="hint">Filter by status or date, or search by name, phone, city, comment or order number.</p>
        </div>
        <Link className="button primary" to="/orders/new">New order</Link>
      </div>
      {error ? <p className="flash err">{error}</p> : null}

      <div className="chips">
        <button type="button" className={filters.status ? "" : "on"} onClick={() => change("status", "")}>All</button>
        {(data ? data.statuses : ["new", "confirmed", "shipped", "completed", "cancelled"]).map((item) => (
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
        <label>Search
          <input
            type="text"
            value={filters.q}
            placeholder="Helen, 050, Uzhhorod, 12"
            onChange={(event) => change("q", event.target.value)}
          />
        </label>
        <label>From
          <input type="date" value={filters.from} onChange={(event) => change("from", event.target.value)} />
        </label>
        <label>To
          <input type="date" value={filters.to} onChange={(event) => change("to", event.target.value)} />
        </label>
        <label>Sort
          <select value={filters.sort} onChange={(event) => change("sort", event.target.value)}>
            {Object.keys(SORT_LABELS).map((item) => (
              <option key={item} value={item}>{SORT_LABELS[item]}</option>
            ))}
          </select>
        </label>
        {active ? <button type="button" onClick={() => load(EMPTY)}>Clear</button> : null}
      </form>

      {data ? (
        <p className="hint">
          Found {data.orders.length}, total {money(data.totalSum)}. A marked date has been new or confirmed for more than two days.
        </p>
      ) : null}

      {data && data.orders.length ? (
        <table>
          <tbody>
            <tr>
              <th className="num">No.</th>
              <th>Date</th>
              <th>Delivery</th>
              <th>Customer</th>
              <th>City</th>
              <th>Phone</th>
              <th>Lines</th>
              <th className="money">Total</th>
              <th>Status</th>
            </tr>
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td className="num"><Link to={"/orders/" + order.id}>{order.id}</Link></td>
                <td className={order.waiting ? "wait" : undefined}>{when(order.created_at)}</td>
                <td>{order.delivery}</td>
                <td>{order.customer_name}</td>
                <td>{order.city}</td>
                <td>{order.phone}</td>
                <td>{order.positions}</td>
                <td className="money">{money(order.total)}</td>
                <td><span className={"status s-" + order.status}>{order.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {data && !data.orders.length ? <p>Nothing found.</p> : null}
    </>
  );
}
