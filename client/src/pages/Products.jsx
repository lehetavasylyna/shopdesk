import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getProducts } from "../api";
import { money } from "../format";

export default function Products() {
  const location = useLocation();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const note = location.state && location.state.note ? location.state.note : "";

  useEffect(() => {
    getProducts()
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <h2>Products</h2>
      <p><Link className="button" to="/products/new">New product</Link></p>
      {note ? <p className="flash ok">{note}</p> : null}
      {error ? <p className="flash err">{error}</p> : null}
      {products ? (
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th></th>
            </tr>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>{money(product.price)}</td>
                <td className={product.stock <= 3 ? "low" : undefined}>{product.stock}</td>
                <td><Link to={"/products/" + product.id}>edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="hint">Yellow means the stock is 3 or less.</p>
    </>
  );
}
