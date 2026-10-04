import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { changeStatus, getOrder } from "../api";
import { money, when } from "../format";

export default function OrderPage() {
  const { id } = useParams();
  const location = useLocation();
  const [pack, setPack] = useState(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState(location.state && location.state.note ? location.state.note : "");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  function load() {
    getOrder(id)
      .then((data) => {
        setPack(data);
        setStatus(data.nextStatuses[0] || "");
        setMissing(false);
      })
      .catch((err) => {
        if (err.status === 404) setMissing(true);
        else setError(err.message);
      });
  }

  useEffect(() => {
    load();
  }, [id]);

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
        {order.customer_name}, {order.phone}<br />
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
      <p className="hint">The price on a line is the one from the moment of the order. If the product gets more expensive later, this receipt stays as it was.</p>

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
