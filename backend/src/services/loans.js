const { HttpError } = require("../utils/httpError");
const { LOAN_DAYS, MAX_ACTIVE_LOANS, addDays, overdueDays, calculateFine } = require("../utils/fines");
const { releaseCopy, countActiveLoans } = require("./reservations");

// One query that joins everything the UI needs to show a loan
const LOAN_SELECT = `
  SELECT l.id, l.copy_id, c.copy_code,
         b.id AS book_id, b.title, b.author,
         u.id AS member_id, u.name AS member_name,
         l.issued_at, l.due_date, l.returned_at, l.fine_amount
  FROM loans l
  JOIN copies c ON c.id = l.copy_id
  JOIN books  b ON b.id = c.book_id
  JOIN users  u ON u.id = l.user_id
`;

// Adds overdue information. For an open loan the fine is "so far";
// for a returned loan it is the final fine saved at return time.
function describeLoan(row, now) {
  const open = row.returned_at === null;
  const end = open ? now : row.returned_at;
  return {
    ...row,
    overdue_days: overdueDays(row.due_date, end),
    fine: open ? calculateFine(row.due_date, now) : row.fine_amount,
    is_overdue: open && overdueDays(row.due_date, now) > 0,
  };
}

function getLoan(db, id, now = new Date()) {
  const row = db.prepare(`${LOAN_SELECT} WHERE l.id = ?`).get(id);
  return row ? describeLoan(row, now) : null;
}

function listLoans(db, { userId, status } = {}, now = new Date()) {
  const where = [];
  const params = [];
  if (userId) {
    where.push("l.user_id = ?");
    params.push(userId);
  }
  if (status === "open") where.push("l.returned_at IS NULL");
  if (status === "returned") where.push("l.returned_at IS NOT NULL");

  const sql = `${LOAN_SELECT}
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY l.issued_at DESC, l.id DESC`;

  return db.prepare(sql).all(...params).map((row) => describeLoan(row, now));
}

// Issues one copy to one member. Returns the new loan id.
function issueCopy(db, { memberId, copyCode, librarianId }, now = new Date()) {
  const run = db.transaction(() => {
    const member = db.prepare("SELECT id, role FROM users WHERE id = ?").get(memberId);
    if (!member) throw new HttpError(404, "Member not found");
    if (member.role !== "member") {
      throw new HttpError(400, "Books can only be issued to member accounts");
    }

    if (countActiveLoans(db, memberId) >= MAX_ACTIVE_LOANS) {
      throw new HttpError(
        409,
        `This member already has ${MAX_ACTIVE_LOANS} books. A book must be returned first`
      );
    }

    const copy = db.prepare("SELECT id, status FROM copies WHERE copy_code = ?").get(copyCode);
    if (!copy) throw new HttpError(404, "Copy not found");

    if (copy.status === "on_loan") {
      throw new HttpError(409, "This copy is already issued to someone");
    }

    // A held copy may only go to the member it is being held for
    let reservation = null;
    if (copy.status === "on_hold") {
      reservation = db
        .prepare("SELECT id, user_id FROM reservations WHERE copy_id = ? AND status = 'offered'")
        .get(copy.id);
      if (!reservation || reservation.user_id !== memberId) {
        throw new HttpError(409, "This copy is being held for another member's reservation");
      }
    }

    const result = db
      .prepare(
        `INSERT INTO loans (copy_id, user_id, issued_by, issued_at, due_date)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(copy.id, memberId, librarianId, now.toISOString(), addDays(now, LOAN_DAYS).toISOString());

    db.prepare("UPDATE copies SET status = 'on_loan' WHERE id = ?").run(copy.id);

    if (reservation) {
      db.prepare("UPDATE reservations SET status = 'fulfilled' WHERE id = ?").run(reservation.id);
    }

    return Number(result.lastInsertRowid);
  });
  return run();
}

// Returns a loan: saves the fine, then holds the copy for the queue or frees it.
// Result: { heldFor } is the member the copy is now held for, or null.
function returnLoan(db, loanId, now = new Date()) {
  const run = db.transaction(() => {
    const loan = db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId);
    if (!loan) throw new HttpError(404, "Loan not found");
    if (loan.returned_at) throw new HttpError(409, "This copy has already been returned");

    const fine = calculateFine(loan.due_date, now);

    db.prepare("UPDATE loans SET returned_at = ?, fine_amount = ? WHERE id = ?").run(
      now.toISOString(),
      fine,
      loanId
    );

    const copy = db.prepare("SELECT id, book_id FROM copies WHERE id = ?").get(loan.copy_id);
    const heldFor = releaseCopy(db, copy.id, copy.book_id, now);

    return { heldFor };
  });
  return run();
}

// Overdue report: open loans past their due date, most overdue first
function overdueReport(db, now = new Date()) {
  const loans = listLoans(db, { status: "open" }, now)
    .filter((loan) => loan.is_overdue)
    .sort((a, b) => b.overdue_days - a.overdue_days);
  const totalFines = loans.reduce((sum, loan) => sum + loan.fine, 0);
  return { count: loans.length, total_fines: totalFines, loans };
}

module.exports = { issueCopy, returnLoan, getLoan, listLoans, overdueReport };