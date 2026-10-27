require("dotenv").config();
const bcrypt = require("bcryptjs");
const { getDb } = require("./database");
const { issueCopy, returnLoan } = require("../services/loans");
const { reserveBook } = require("../services/reservations");

const DAY = 24 * 60 * 60 * 1000;

const LIBRARIAN_PASSWORD = "Library@123";
const MEMBER_PASSWORD = "Member@123";

const ISBN = {
  cleanCode: "9780132350884",
  pragmatic: "9780135957059",
  refactoring: "9780134757599",
  patterns: "9780201633610",
  algorithms: "9780262046305",
  sapiens: "9780062316097",
  alchemist: "9780062315007",
  wingsOfFire: "9788173711466",
  malgudi: "9780143039655",
  atomicHabits: "9780735211292",
};

const BOOKS = [
  { title: "Clean Code", author: "Robert C. Martin", isbn: ISBN.cleanCode, category: "Programming", copies: 3 },
  { title: "The Pragmatic Programmer", author: "Andrew Hunt and David Thomas", isbn: ISBN.pragmatic, category: "Programming", copies: 1 },
  { title: "Refactoring", author: "Martin Fowler", isbn: ISBN.refactoring, category: "Programming", copies: 2 },
  { title: "Design Patterns", author: "Erich Gamma", isbn: ISBN.patterns, category: "Programming", copies: 2 },
  { title: "Introduction to Algorithms", author: "Thomas H. Cormen", isbn: ISBN.algorithms, category: "Computer Science", copies: 2 },
  { title: "Sapiens", author: "Yuval Noah Harari", isbn: ISBN.sapiens, category: "History", copies: 3 },
  { title: "The Alchemist", author: "Paulo Coelho", isbn: ISBN.alchemist, category: "Fiction", copies: 2 },
  { title: "Wings of Fire", author: "A. P. J. Abdul Kalam", isbn: ISBN.wingsOfFire, category: "Biography", copies: 2 },
  { title: "Malgudi Days", author: "R. K. Narayan", isbn: ISBN.malgudi, category: "Fiction", copies: 2 },
  { title: "Atomic Habits", author: "James Clear", isbn: ISBN.atomicHabits, category: "Self-help", copies: 1 },
];

const MEMBERS = [
  { key: "ravi", name: "Ravi Menon", email: "ravi@example.com" },
  { key: "meera", name: "Meera Nair", email: "meera@example.com" },
  { key: "kiran", name: "Kiran Das", email: "kiran@example.com" },
  { key: "divya", name: "Divya Iyer", email: "divya@example.com" },
];

const copyCode = (isbn, n = 1) => `${isbn}-${String(n).padStart(2, "0")}`;

function seedDatabase(db, today = new Date()) {
  const daysAgo = (n) => new Date(today.getTime() - n * DAY);

  const run = db.transaction(() => {
    // 1. Clear everything (children first, because of foreign keys)
    for (const table of ["reservations", "loans", "copies", "books", "users"]) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare("DELETE FROM sqlite_sequence").run(); // ids start from 1 again

    // 2. Users
    const insertUser = db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    );
    const libResult = insertUser.run(
      "Lata Librarian",
      "librarian@library.com",
      bcrypt.hashSync(LIBRARIAN_PASSWORD, 10),
      "librarian"
    );
    const librarianId = Number(libResult.lastInsertRowid);

    const memberHash = bcrypt.hashSync(MEMBER_PASSWORD, 10);
    const id = {};
    for (const m of MEMBERS) {
      id[m.key] = Number(insertUser.run(m.name, m.email, memberHash, "member").lastInsertRowid);
    }

    // 3. Books and copies
    const insertBook = db.prepare(
      "INSERT INTO books (title, author, isbn, category) VALUES (?, ?, ?, ?)"
    );
    const insertCopy = db.prepare("INSERT INTO copies (book_id, copy_code) VALUES (?, ?)");
    const bookId = {};
    for (const b of BOOKS) {
      const bid = Number(insertBook.run(b.title, b.author, b.isbn, b.category).lastInsertRowid);
      bookId[b.isbn] = bid;
      for (let n = 1; n <= b.copies; n++) insertCopy.run(bid, copyCode(b.isbn, n));
    }

    // 4. Scenarios, built with the real services
    const issue = (member, isbn, n, when) =>
      issueCopy(db, { memberId: id[member], copyCode: copyCode(isbn, n), librarianId }, when);

    // Past loan, returned 6 days late (Rs 30 fine saved)
    const history = issue("meera", ISBN.sapiens, 2, daysAgo(30));
    returnLoan(db, history, daysAgo(10));

    // Overdue loan: issued 20 days ago, due 6 days ago (Rs 30 so far)
    issue("divya", ISBN.refactoring, 1, daysAgo(20));

    // Kiran holds 3 books (at the borrowing limit)
    issue("kiran", ISBN.patterns, 1, daysAgo(5));
    issue("kiran", ISBN.algorithms, 1, daysAgo(4));
    issue("kiran", ISBN.sapiens, 1, daysAgo(3));

    // Ravi holds the only copy of The Pragmatic Programmer; two members queue for it.
    // Kiran is first in line but at the limit, so Meera will get the copy on return.
    issue("ravi", ISBN.pragmatic, 1, daysAgo(2));
    reserveBook(db, { userId: id.kiran, bookId: bookId[ISBN.pragmatic] }, daysAgo(1));
    reserveBook(db, { userId: id.meera, bookId: bookId[ISBN.pragmatic] }, daysAgo(0.5));
  });

  run();
}

module.exports = { seedDatabase, LIBRARIAN_PASSWORD, MEMBER_PASSWORD };

// Runs only when you type: npm run seed
if (require.main === module) {
  const db = getDb();
  seedDatabase(db);

  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  console.log("Demo data loaded (all previous data was replaced).");
  console.log(`  users: ${count("users")}, books: ${count("books")}, copies: ${count("copies")}`);
  console.log(`  loans: ${count("loans")}, reservations: ${count("reservations")}`);
  console.log("");
  console.log("Demo logins:");
  console.log(`  Librarian: librarian@library.com / ${LIBRARIAN_PASSWORD}`);
  console.log(`  Members:   ravi@example.com, meera@example.com, kiran@example.com,`);
  console.log(`             divya@example.com / ${MEMBER_PASSWORD}`);
}