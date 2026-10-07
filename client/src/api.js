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

export function getOrders(filters) {
  const input = filters || {};
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (input.q) params.set("q", input.q);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.sort && input.sort !== "newest") params.set("sort", input.sort);
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

export function updateOrder(id, body) {
  return send("/api/orders/" + id, "PUT", body);
}

export function getSummary() {
  return request("/api/summary");
}

export function getProducts(filters) {
  const input = filters || {};
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("category", input.category);
  if (input.stock) params.set("stock", input.stock);
  if (input.sort && input.sort !== "name-asc") params.set("sort", input.sort);
  const query = params.toString();
  return request("/api/products" + (query ? "?" + query : ""));
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

export function getCustomers(filters) {
  const input = filters || {};
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.city) params.set("city", input.city);
  if (input.sort && input.sort !== "name-asc") params.set("sort", input.sort);
  const query = params.toString();
  return request("/api/customers" + (query ? "?" + query : ""));
}

export function getCustomer(id) {
  return request("/api/customers/" + id);
}

export function createCustomer(body) {
  return send("/api/customers", "POST", body);
}

export function getMe() {
  return request("/api/me");
}

export function login(body) {
  return send("/api/login", "POST", body);
}

export function logout() {
  return send("/api/logout", "POST", {});
}
