const crypto = require("crypto");
const { ShopError } = require("./errors");
const { clean } = require("./db");
const { nowText } = require("./time");

const COOKIE = "shelf";
const DESK_LOGIN = "desk";
const DESK_PASSWORD = "shelf2026";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return salt + ":" + hash;
}

function checkPassword(password, stored) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 2) return false;
  const got = crypto.scryptSync(String(password || ""), parts[0], 32);
  const want = Buffer.from(parts[1], "hex");
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(got, want);
}

function ensureStaff(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM staff").get().n;
  if (count) return;
  db.prepare("INSERT INTO staff (name, login, password_hash) VALUES (?, ?, ?)").run(
    "Shop desk",
    DESK_LOGIN,
    hashPassword(DESK_PASSWORD)
  );
}

function readCookie(req) {
  const header = String(req.headers.cookie || "");
  for (const part of header.split(";")) {
    const piece = part.trim();
    const eq = piece.indexOf("=");
    if (eq === -1) continue;
    if (piece.slice(0, eq) === COOKIE) return decodeURIComponent(piece.slice(eq + 1));
  }
  return "";
}

function staffFromRequest(db, req) {
  const token = readCookie(req);
  if (!token) return null;
  return (
    db
      .prepare(
        `SELECT s.id, s.name, s.login
         FROM sessions ses
         JOIN staff s ON s.id = ses.staff_id
         WHERE ses.token = ?`
      )
      .get(token) || null
  );
}

function signIn(db, loginName, password) {
  const person = db.prepare("SELECT * FROM staff WHERE login = ?").get(clean(loginName));
  if (!person || !checkPassword(password, person.password_hash)) {
    throw new ShopError("Wrong login or password");
  }
  const token = crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (token, staff_id, created_at) VALUES (?, ?, ?)").run(
    token,
    person.id,
    nowText()
  );
  return { token, staff: { id: person.id, name: person.name, login: person.login } };
}

function signOut(db, req) {
  const token = readCookie(req);
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function writeSessionCookie(res, token) {
  if (!token) {
    res.setHeader("Set-Cookie", COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return;
  }
  res.setHeader("Set-Cookie", COOKIE + "=" + token + "; HttpOnly; SameSite=Lax; Path=/");
}

module.exports = {
  DESK_LOGIN,
  DESK_PASSWORD,
  ensureStaff,
  staffFromRequest,
  signIn,
  signOut,
  writeSessionCookie,
};
