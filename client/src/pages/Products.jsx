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
      <div className="head">
        <div>
          <h2>Products</h2>
          <p className="hint">Yellow means three pieces or fewer are left.</p>
        </div>
        <Link className="button primary" to="/products/new">New product</Link>
      </div>
      {note ? <p className="flash ok">{note}</p> : null}
      {error ? <p className="flash err">{error}</p> : null}
      {products ? (
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th className="money">Price</th>
              <th>Stock</th>
              <th></th>
            </tr>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td className="money">{money(product.price)}</td>
                <td className={product.stock <= 3 ? "low" : undefined}>{product.stock}</td>
                <td><Link to={"/products/" + product.id}>edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
