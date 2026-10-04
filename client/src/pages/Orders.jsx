import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOrders } from "../api";
import { money, when } from "../format";

export default function Orders() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  function load(nextStatus, nextQuery) {
    getOrders(nextStatus, nextQuery)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load("", "");
  }, []);

  function onSubmit(event) {
    event.preventDefault();
    load(status, query);
  }

  return (
    <>
      <h2>Orders</h2>
      <p><Link className="button" to="/orders/new">New order</Link></p>
      {error ? <p className="flash err">{error}</p> : null}

      <form className="filters" onSubmit={onSubmit}>
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">all</option>
            {(data ? data.statuses : []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>Search
          <input
            type="text"
            value={query}
            placeholder="name or phone"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="submit">Show</button>
      </form>

      {data ? (
        <p className="hint">
          Found {data.orders.length}, total {money(data.totalSum)}. This is the filtered total, not the whole till.
        </p>
      ) : null}

      {data && data.orders.length ? (
        <table>
          <tbody>
            <tr>
              <th className="num">No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Lines</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td className="num"><Link to={"/orders/" + order.id}>{order.id}</Link></td>
                <td>{when(order.created_at)}</td>
                <td>{order.customer_name}</td>
                <td>{order.phone}</td>
                <td>{order.positions}</td>
                <td>{money(order.total)}</td>
                <td className={"status s-" + order.status}>{order.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {data && !data.orders.length ? <p>Nothing found.</p> : null}
    </>
  );
}
