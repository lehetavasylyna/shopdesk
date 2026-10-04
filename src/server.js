const path = require("path");
const express = require("express");
const { openDb, prepare } = require("./db");
const { routes } = require("./routes");

function createApp(dbPath, options) {
  const seed = !options || options.seed !== false;
  const database = openDb(dbPath);
  prepare(database, seed);

  const app = express();
  app.locals.db = database;
  app.use(express.json());
  app.use("/api", routes(database));

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp(path.join(__dirname, "..", "shop.db"));
  app.listen(5000, () => {
    console.log("API http://127.0.0.1:5000");
  });
}

module.exports = { createApp };
