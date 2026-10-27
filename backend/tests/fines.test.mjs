import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { addDays, overdueDays, calculateFine } = require("../src/utils/fines");

const due = new Date("2026-10-10T09:00:00.000Z");

describe("fine calculation (Rs 5 per overdue day)", () => {
  it("is 0 when returned before the due date", () => {
    expect(calculateFine(due, new Date("2026-10-05T09:00:00.000Z"))).toBe(0);
  });

  it("is 0 when returned late in the evening of the due date", () => {
    expect(calculateFine(due, new Date("2026-10-10T23:59:00.000Z"))).toBe(0);
  });

  it("is Rs 5 when returned just after midnight the next day", () => {
    expect(calculateFine(due, new Date("2026-10-11T00:01:00.000Z"))).toBe(5);
  });

  it("is Rs 25 for 5 days late", () => {
    const returned = new Date("2026-10-15T09:00:00.000Z");
    expect(overdueDays(due, returned)).toBe(5);
    expect(calculateFine(due, returned)).toBe(25);
  });
});

describe("due date", () => {
  it("is 14 days after the issue date", () => {
    const issued = new Date("2026-10-27T10:00:00.000Z");
    expect(addDays(issued, 14).toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });
});