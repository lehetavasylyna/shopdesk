import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createCustomer, getCustomers } from "../api";

const EMPTY = { q: "", city: "", sort: "name-asc" };

const SORT_LABELS = {
  "name-asc": "name, A to Z",
  "name-desc": "name, Z to A",
};

export default function Customers() {
  const [filters, setFilters] = useState(EMPTY);
  const [data, setData] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Uzhhorod");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function load(next) {
    setFilters(next);
    getCustomers(next)
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

  function onName() {
    change("sort", filters.sort === "name-asc" ? "name-desc" : "name-asc");
  }

  const active = filters.q || filters.city || filters.sort !== "name-asc";
  const customers = data ? data.customers : [];

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
        load(filters);
      })
      .catch((err) => setError(err.message));
  }

  return (
    <>
      <div className="head">
        <div>
          <h2>Customers</h2>
          <p className="hint">
            {data && !customers.length && !active
              ? "No one yet."
              : "Open a name to see their orders."}
          </p>
        </div>
      </div>
      {note ? <p className="flash ok">{note}</p> : null}
      {error ? <p className="flash err">{error}</p> : null}
      <form className="box" onSubmit={onSubmit}>
        <div className="fields">
          <label>
            Name
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Phone
            <input
              type="text"
              value={phone}
              placeholder="050 000 00 00"
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label>
            City
            <input type="text" value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label>
            Address
            <input type="text" value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
        </div>
        <p>
          <button className="primary" type="submit">
            Save
          </button>
        </p>
      </form>

      <div className="chips">
        <button type="button" className={filters.city ? "" : "on"} onClick={() => change("city", "")}>
          All
        </button>
        {(data ? data.cities : []).map((item) => (
          <button
            key={item}
            type="button"
            className={filters.city === item ? "on" : ""}
            onClick={() => change("city", item)}
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
            placeholder="Helen, 050, Korzo"
            onChange={(event) => change("q", event.target.value)}
          />
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

      {data ? <p className="hint">Found {customers.length}.</p> : null}

      {customers.length ? (
        <table>
          <tbody>
            <tr>
              <th aria-sort={filters.sort === "name-asc" ? "ascending" : "descending"}>
                <button type="button" className="sort on" onClick={onName}>
                  Name {filters.sort === "name-asc" ? "↑" : "↓"}
                </button>
              </th>
              <th>Phone</th>
              <th>City</th>
              <th>Address</th>
            </tr>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link to={"/customers/" + customer.id}>{customer.name}</Link>
                </td>
                <td>{customer.phone}</td>
                <td>{customer.city}</td>
                <td>{customer.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {data && !customers.length && active ? <p>Nothing found.</p> : null}
    </>
  );
}
