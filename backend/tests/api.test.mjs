import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Settings must exist BEFORE the app is loaded
process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";

const app = require("../src/app");
const { getDb } = require("../src/db/database");

let librarian, member, other; // each: { token, user }

async function register(name, email) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name, email, password: "secret123" });
  return res.body;
}

const auth = (who) => ({ Authorization: `Bearer ${who.token}` });

beforeAll(async () => {
  librarian = await register("Asha Kumar", "asha@test.com");
  member = await register("Ravi Menon", "ravi@test.com");
  other = await register("Meera Nair", "meera@test.com");
  // Public sign-up always makes members, so promote Asha directly in the test database
  getDb().prepare("UPDATE users SET role = 'librarian' WHERE id = ?").run(librarian.user.id);
});

describe("authentication", () => {
  it("rejects a duplicate email with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Again", email: "ASHA@test.com", password: "secret123" });
    expect(res.status).toBe(409);
  });

  it("rejects invalid input with 400 and a details list", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "bad", password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ravi@test.com", password: "wrongpass1" });
    expect(res.status).toBe(401);
  });

  it("requires a token for protected routes", async () => {
    const res = await request(app).get("/api/books");
    expect(res.status).toBe(401);
  });
});

describe("roles", () => {
  const book = {
    title: "Clean Code",
    author: "Robert C. Martin",
    isbn: "978-0-13-235088-4",
    category: "Programming",
    copies: 1,
  };

  it("blocks a member from creating a book (403)", async () => {
    const res = await request(app).post("/api/books").set(auth(member)).send(book);
    expect(res.status).toBe(403);
  });

  it("blocks a member from the overdue report (403)", async () => {
    const res = await request(app).get("/api/reports/overdue").set(auth(member));
    expect(res.status).toBe(403);
  });

  it("lets a librarian create a book, normalising the ISBN, and search finds it", async () => {
    const created = await request(app).post("/api/books").set(auth(librarian)).send(book);
    expect(created.status).toBe(201);
    expect(created.body.book.isbn).toBe("9780132350884");

    const search = await request(app).get("/api/books?q=978-0-13-235088-4").set(auth(member));
    expect(search.body.books).toHaveLength(1);
    expect(search.body.books[0].available_copies).toBe(1);
  });

  it("lists members for librarians only, never librarians", async () => {
    const denied = await request(app).get("/api/members").set(auth(member));
    expect(denied.status).toBe(403);

    const ok = await request(app).get("/api/members").set(auth(librarian));
    expect(ok.status).toBe(200);
    expect(ok.body.members.length).toBeGreaterThanOrEqual(2);
    expect(ok.body.members.some((m) => m.email === "asha@test.com")).toBe(false);
  });
});

describe("end to end: borrow, reserve, return, hold", () => {
  it("holds the returned copy for the member who reserved", async () => {
    const copyCode = "9780132350884-01";

    // Librarian issues the only copy to Ravi
    const issued = await request(app)
      .post("/api/loans")
      .set(auth(librarian))
      .send({ memberId: member.user.id, copyCode });
    expect(issued.status).toBe(201);

    // Meera reserves it
    const reserved = await request(app)
      .post("/api/reservations")
      .set(auth(other))
      .send({ bookId: 1 });
    expect(reserved.status).toBe(201);
    expect(reserved.body.reservation.queue_position).toBe(1);

    // Ravi's loan is returned: the copy is held for Meera
    const returned = await request(app)
      .post(`/api/loans/${issued.body.loan.id}/return`)
      .set(auth(librarian));
    expect(returned.body.copy_status).toBe("on_hold");
    expect(returned.body.held_for.member_name).toBe("Meera Nair");

    // Nobody else can be issued the held copy
    const stolen = await request(app)
      .post("/api/loans")
      .set(auth(librarian))
      .send({ memberId: member.user.id, copyCode });
    expect(stolen.status).toBe(409);
  });
});