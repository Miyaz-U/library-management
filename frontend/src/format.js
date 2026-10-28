// Dates are shown in UTC so they match the server's fine rule (calendar days in UTC)
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const rupees = (amount) => `₹${amount}`;

// Whole calendar days from today until the given date (negative = in the past)
export function daysUntil(iso) {
  const d = new Date(iso);
  const n = new Date();
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.round((a - b) / 86400000);
}