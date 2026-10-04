import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { changeStatus, getOrder, getProducts, updateOrder } from "../api";
import { money, when } from "../format";

export default function OrderPage() {
  const { id } = useParams();
  const location = useLocation();
  const [pack, setPack] = useState(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState(location.state && location.state.note ? location.state.note : "");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [products, setProducts] = useState([]);
  const [lines, setLines] = useState([]);
  const [comment, setComment] = useState("");

  function load() {
    getOrder(id)
      .then((data) => {
        setPack(data);
        setStatus(data.nextStatuses[0] || "");
        setLines(data.items.map((item) => ({ product_id: String(item.product_id), qty: item.qty })));
        setComment(data.order.comment || "");
        setMissing(false);
      })
      .catch((err) => {
        if (err.status === 404) setMissing(true);
        else setError(err.message);
      });
  }

  useEffect(() => {
    load();
    getProducts().then((data) => setProducts(data.products)).catch(() => {});
  }, [id]);

  function changeLine(index, field, value) {
    setLines(lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  function onSaveLines(event) {
    event.preventDefault();
    setNote("");
    setError("");
    updateOrder(id, { lines, comment })
      .then(() => {
        setNote("Order updated");
        load();
      })
      .catch((err) => setError(err.message));
  }

  function onSubmit(event) {
    event.preventDefault();
    setNote("");
    setError("");
    changeStatus(id, status)
      .then(() => {
        setNote("Status updated");
        load();
      })
      .catch((err) => setError(err.message));
  }

  if (missing) {
    return (
      <>
        <h2>No such page</h2>
        <p><Link to="/">back to orders</Link></p>
      </>
    );
  }

  if (!pack) {
    return error ? <p className="flash err">{error}</p> : <p className="hint">Loading...</p>;
  }

  const order = pack.order;

  return (
    <>
      <h2>Order #{order.id}</h2>
      {note ? <p className="flash ok">{note}</p> : null}
      {error ? <p className="flash err">{error}</p> : null}
      <p>
        <Link to={"/customers/" + order.customer_id}>{order.customer_name}</Link>, {order.phone}<br />
        {order.city}{order.address ? ", " + order.address : ""}
      </p>
      <p>
        Date: {when(order.created_at)}<br />
        Status: <b className={"status s-" + order.status}>{order.status}</b>
      </p>
      {order.comment ? <p>Comment: {order.comment}</p> : null}

      <table>
        <tbody>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Sum</th>
          </tr>
          {pack.items.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td>{item.qty}</td>
              <td>{money(item.price)}</td>
              <td>{money(item.line_sum)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan="3"><b>Total</b></td>
            <td><b>{money(order.total)}</b></td>
          </tr>
        </tbody>
      </table>
      <p className="hint">The price on a line is the one from the moment of the order. If the product gets more expensive later, this receipt stays as it was. A product added later takes today's price.</p>

      {order.status === "new" || order.status === "confirmed" ? (
        <form className="box" onSubmit={onSaveLines}>
          <h3>Change the lines</h3>
          <p className="hint">Only while the order is new or confirmed. After shipping the receipt stays as it is.</p>
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
          <p>
            <button type="button" onClick={() => setLines(lines.concat([{ product_id: "", qty: 1 }]))}>another line</button>
          </p>
          <label>Comment
            <textarea rows="3" value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          <p><button className="primary" type="submit">Save changes</button></p>
        </form>
      ) : null}

      {pack.nextStatuses.length ? (
        <form className="box" onSubmit={onSubmit}>
          <label>Move to
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {pack.nextStatuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="primary" type="submit">Change status</button>
        </form>
      ) : (
        <p className="hint">This status is final. It is not changed after this.</p>
      )}

      <h3>What happened</h3>
      <ul className="log">
        {pack.events.map((event, index) => (
          <li key={index}>{when(event.created_at)} — {event.status}</li>
        ))}
      </ul>
      <p><Link to="/">back to the list</Link></p>
    </>
  );
}
