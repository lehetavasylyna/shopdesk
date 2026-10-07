import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSummary } from "../api";
import { money } from "../format";

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

  return (
    <>
      <div className="head">
        <div>
          <h2>Summary</h2>
        </div>
      </div>
      {error ? <p className="flash err">{error}</p> : null}
      <div className="stats">
        {data.byStatus.map((row) => (
          <div className="stat" key={row.status}>
            <span className={"status s-" + row.status}>{row.status}</span>
            <b>{row.count}</b>
            <span className="quiet">{money(row.total)}</span>
          </div>
        ))}
      </div>
      <table>
        <tbody>
          <tr>
            <th>Status</th>
            <th>Orders</th>
            <th className="money">Sum</th>
          </tr>
          {data.byStatus.map((row) => (
            <tr key={row.status}>
              <td>
                <span className={"status s-" + row.status}>{row.status}</span>
              </td>
              <td>{row.count}</td>
              <td className="money">{money(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Low stock</h3>
      <p className="hint">
        Three pieces or fewer. The same yellow mark is on the product list.
      </p>
      {data.lowStock.length === 0 ? (
        <p className="hint">Nothing is that low.</p>
      ) : null}
      <table>
        <tbody>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Stock</th>
            <th className="money">Price</th>
          </tr>
          {data.lowStock.map((product) => (
            <tr key={product.id}>
              <td>
                <Link to={"/products/" + product.id}>{product.name}</Link>
              </td>
              <td>{product.category}</td>
              <td className="low">{product.stock}</td>
              <td className="money">{money(product.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
