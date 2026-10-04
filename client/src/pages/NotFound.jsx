import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <>
      <h2>No such page</h2>
      <p><Link to="/">back to orders</Link></p>
    </>
  );
}
