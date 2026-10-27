const LOAN_DAYS = 14;     // how long a member may keep a book
const FINE_PER_DAY = 5;   // rupees per overdue day
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Returns a new Date that is `days` after `date`
function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Midnight (UTC) of the given date, as a number. Lets us compare calendar days.
function startOfUtcDay(date) {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// How many calendar days late was the return? Never negative.
function overdueDays(dueDate, returnedAt) {
  const diff = startOfUtcDay(returnedAt) - startOfUtcDay(dueDate);
  return diff > 0 ? Math.round(diff / MS_PER_DAY) : 0;
}

// Fine in whole rupees
function calculateFine(dueDate, returnedAt) {
  return overdueDays(dueDate, returnedAt) * FINE_PER_DAY;
}

module.exports = { LOAN_DAYS, FINE_PER_DAY, addDays, overdueDays, calculateFine };