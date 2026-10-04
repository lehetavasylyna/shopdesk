# The Shelf

A small order system for a household shop. The screens are a React app. The server is Node.js and Express, and it only talks JSON. The database is local: one file, `shop.db` (SQLite). No separate database server is needed.

What it does:

- products with stock and price
- customers
- a new order with several lines
- statuses: new → confirmed → shipped → completed, or cancel before shipping
- stock goes down when an order is saved, and comes back if the order is cancelled
- the price on a receipt stays as it was at the time of the order
- an open order (new or confirmed) can still be changed; a shipped one cannot
- a customer page with that person’s orders
- a short summary: orders by status, and products with three pieces or fewer

## Run

```bash
npm install
npm start
```

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Then open http://127.0.0.1:5173

The API stays on http://127.0.0.1:5000. The React dev server forwards `/api` there.

A short sample is filled in the first time `shop.db` is created. For a fuller shop, run:

```bash
npm run mock
```

That script replaces the rows in `shop.db` with customers, products, and orders. Refresh the page afterwards. To go back to an empty file, stop the program and delete `shop.db`.

## Tests

```bash
npm test
```

Tests use a temporary database. They do not touch the working `shop.db`.
