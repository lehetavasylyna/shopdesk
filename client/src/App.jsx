import { NavLink, Route, Routes } from "react-router-dom";
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
  return (
    <>
      <div className="top">
        <div className="top-inner">
          <NavLink className="brand" to="/">The Shelf</NavLink>
          <nav>
            <NavLink to="/" end className={linkClass}>Orders</NavLink>
            <NavLink to="/orders/new" className={linkClass}>New order</NavLink>
            <NavLink to="/products" className={linkClass}>Products</NavLink>
            <NavLink to="/customers" className={linkClass}>Customers</NavLink>
            <NavLink to="/summary" className={linkClass}>Summary</NavLink>
          </nav>
        </div>
      </div>
      <div className="page">
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
        <p className="foot">The database is the file shop.db next to the program.</p>
      </div>
    </>
  );
}
