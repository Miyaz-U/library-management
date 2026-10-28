# Library Management System

A full-stack web application for managing a library: books and their physical
copies, member and librarian accounts, borrowing with automatic late fines
(₹5 per overdue day), a fair first-come-first-served reservation queue, and
search by title, author or ISBN. Works on phones and laptops.

**Live demo:** _not deployed_ (replace with your link if you deploy)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | SQLite (`better-sqlite3`) |
| Frontend | React (Vite), plain responsive CSS, light/dark theme |
| Auth | JWT + bcrypt |
| Validation | Zod (server side) |
| Tests | Vitest + Supertest |

## Features

- Books (title, author, ISBN, category) with multiple physical copies
- Member and librarian accounts; librarians issue and return copies
- 14-day loans; late fine of ₹5 per overdue day, calculated on return
- Reservation queue: when every copy is out, members can reserve. On return,
  the copy is held for the first eligible member in the queue, and nobody
  else can be issued it
- Search by title, author or ISBN, showing available copies
- A member can borrow at most 3 books at a time
- Overdue report for librarians
- Show/hide password and a light/dark theme

## Quick Start

Requires **Node.js 20 or newer** and Git.

```bash
git clone https://github.com/YOUR-USERNAME/library-management.git
cd library-management
```

### 1. Backend

```bash
cd backend
npm install
```

Create your settings file:

```bash
# Mac / Linux
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env
```

Open `backend/.env` and set `JWT_SECRET` to a long random value. You can
generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Load the demo data and start the API:

```bash
npm run seed
npm run dev
```

The API runs at http://localhost:4000 (check http://localhost:4000/api/health).

### 2. Frontend (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### 3. Run the tests

```bash
cd backend
npm test
```

## Demo Logins

Created by `npm run seed`. Running the seed again resets all data.

| Role | Email | Password |
|---|---|---|
| Librarian | `librarian@library.com` | `Library@123` |
| Member | `ravi@example.com` | `Member@123` |
| Member | `meera@example.com` | `Member@123` |
| Member | `kiran@example.com` | `Member@123` |
| Member | `divya@example.com` | `Member@123` |

The seed builds these scenarios:

| Scenario | What to look at |
|---|---|
| Divya's *Refactoring* is 6 days overdue | Overdue report, fine of ₹30 |
| Kiran holds 3 books | The 3-book limit; he is skipped in queues |
| Ravi has the only copy of *The Pragmatic Programmer*; Kiran, then Meera, are queued | Return Ravi's loan as the librarian: the copy is held for **Meera**, because Kiran is at the limit but keeps his place |
| Meera returned *Sapiens* 6 days late | A past loan with a saved ₹30 fine |

## Environment Variables

Listed in `backend/.env.example` (never commit the real `.env`):

| Variable | Purpose |
|---|---|
| `PORT` | Port for the API (default 4000) |
| `JWT_SECRET` | Secret used to sign login tokens |
| `DATABASE_PATH` | SQLite file location (default `./library.db`) |
| `CLIENT_URL` | Frontend address allowed by CORS (default `http://localhost:5173`) |

The frontend has an optional `frontend/.env.example` with `VITE_API_URL`.

## Data Model

```
users ──< loans >── copies >── books
  │                              │
  └────────< reservations >──────┘
```

| Table | Purpose |
|---|---|
| `users` | Members and librarians (`role`), hashed passwords |
| `books` | One row per title: title, author, unique ISBN, category |
| `copies` | One row per physical copy. `status` is `available`, `on_loan` or `on_hold` |
| `loans` | One row per borrow: due date, return time, saved fine |
| `reservations` | The queue: `waiting`, `offered`, `fulfilled` or `cancelled` |

## Design Decisions

- **Book vs copy.** Searching works on books; borrowing works on copies.
- **`on_hold` status.** A returned copy with a waiting reservation becomes
  `on_hold`, not `available`. This one status is how the app guarantees a
  reserved copy cannot be issued to anyone but the member it is held for.
- **Queue order without a position column.** The queue is ordered by
  `created_at`, then `id` as a tie-breaker. Position is computed when
  needed, so there is nothing to renumber when someone leaves.
- **Eligible member.** A queued member who already holds 3 books is skipped
  for that copy but keeps their place in line.
- **One helper for freeing copies.** `releaseCopy` is used on return, on
  cancelling an offered reservation, and when new copies are added.
- **Fines.** Whole rupees stored as integers. Calendar days in UTC: returned
  any time on the due date is on time; the next day is 1 day late.
  The calculation is a pure function (`utils/fines.js`).
- **Services take a `now` parameter**, so tests and the seed can use fixed
  past dates. The seed uses the real services, so demo data follows the rules.
- **Database-level rules.** Partial unique indexes ensure a copy has only one
  open loan and a member has only one active reservation per book.
- **Transactions** keep multi-table changes all-or-nothing.
- **Security.** bcrypt password hashing, JWT auth, role checks on the server,
  Zod validation on every input, parameterised SQL queries, and public
  sign-up always creates a member. Librarians come only from the seed.
- **Server is the authority.** The UI hides impossible actions, but the
  server enforces every rule and its error messages are shown in the UI.
- **Token storage.** The JWT is kept in `localStorage`. This is simple, but
  readable by any script on the page; React escapes output by default.

## Tests

`npm test` in `backend` runs the automated tests 30 tests covering fine calculation, issuing and returning, the 3-book limit,
the reservation queue (order, hold, cancel, skipping), and API tests for
validation, roles and an end-to-end borrow/reserve/return/hold flow. Each
test uses a fresh in-memory database.

## API Overview

| Method | URL | Who |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Public |
| GET | `/api/auth/me` | Logged in |
| GET | `/api/books?q=`, `/api/books/:id` | Logged in |
| POST | `/api/books`, `/api/books/:id/copies` | Librarian |
| POST | `/api/loans`, `/api/loans/:id/return` | Librarian |
| GET | `/api/loans/mine` | Logged in |
| GET | `/api/loans?status=` | Librarian |
| POST | `/api/reservations` | Member |
| GET | `/api/reservations/mine` | Logged in |
| GET | `/api/reservations?status=` | Librarian |
| POST | `/api/reservations/:id/cancel` | Owner or librarian |
| GET | `/api/reports/overdue`, `/api/members` | Librarian |

## What Is Finished

All core requirements and both stretch features: books and copies, accounts
and roles, 14-day loans and ₹5/day fines, the reservation queue with held
copies, search with available counts, the 3-book limit, and the overdue
report. Plus: automated tests, seed data, responsive UI, light/dark theme.

## What Isn't Finished / With More Time

- Held copies do not expire; an unclaimed hold blocks the queue until a
  librarian cancels it. I would add an expiry (for example 3 days).
- No email or SMS notifications when a copy is ready.
- No password reset, and no screen to create librarian accounts
  (they come from the seed).
- No editing or deleting books, and no pagination for large catalogs.
- No frontend automated tests.
- Fines are recorded but there is no "fine paid" tracking.
- Not deployed (SQLite on a single server; I would move to PostgreSQL for
  a hosted version).

## AI Tools Used

- **Claude (Anthropic):** guided the step-by-step build, helped design the
  data model and the reservation queue, and drafted code and tests.
- _(Add any others you used, such as Copilot or ChatGPT, and what for.)_

I reviewed and ran every part, and can explain each file.