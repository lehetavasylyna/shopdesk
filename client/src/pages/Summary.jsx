import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSummary } from "../api";
import { money, when } from "../format";

function sitting(ms) {
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(ms / day);
  if (days >= 2) return days + " days";
  if (days === 1) return "1 day";
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return hours === 1 ? "1 hour" : hours + " hours";
}

export default function Summary() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSummary()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (!data) {
    return error ? (
      <p className="flash err">{error}</p>
    ) : (
      <p className="hint">Loading...</p>
    );
  }

  const orders = data.byStatus.reduce((sum, row) => sum + row.count, 0);
  const booked = data.byStatus
    .filter((row) => row.status !== "cancelled")
    .reduce((sum, row) => sum + row.total, 0);
  const peak = Math.max(1, ...data.byStatus.map((row) => row.count));

  return (
    <section className="summary">
      <header className="sum-hero">
        <div>
          <p className="sum-kicker">Overview</p>
          <h2>Summary</h2>
          <p className="sum-lead">
            Orders grouped by where they sit, products with three pieces or fewer, and orders
            that have stayed in one status too long.
          </p>
        </div>
        <div className="sum-figures">
          <div>
            <span>Booked</span>
            <b>{money(booked)}</b>
          </div>
          <div>
            <span>Orders</span>
            <b>{orders}</b>
          </div>
          <div>
            <span>To restock</span>
            <b>{data.lowStock.length}</b>
          </div>
          <div>
            <span>Sitting</span>
            <b>{data.attention.length}</b>
          </div>
        </div>
      </header>

      {error ? <p className="flash err">{error}</p> : null}

      <div className="sum-board">
        <section className="sum-panel">
          <h3>By status</h3>
          <div className="sum-mix" aria-hidden="true">
            {orders === 0 ? (
              <span className="sum-mix-empty" />
            ) : (
              data.byStatus.map((row) => (
                <span
                  key={row.status}
                  className={"s-" + row.status}
                  style={{ flexGrow: row.count, minWidth: row.count ? 8 : 0 }}
                />
              ))
            )}
          </div>
          <ul className="sum-rows">
            {data.byStatus.map((row) => (
              <li key={row.status} className={"sum-row s-" + row.status}>
                <div className="sum-row-top">
                  <span className="sum-name">{row.status}</span>
                  <span className="sum-count">{row.count}</span>
                </div>
                <div className="sum-track">
                  <span style={{ width: (row.count / peak) * 100 + "%" }} />
                </div>
                <span className="sum-money">{money(row.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="sum-panel">
          <h3>Low stock</h3>
          <p className="hint">The same yellow mark is on the product list.</p>
          {data.lowStock.length === 0 ? (
            <p className="sum-empty">Nothing is that low.</p>
          ) : (
            <ul className="sum-stock">
              {data.lowStock.map((product) => (
                <li key={product.id}>
                  <Link to={"/products/" + product.id}>
                    <span className={product.stock === 0 ? "sum-qty out" : "sum-qty"}>
                      {product.stock}
                    </span>
                    <span className="sum-product">
                      <b>{product.name}</b>
                      <span>{product.category}</span>
                    </span>
                    <span className="sum-price">{money(product.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="sum-panel sum-sit">
        <h3>Sitting too long</h3>
        <p className="hint">
          A new order appears after two days. A confirmed one appears after one day. The clock
          starts when the status changed, not when the order was written.
        </p>
        {data.attention.length === 0 ? (
          <p className="sum-empty">Nothing has been sitting past its limit.</p>
        ) : (
          <ul className="sum-sit-list">
            {data.attention.map((row) => (
              <li key={row.id}>
                <Link to={"/orders/" + row.id}>
                  <span className={"sum-sit-time s-" + row.status}>{sitting(row.dwell_ms)}</span>
                  <span className="sum-product">
                    <b>
                      #{row.id} {row.customer_name}
                    </b>
                    <span>
                      {row.status} since {when(row.since)}
                      {row.staff_name ? " · " + row.staff_name : ""}
                    </span>
                  </span>
                  <span className={"status s-" + row.status}>{row.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
