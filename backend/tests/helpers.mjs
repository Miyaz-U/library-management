import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createDatabase } = require("../src/db/database");

// A fixed "today" so results never depend on the real clock
export const T0 = new Date("2026-10-01T10:00:00.000Z");

export function daysAfter(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// A brand-new empty database for each test
export function newDb() {
  return createDatabase(":memory:");
}

export function addUser(db, name, role = "member") {
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, 'x', ?)")
    .run(name, `${name.toLowerCase()}@test.com`, role);
  return Number(result.lastInsertRowid);
}

// Creates a book with `copies` copies. Returns { id, codes }.
export function addBook(db, isbn, copies = 1) {
  const book = db
    .prepare("INSERT INTO books (title, author, isbn, category) VALUES (?, 'Author', ?, 'Test')")
    .run(`Book ${isbn}`, isbn);
  const id = Number(book.lastInsertRowid);
  const codes = [];
  for (let i = 1; i <= copies; i++) {
    const code = `${isbn}-${String(i).padStart(2, "0")}`;
    db.prepare("INSERT INTO copies (book_id, copy_code) VALUES (?, ?)").run(id, code);
    codes.push(code);
  }
  return { id, codes };
}

export function copyStatus(db, copyCode) {
  return db.prepare("SELECT status FROM copies WHERE copy_code = ?").get(copyCode).status;
}

export function reservationStatus(db, id) {
  return db.prepare("SELECT status FROM reservations WHERE id = ?").get(id).status;
}