import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
import { newDb, addUser, addBook, copyStatus, T0, daysAfter } from "./helpers.mjs";
const require = createRequire(import.meta.url);
const { issueCopy, returnLoan, getLoan } = require("../src/services/loans");

let db, librarian, ravi, meera;

beforeEach(() => {
  db = newDb();
  librarian = addUser(db, "Asha", "librarian");
  ravi = addUser(db, "Ravi");
  meera = addUser(db, "Meera");
});

const issue = (memberId, copyCode, now = T0) =>
  issueCopy(db, { memberId, copyCode, librarianId: librarian }, now);

describe("issuing", () => {
  it("sets a due date 14 days away and marks the copy on_loan", () => {
    const book = addBook(db, "9780000000001");
    const loanId = issue(ravi, book.codes[0]);

    expect(getLoan(db, loanId, T0).due_date).toBe("2026-10-15T10:00:00.000Z");
    expect(copyStatus(db, book.codes[0])).toBe("on_loan");
  });

  it("refuses a copy that is already issued", () => {
    const book = addBook(db, "9780000000001");
    issue(ravi, book.codes[0]);
    expect(() => issue(meera, book.codes[0])).toThrow(/already issued/);
  });

  it("refuses to issue to a librarian account", () => {
    const book = addBook(db, "9780000000001");
    expect(() => issue(librarian, book.codes[0])).toThrow(/member accounts/);
  });

  it("lets a member hold at most 3 books, but not blocking other members", () => {
    const books = [1, 2, 3, 4].map((n) => addBook(db, `978000000000${n}`));
    issue(ravi, books[0].codes[0]);
    issue(ravi, books[1].codes[0]);
    issue(ravi, books[2].codes[0]);

    expect(() => issue(ravi, books[3].codes[0])).toThrow(/already has 3 books/);
    expect(() => issue(meera, books[3].codes[0])).not.toThrow();
  });
});

describe("returning", () => {
  it("charges no fine when returned on time and frees the copy", () => {
    const book = addBook(db, "9780000000001");
    const loanId = issue(ravi, book.codes[0]);
    returnLoan(db, loanId, daysAfter(T0, 14));

    expect(getLoan(db, loanId).fine).toBe(0);
    expect(copyStatus(db, book.codes[0])).toBe("available");
  });

  it("charges Rs 25 when returned 5 days late and saves it", () => {
    const book = addBook(db, "9780000000001");
    const loanId = issue(ravi, book.codes[0]);
    returnLoan(db, loanId, daysAfter(T0, 19));

    const loan = getLoan(db, loanId);
    expect(loan.overdue_days).toBe(5);
    expect(loan.fine).toBe(25);
  });

  it("refuses to return the same loan twice", () => {
    const book = addBook(db, "9780000000001");
    const loanId = issue(ravi, book.codes[0]);
    returnLoan(db, loanId, T0);
    expect(() => returnLoan(db, loanId, T0)).toThrow(/already been returned/);
  });
});