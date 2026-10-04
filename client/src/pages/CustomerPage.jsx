import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCustomer } from "../api";
import { money, when } from "../format";

export default function CustomerPage() {
  const { id } = useParams();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getCustomer(id)
      .then((data) => {
        setPack(data);
        setMissing(false);
      })
      .catch((err) => {
        if (err.status === 404) setMissing(true);
        else setError(err.message);
      });
  }, [id]);

  if (missing) {
    return (
      <>
        <h2>No such page</h2>
        <p><Link to="/customers">back to customers</Link></p>
      </>
    );
  }

  if (!pack) {
    return error ? <p className="flash err">{error}</p> : <p className="hint">Loading...</p>;
  }

  const person = pack.customer;

  return (
    <>
      <h2>{person.name}</h2>
      {error ? <p className="flash err">{error}</p> : null}
      <p>
        {person.phone}<br />
        {person.city}{person.address ? ", " + person.address : ""}
      </p>
      <h3>Orders</h3>
      {pack.orders.length === 0 ? <p className="hint">No orders yet.</p> : null}
      <table>
        <tbody>
          <tr>
            <th>No.</th>
            <th>Date</th>
            <th>Status</th>
            <th>Lines</th>
            <th>Total</th>
          </tr>
          {pack.orders.map((order) => (
            <tr key={order.id}>
              <td><Link to={"/orders/" + order.id}>{order.id}</Link></td>
              <td>{when(order.created_at)}</td>
              <td><span className={"status s-" + order.status}>{order.status}</span></td>
              <td>{order.positions}</td>
              <td>{money(order.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><Link to="/customers">back to customers</Link></p>
    </>
  );
}
