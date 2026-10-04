import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOrder, getCustomers, getProducts } from "../api";
import { money } from "../format";

const EMPTY_LINE = { product_id: "", qty: 1 };

export default function OrderForm() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Uzhhorod");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [lines, setLines] = useState([EMPTY_LINE, EMPTY_LINE, EMPTY_LINE, EMPTY_LINE]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCustomers().then((data) => setCustomers(data.customers)).catch((err) => setError(err.message));
    getProducts()
      .then((data) => {
        setProducts(data.products);
        setLoaded(true);
      })
      .catch((err) => setError(err.message));
  }, []);

  function changeLine(index, field, value) {
    setLines(lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function onSubmit(event) {
    event.preventDefault();
    setError("");
    createOrder({
      customer_id: customerId,
      name,
      phone,
      city,
      address,
      comment,
      lines,
    })
      .then((result) => navigate("/orders/" + result.id, { state: { note: "Order saved" } }))
      .catch((err) => setError(err.message));
  }

  return (
    <>
      <h2>New order</h2>
      <p className="hint">The total is taken from the price in the database. Stock is reduced as soon as the order is saved.</p>
      {error ? <p className="flash err">{error}</p> : null}
      {loaded && !products.length ? <p className="flash err">Add at least one product first.</p> : null}

      <form className="box" onSubmit={onSubmit}>
        <label htmlFor="customer_id">Customer</label>
        <select id="customer_id" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          <option value="">— choose —</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}, {customer.phone}</option>
          ))}
          <option value="new">new customer</option>
        </select>

        <p className="hint">Fill in the fields below only if you chose “new customer”.</p>
        <label>Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>Phone
          <input type="text" value={phone} placeholder="050 000 00 00" onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label>City
          <input type="text" value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        <label>Address
          <input type="text" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>

        <h3>Products</h3>
        <div>
          {lines.map((line, index) => (
            <div className="line" key={index}>
              <select value={line.product_id} onChange={(event) => changeLine(index, "product_id", event.target.value)}>
                <option value="">— product —</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {money(product.price)}, stock {product.stock}
                  </option>
                ))}
              </select>
              <input
                className="qty"
                type="number"
                min="1"
                value={line.qty}
                onChange={(event) => changeLine(index, "qty", event.target.value)}
              />
            </div>
          ))}
        </div>
        <p>
          <button type="button" onClick={() => setLines(lines.concat([{ ...EMPTY_LINE }]))}>another line</button>
        </p>

        <label>Comment, if you need one
          <textarea rows="3" value={comment} onChange={(event) => setComment(event.target.value)} />
        </label>
        <p><button className="primary" type="submit">Save order</button></p>
      </form>
    </>
  );
}
