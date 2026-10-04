import { useEffect, useState } from "react";
import { createCustomer, getCustomers } from "../api";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Uzhhorod");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function load() {
    getCustomers()
      .then((data) => setCustomers(data.customers))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  function onSubmit(event) {
    event.preventDefault();
    setNote("");
    setError("");
    createCustomer({ name, phone, city, address })
      .then(() => {
        setName("");
        setPhone("");
        setCity("Uzhhorod");
        setAddress("");
        setNote("Customer saved");
        load();
      })
      .catch((err) => setError(err.message));
  }

  return (
    <>
      <h2>Customers</h2>
      {note ? <p className="flash ok">{note}</p> : null}
      {error ? <p className="flash err">{error}</p> : null}
      <form className="box" onSubmit={onSubmit}>
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
        <p><button className="primary" type="submit">Save</button></p>
      </form>
      <p className="hint">{customers.length} in the list.</p>
      <table>
        <tbody>
          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>City</th>
            <th>Address</th>
          </tr>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>{customer.name}</td>
              <td>{customer.phone}</td>
              <td>{customer.city}</td>
              <td>{customer.address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
