import { useState } from "react";
import { login } from "../api";

export default function Login({ onIn }) {
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function onSubmit(event) {
    event.preventDefault();
    setError("");
    login({ login: loginName, password })
      .then((data) => onIn(data.staff))
      .catch((err) => setError(err.message));
  }

  return (
    <>
      <div className="top">
        <div className="top-inner">
          <span className="brand">
            <span className="mark">The Shelf</span>
            <span className="tag">order desk</span>
          </span>
        </div>
      </div>
      <div className="page">
        <main className="sheet login">
          <h2>Sign in</h2>
          <p className="hint">The order desk is for the shop, not for visitors.</p>
          {error ? <p className="flash err">{error}</p> : null}
          <form className="box" onSubmit={onSubmit}>
            <label>Login
              <input type="text" value={loginName} onChange={(event) => setLoginName(event.target.value)} />
            </label>
            <label>Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <p><button className="primary" type="submit">Sign in</button></p>
          </form>
        </main>
      </div>
    </>
  );
}
