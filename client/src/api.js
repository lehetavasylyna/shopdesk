async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function send(url, method, body) {
  return request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

export function getOrders(status, q) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const query = params.toString();
  return request("/api/orders" + (query ? "?" + query : ""));
}

export function getOrder(id) {
  return request("/api/orders/" + id);
}

export function createOrder(body) {
  return send("/api/orders", "POST", body);
}

export function changeStatus(id, status) {
  return send("/api/orders/" + id + "/status", "POST", { status });
}

export function getProducts() {
  return request("/api/products");
}

export function getProduct(id) {
  return request("/api/products/" + id);
}

export function createProduct(body) {
  return send("/api/products", "POST", body);
}

export function updateProduct(id, body) {
  return send("/api/products/" + id, "PUT", body);
}

export function deleteProduct(id) {
  return request("/api/products/" + id, { method: "DELETE" });
}

export function getCustomers() {
  return request("/api/customers");
}

export function createCustomer(body) {
  return send("/api/customers", "POST", body);
}
