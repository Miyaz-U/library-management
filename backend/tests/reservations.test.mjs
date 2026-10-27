import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
import {
  newDb, addUser, addBook, copyStatus, reservationStatus, T0, daysAfter,
} from "./helpers.mjs";
const require = createRequire(import.meta.url);
const { issueCopy, returnLoan } = require("../src/services/loans");
const { reserveBook, cancelReservation, listReservations } = require("../src/services/reservations");

let db, librarian, a, b, c, book, code;

beforeEach(() => {
  db = newDb();
  librarian = addUser(db, "Asha", "librarian");
  a = addUser(db, "Ravi");
  b = addUser(db, "Meera");
  c = addUser(db, "Kiran");
  book = addBook(db, "9780000000001", 1); // only ONE copy
  code = book.codes[0];
});

const issue = (memberId, copyCode, now = T0) =>
  issueCopy(db, { memberId, copyCode, librarianId: librarian }, now);
const reserve = (userId, now) => reserveBook(db, { userId, bookId: book.id }, now);

describe("reserving", () => {
  it("is refused while a copy is available on the shelf", () => {
    expect(() => reserve(b, T0)).toThrow(/available right now/);
  });

  it("is refused if the member already has a reservation or a copy", () => {
    issue(a, code);
    reserve(b, daysAfter(T0, 1));
    expect(() => reserve(b, daysAfter(T0, 2))).toThrow(/already have a reservation/);
    expect(() => reserve(a, daysAfter(T0, 2))).toThrow(/already have a copy/);
  });

  it("gives queue positions in the order people reserved", () => {
    issue(a, code);
    const r1 = reserve(b, daysAfter(T0, 1));
    const r2 = reserve(c, daysAfter(T0, 2));

    const positions = Object.fromEntries(
      listReservations(db).map((r) => [r.id, r.queue_position])
    );
    expect(positions[r1]).toBe(1);
    expect(positions[r2]).toBe(2);
  });
});

describe("first come, first served", () => {
  it("holds a returned copy for the first person, and only for them", () => {
    const loanA = issue(a, code);
    const r1 = reserve(b, daysAfter(T0, 1));
    const r2 = reserve(c, daysAfter(T0, 2));

    const { heldFor } = returnLoan(db, loanA, daysAfter(T0, 3));
    expect(heldFor.user_id).toBe(b);
    expect(copyStatus(db, code)).toBe("on_hold");
    expect(reservationStatus(db, r1)).toBe("offered");
    expect(reservationStatus(db, r2)).toBe("waiting");

    // Nobody else can take the held copy
    expect(() => issue(c, code, daysAfter(T0, 4))).toThrow(/held for another member/);
    expect(() => issue(a, code, daysAfter(T0, 4))).toThrow(/held for another member/);

    // The right member can
    expect(() => issue(b, code, daysAfter(T0, 4))).not.toThrow();
    expect(reservationStatus(db, r1)).toBe("fulfilled");
    expect(copyStatus(db, code)).toBe("on_loan");
  });

  it("uses the lower id when two reservations have the exact same time", () => {
    const loanA = issue(a, code);
    reserve(b, daysAfter(T0, 1));
    reserve(c, daysAfter(T0, 1)); // same timestamp

    const { heldFor } = returnLoan(db, loanA, daysAfter(T0, 2));
    expect(heldFor.user_id).toBe(b);
  });

  it("puts the copy back on the shelf when nobody is waiting", () => {
    const loanA = issue(a, code);
    const { heldFor } = returnLoan(db, loanA, daysAfter(T0, 1));
    expect(heldFor).toBeNull();
    expect(copyStatus(db, code)).toBe("available");
  });
});

describe("cancelling", () => {
  it("passes an offered copy to the next person, then back to the shelf", () => {
    const loanA = issue(a, code);
    const r1 = reserve(b, daysAfter(T0, 1));
    const r2 = reserve(c, daysAfter(T0, 2));
    returnLoan(db, loanA, daysAfter(T0, 3));

    cancelReservation(db, r1, { id: b, role: "member" }, daysAfter(T0, 4));
    expect(reservationStatus(db, r2)).toBe("offered");
    expect(copyStatus(db, code)).toBe("on_hold");

    cancelReservation(db, r2, { id: c, role: "member" }, daysAfter(T0, 5));
    expect(copyStatus(db, code)).toBe("available");
  });

  it("does not let a member cancel someone else's reservation", () => {
    issue(a, code);
    const r1 = reserve(b, daysAfter(T0, 1));
    expect(() => cancelReservation(db, r1, { id: c, role: "member" })).toThrow(
      /only cancel your own/
    );
  });
});

describe("borrowing limit and the queue", () => {
  it("skips a member who holds 3 books, and keeps their place", () => {
    // Meera (b) already holds 3 other books
    const others = [2, 3, 4].map((n) => addBook(db, `978000000000${n}`));
    others.forEach((o) => issue(b, o.codes[0]));

    const loanA = issue(a, code);
    const r1 = reserve(b, daysAfter(T0, 1)); // first in line, but at the limit
    const r2 = reserve(c, daysAfter(T0, 2));

    const { heldFor } = returnLoan(db, loanA, daysAfter(T0, 3));
    expect(heldFor.user_id).toBe(c); // Kiran gets it
    expect(reservationStatus(db, r1)).toBe("waiting"); // Meera keeps her place
    expect(reservationStatus(db, r2)).toBe("offered");
  });
});