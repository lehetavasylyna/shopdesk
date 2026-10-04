import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createProduct, deleteProduct, getProduct, getProducts, updateProduct } from "../api";

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Kitchen");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categories, setCategories] = useState(["Kitchen", "Tableware", "Textiles", "Household"]);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!editing) {
      getProducts()
        .then((data) => {
          setCategories(data.categories);
          if (data.categories[0]) setCategory(data.categories[0]);
        })
        .catch((err) => setError(err.message));
      return;
    }
    getProduct(id)
      .then((data) => {
        setName(data.product.name);
        setCategory(data.product.category);
        setPrice(String(data.product.price));
        setStock(String(data.product.stock));
        setCategories(data.categories);
      })
      .catch((err) => {
        if (err.status === 404) setMissing(true);
        else setError(err.message);
      });
  }, [id]);

  function onSubmit(event) {
    event.preventDefault();
    setError("");
    const body = { name, category, price, stock };
    const action = editing ? updateProduct(id, body) : createProduct(body);
    action
      .then(() => navigate("/products", { state: { note: editing ? "Saved" : "Product added" } }))
      .catch((err) => setError(err.message));
  }

  function onDelete() {
    if (!window.confirm("Delete this product?")) return;
    deleteProduct(id)
      .then(() => navigate("/products", { state: { note: "Product deleted" } }))
      .catch((err) => setError(err.message));
  }

  if (missing) {
    return (
      <>
        <h2>No such page</h2>
        <p><Link to="/products">back to the list</Link></p>
      </>
    );
  }

  return (
    <>
      <h2>{editing ? name || "Product" : "New product"}</h2>
      {error ? <p className="flash err">{error}</p> : null}
      <form className="box" onSubmit={onSubmit}>
        <label>Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>Price, UAH
          <input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
        <label>Stock, pcs
          <input type="number" min="0" value={stock} onChange={(event) => setStock(event.target.value)} />
        </label>
        <p><button className="primary" type="submit">Save</button></p>
      </form>
      {editing ? (
        <>
          <button type="button" onClick={onDelete}>Delete product</button>
          <p className="hint">If the product is already on an order, the database will not let it go.</p>
        </>
      ) : null}
      <p><Link to="/products">back to the list</Link></p>
    </>
  );
}
