class ShopError extends Error {
  constructor(message) {
    super(message);
    this.name = "ShopError";
  }
}

module.exports = { ShopError };
