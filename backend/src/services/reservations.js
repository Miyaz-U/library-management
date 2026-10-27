const { HttpError } = require("../utils/httpError");
const { MAX_ACTIVE_LOANS } = require("../utils/fines");

// How many books a member currently has out (open loans)
function countActiveLoans(db, userId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM loans WHERE user_id = ? AND returned_at IS NULL")
    .get(userId).n;
}

// The first ELIGIBLE person waiting for a book: oldest created_at, then lowest id.
// Members who already hold the maximum number of books are skipped (they keep their place).
function nextInQueue(db, bookId) {
  return db
    .prepare(
      `SELECT r.id, r.user_id, u.name AS member_name
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       WHERE r.book_id = ? AND r.status = 'waiting'
         AND (SELECT COUNT(*) FROM loans l
              WHERE l.user_id = r.user_id AND l.returned_at IS NULL) < ?
       ORDER BY r.created_at ASC, r.id ASC
       LIMIT 1`
    )
    .get(bookId, MAX_ACTIVE_LOANS);
}

// Holds this copy for the next waiting member. Returns who it is held for, or null.
function offerToNext(db, copyId, bookId, now) {
  const next = nextInQueue(db, bookId);
  if (!next) return null;

  db.prepare(
    "UPDATE reservations SET status = 'offered', copy_id = ?, offered_at = ? WHERE id = ?"
  ).run(copyId, now.toISOString(), next.id);
  db.prepare("UPDATE copies SET status = 'on_hold' WHERE id = ?").run(copyId);

  return { reservation_id: next.id, user_id: next.user_id, member_name: next.member_name };
}

// A copy has just become free: hold it for the queue, or put it back on the shelf.
function releaseCopy(db, copyId, bookId, now = new Date()) {
  const heldFor = offerToNext(db, copyId, bookId, now);
  if (!heldFor) {
    db.prepare("UPDATE copies SET status = 'available' WHERE id = ?").run(copyId);
  }
  return heldFor;
}

// New copies were added: hand any available ones to people already waiting.
function offerAvailableCopies(db, bookId, now = new Date()) {
  const copies = db
    .prepare("SELECT id FROM copies WHERE book_id = ? AND status = 'available' ORDER BY id")
    .all(bookId);
  for (const copy of copies) {
    if (!offerToNext(db, copy.id, bookId, now)) break;
  }
}

// A member joins the queue for a book.
function reserveBook(db, { userId, bookId }, now = new Date()) {
  const run = db.transaction(() => {
    const book = db.prepare("SELECT id FROM books WHERE id = ?").get(bookId);
    if (!book) throw new HttpError(404, "Book not found");

    const available = db
      .prepare("SELECT COUNT(*) AS n FROM copies WHERE book_id = ? AND status = 'available'")
      .get(bookId).n;
    if (available > 0) {
      throw new HttpError(409, "Copies are available right now. Ask a librarian to issue one");
    }

    const hasCopy = db
      .prepare(
        `SELECT 1 FROM loans l JOIN copies c ON c.id = l.copy_id
         WHERE c.book_id = ? AND l.user_id = ? AND l.returned_at IS NULL`
      )
      .get(bookId, userId);
    if (hasCopy) throw new HttpError(409, "You already have a copy of this book");

    const existing = db
      .prepare(
        `SELECT 1 FROM reservations
         WHERE book_id = ? AND user_id = ? AND status IN ('waiting', 'offered')`
      )
      .get(bookId, userId);
    if (existing) throw new HttpError(409, "You already have a reservation for this book");

    const result = db
      .prepare("INSERT INTO reservations (book_id, user_id, created_at) VALUES (?, ?, ?)")
      .run(bookId, userId, now.toISOString());
    return Number(result.lastInsertRowid);
  });
  return run();
}

// Leave the queue. If a copy was being held for this person, pass it on.
function cancelReservation(db, reservationId, user, now = new Date()) {
  const run = db.transaction(() => {
    const r = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservationId);
    if (!r) throw new HttpError(404, "Reservation not found");
    if (r.user_id !== user.id && user.role !== "librarian") {
      throw new HttpError(403, "You can only cancel your own reservations");
    }
    if (r.status !== "waiting" && r.status !== "offered") {
      throw new HttpError(409, `This reservation is already ${r.status}`);
    }

    db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(r.id);

    if (r.status === "offered") {
      releaseCopy(db, r.copy_id, r.book_id, now);
    }
    return r.id;
  });
  return run();
}

// Lists reservations. queue_position is filled in only for "waiting" ones.
function listReservations(db, { id, userId, status } = {}) {
  const where = [];
  const params = [];
  if (id) { where.push("r.id = ?"); params.push(id); }
  if (userId) { where.push("r.user_id = ?"); params.push(userId); }
  if (status) { where.push("r.status = ?"); params.push(status); }

  return db
    .prepare(
      `SELECT r.id, r.book_id, b.title, b.author,
              r.user_id AS member_id, u.name AS member_name,
              r.status, c.copy_code, r.created_at, r.offered_at,
              CASE WHEN r.status = 'waiting' THEN
                (SELECT COUNT(*) FROM reservations q
                 WHERE q.book_id = r.book_id AND q.status = 'waiting'
                   AND (q.created_at < r.created_at
                        OR (q.created_at = r.created_at AND q.id <= r.id)))
              END AS queue_position
       FROM reservations r
       JOIN books b ON b.id = r.book_id
       JOIN users u ON u.id = r.user_id
       LEFT JOIN copies c ON c.id = r.copy_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY r.created_at DESC, r.id DESC`
    )
    .all(...params);
}

module.exports = {
  countActiveLoans,
  releaseCopy,
  offerAvailableCopies,
  reserveBook,
  cancelReservation,
  listReservations,
};