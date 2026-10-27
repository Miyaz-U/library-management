const express = require("express");
const { z } = require("zod");
const { getDb } = require("../db/database");
const { HttpError } = require("../utils/httpError");
const { parseId } = require("../utils/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { offerAvailableCopies } = require("../services/reservations");

const router = express.Router();

// ---------- Validation ----------

const isbnSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[-\s]/g, "").toUpperCase())
  .pipe(z.string().regex(/^(\d{13}|\d{9}[\dX])$/, "ISBN must be 10 or 13 digits"));

const copyCountSchema = z
  .number()
  .int("Copies must be a whole number")
  .min(1, "Add at least 1 copy")
  .max(50, "You can add at most 50 copies at a time");

const createBookSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  author: z.string().trim().min(1, "Author is required").max(120),
  isbn: isbnSchema,
  category: z.string().trim().min(1, "Category is required").max(60),
  copies: copyCountSchema.default(1),
});

const addCopiesSchema = z.object({
  count: copyCountSchema.default(1),
});

// ---------- Helpers ----------

// One query used for both the list and the single-book view.
// available_copies counts ONLY copies with status 'available'.
const BOOK_SELECT = `
  SELECT b.id, b.title, b.author, b.isbn, b.category,
         COUNT(c.id) AS total_copies,
         COALESCE(SUM(c.status = 'available'), 0) AS available_copies
  FROM books b
  LEFT JOIN copies c ON c.book_id = b.id
`;

// Adds `count` new copies to a book. Copy codes look like 9780132350884-01
function addCopies(db, book, count) {
  const existing = db
    .prepare("SELECT COUNT(*) AS n FROM copies WHERE book_id = ?")
    .get(book.id).n;
  const insert = db.prepare("INSERT INTO copies (book_id, copy_code) VALUES (?, ?)");
  for (let i = 1; i <= count; i++) {
    const number = String(existing + i).padStart(2, "0");
    insert.run(book.id, `${book.isbn}-${number}`);
  }
}

// Makes user text safe for a LIKE search (so a typed % or _ is treated as plain text)
function likePattern(text) {
  return `%${text.replace(/[\\%_]/g, (ch) => "\\" + ch)}%`;
}

// ---------- Routes ----------

// GET /api/books?q=clean
router.get("/", requireAuth, (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const db = getDb();

    let books;
    if (q) {
      const text = likePattern(q);
      const isbnText = likePattern(q.replace(/[-\s]/g, ""));
      books = db
        .prepare(
          `${BOOK_SELECT}
           WHERE b.title  LIKE @text ESCAPE '\\'
              OR b.author LIKE @text ESCAPE '\\'
              OR b.isbn   LIKE @isbnText ESCAPE '\\'
           GROUP BY b.id
           ORDER BY b.title`
        )
        .all({ text, isbnText });
    } else {
      books = db.prepare(`${BOOK_SELECT} GROUP BY b.id ORDER BY b.title`).all();
    }

    res.json({ books });
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id
router.get("/:id", requireAuth, (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const db = getDb();

    const book = db.prepare(`${BOOK_SELECT} WHERE b.id = ? GROUP BY b.id`).get(id);
    if (!book) throw new HttpError(404, "Book not found");

    const copies = db
      .prepare("SELECT id, copy_code, status FROM copies WHERE book_id = ? ORDER BY id")
      .all(id);

    res.json({ book, copies });
  } catch (err) {
    next(err);
  }
});

// POST /api/books  (librarian only)
router.post("/", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    const { title, author, isbn, category, copies } = createBookSchema.parse(req.body);
    const db = getDb();

    if (db.prepare("SELECT id FROM books WHERE isbn = ?").get(isbn)) {
      throw new HttpError(409, "A book with this ISBN already exists");
    }

    // Transaction: the book and ALL its copies are saved together, or nothing is
    const create = db.transaction(() => {
      const result = db
        .prepare("INSERT INTO books (title, author, isbn, category) VALUES (?, ?, ?, ?)")
        .run(title, author, isbn, category);
      const book = { id: Number(result.lastInsertRowid), isbn };
      addCopies(db, book, copies);
      return book.id;
    });
    const bookId = create();

    const book = db.prepare(`${BOOK_SELECT} WHERE b.id = ? GROUP BY b.id`).get(bookId);
    res.status(201).json({ book });
  } catch (err) {
    next(err);
  }
});

// POST /api/books/:id/copies  (librarian only)
router.post("/:id/copies", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const { count } = addCopiesSchema.parse(req.body);
    const db = getDb();

    const bookRow = db.prepare("SELECT id, isbn FROM books WHERE id = ?").get(id);
    if (!bookRow) throw new HttpError(404, "Book not found");

    db.transaction(() => {
      addCopies(db, bookRow, count);
      offerAvailableCopies(db, id); // hand new copies to anyone already waiting
    })();

    const book = db.prepare(`${BOOK_SELECT} WHERE b.id = ? GROUP BY b.id`).get(id);
    res.status(201).json({ book });
  } catch (err) {
    next(err);
  }
});

module.exports = router;