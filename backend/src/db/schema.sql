-- Users: members and librarians
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'librarian')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Books: one row per title
CREATE TABLE IF NOT EXISTS books (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  author     TEXT NOT NULL,
  isbn       TEXT NOT NULL UNIQUE,
  category   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copies: one row per physical copy of a book
CREATE TABLE IF NOT EXISTS copies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  copy_code  TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'available'
             CHECK (status IN ('available', 'on_loan', 'on_hold')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Loans: one row each time a copy is borrowed
CREATE TABLE IF NOT EXISTS loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id     INTEGER NOT NULL REFERENCES copies(id),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  issued_by   INTEGER NOT NULL REFERENCES users(id),
  issued_at   TEXT NOT NULL,
  due_date    TEXT NOT NULL,
  returned_at TEXT,
  fine_amount INTEGER NOT NULL DEFAULT 0 CHECK (fine_amount >= 0)
);

-- Reservations: the waiting queue for a book
CREATE TABLE IF NOT EXISTS reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL DEFAULT 'waiting'
             CHECK (status IN ('waiting', 'offered', 'fulfilled', 'cancelled')),
  copy_id    INTEGER REFERENCES copies(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  offered_at TEXT
);

-- Rule: a copy can have only ONE open (not yet returned) loan
CREATE UNIQUE INDEX IF NOT EXISTS ux_loans_one_open_per_copy
  ON loans(copy_id) WHERE returned_at IS NULL;

-- Rule: a user can have only ONE active reservation per book
CREATE UNIQUE INDEX IF NOT EXISTS ux_reservations_one_active_per_user_book
  ON reservations(book_id, user_id) WHERE status IN ('waiting', 'offered');

-- Speed-ups for common lookups
CREATE INDEX IF NOT EXISTS idx_books_title  ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_copies_book  ON copies(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_user   ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_res_queue    ON reservations(book_id, status, created_at, id);