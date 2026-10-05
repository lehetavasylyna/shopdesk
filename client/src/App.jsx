import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { getMe, logout } from "./api";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import OrderForm from "./pages/OrderForm";
import OrderPage from "./pages/OrderPage";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import Customers from "./pages/Customers";
import CustomerPage from "./pages/CustomerPage";
import Summary from "./pages/Summary";
import NotFound from "./pages/NotFound";

function linkClass(props) {
  return props.isActive ? "here" : undefined;
}

export default function App() {
  const [staff, setStaff] = useState(undefined);

  useEffect(() => {
    getMe()
      .then((data) => setStaff(data.staff))
      .catch(() => setStaff(null));
  }, []);

  if (staff === undefined) {
    return <p className="hint loading">Loading...</p>;
  }

  if (!staff) {
    return <Login onIn={setStaff} />;
  }

  function onOut() {
    logout().then(() => setStaff(null)).catch(() => setStaff(null));
  }

  return (
    <>
      <div className="top">
        <div className="top-inner">
          <NavLink className="brand" to="/">
            <span className="mark">The Shelf</span>
            <span className="tag">order desk</span>
          </NavLink>
          <nav>
            <NavLink to="/" end className={linkClass}>Orders</NavLink>
            <NavLink to="/orders/new" className={linkClass}>New order</NavLink>
            <NavLink to="/products" className={linkClass}>Products</NavLink>
            <NavLink to="/customers" className={linkClass}>Customers</NavLink>
            <NavLink to="/summary" className={linkClass}>Summary</NavLink>
            <button type="button" className="nav-out" onClick={onOut}>Sign out</button>
          </nav>
        </div>
      </div>
      <div className="page">
        <main className="sheet">
        <Routes>
          <Route path="/" element={<Orders />} />
          <Route path="/orders/new" element={<OrderForm />} />
          <Route path="/orders/:id" element={<OrderPage />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<ProductForm />} />
          <Route path="/products/:id" element={<ProductForm />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerPage />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </main>
        <p className="foot">Orders, stock and customers live in the local file shop.db.</p>
      </div>
    </>
  );
}
