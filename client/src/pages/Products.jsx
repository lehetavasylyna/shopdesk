import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getProducts } from "../api";
import { money } from "../format";

const EMPTY = { q: "", category: "", stock: "", sort: "name-asc" };
const FALLBACK = ["Kitchen", "Tableware", "Textiles", "Household"];

const SORT_FIELDS = {
  name: { asc: "name-asc", desc: "name-desc" },
  price: { asc: "price-asc", desc: "price-desc" },
  stock: { asc: "stock-asc", desc: "stock-desc" },
};

const SORT_LABELS = {
  "name-asc": "name, A to Z",
  "name-desc": "name, Z to A",
  "price-asc": "price, low to high",
  "price-desc": "price, high to low",
  "stock-asc": "stock, low to high",
  "stock-desc": "stock, high to low",
};

function sortField(sort) {
  for (const field of Object.keys(SORT_FIELDS)) {
    const pair = SORT_FIELDS[field];
    if (pair.asc === sort || pair.desc === sort) return field;
  }
  return "name";
}

function sortDir(sort) {
  const pair = SORT_FIELDS[sortField(sort)];
  return pair.asc === sort ? "asc" : "desc";
}

export default function Products() {
  const location = useLocation();
  const [filters, setFilters] = useState(EMPTY);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const note = location.state && location.state.note ? location.state.note : "";

  function load(next) {
    setFilters(next);
    getProducts(next)
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

  const active = filters.q || filters.category || filters.stock || filters.sort !== "name-asc";
  const products = data ? data.products : null;
  const categories = data ? data.categories : FALLBACK;

  return (
    <>
      <div className="head">
        <div>
          <h2>Products</h2>
        </div>
        <Link className="button primary" to="/products/new">
          New product
        </Link>
      </div>
      {note ? <p className="flash ok">{note}</p> : null}
      {error ? <p className="flash err">{error}</p> : null}

      <div className="chips">
        <button
          type="button"
          className={filters.category ? "" : "on"}
          onClick={() => change("category", "")}
        >
          All
        </button>
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={filters.category === item ? "on" : ""}
            onClick={() => change("category", item)}
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
            placeholder="kettle, lamp"
            onChange={(event) => change("q", event.target.value)}
          />
        </label>
        <label>
          Stock
          <select value={filters.stock} onChange={(event) => change("stock", event.target.value)}>
            <option value="">any</option>
            <option value="low">3 or fewer</option>
          </select>
        </label>
        <label>
          Sort
          <select value={filters.sort} onChange={(event) => change("sort", event.target.value)}>
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

      {products ? <p className="hint">Found {products.length}.</p> : null}

      {products && products.length ? (
        <table>
          <tbody>
            <tr>
              <SortHead field="name" sort={filters.sort} onSort={onSort}>
                Name
              </SortHead>
              <th>Category</th>
              <SortHead field="price" sort={filters.sort} onSort={onSort} className="money">
                Price
              </SortHead>
              <SortHead field="stock" sort={filters.sort} onSort={onSort}>
                Stock
              </SortHead>
              <th></th>
            </tr>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td className="money">{money(product.price)}</td>
                <td className={product.stock <= 3 ? "low" : undefined}>{product.stock}</td>
                <td>
                  <Link to={"/products/" + product.id}>edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {products && !products.length ? <p>Nothing found.</p> : null}
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
