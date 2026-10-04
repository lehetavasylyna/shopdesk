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
    return error ? <p className="flash err">{error}</p> : <p className="hint">Loading...</p>;
  }

  return (
    <>
      <h2>Summary</h2>
      {error ? <p className="flash err">{error}</p> : null}
      <p className="hint">Counts and sums for every status. Cancelled orders are listed, but they are not money that came in.</p>
      <table>
        <tbody>
          <tr>
            <th>Status</th>
            <th>Orders</th>
            <th>Sum</th>
          </tr>
          {data.byStatus.map((row) => (
            <tr key={row.status}>
              <td><span className={"status s-" + row.status}>{row.status}</span></td>
              <td>{row.count}</td>
              <td>{money(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Low stock</h3>
      <p className="hint">Three pieces or fewer. The same yellow mark is on the product list.</p>
      {data.lowStock.length === 0 ? <p className="hint">Nothing is that low.</p> : null}
      <table>
        <tbody>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Price</th>
          </tr>
          {data.lowStock.map((product) => (
            <tr key={product.id}>
              <td><Link to={"/products/" + product.id}>{product.name}</Link></td>
              <td>{product.category}</td>
              <td className="low">{product.stock}</td>
              <td>{money(product.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
