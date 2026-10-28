import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import ErrorMessage from "../components/ErrorMessage";

function BookCard({ book, isMember, reservation, hasLoan, busy, onReserve }) {
  const none = book.available_copies === 0;

  // What can this member do with this book?
  let action = null;
  if (isMember) {
    if (hasLoan) {
      action = <span className="pill pill-info">You have a copy</span>;
    } else if (reservation?.status === "offered") {
      action = <span className="pill pill-ok">Held for you. Ask a librarian</span>;
    } else if (reservation) {
      action = (
        <span className="pill pill-info">Reserved, position {reservation.queue_position}</span>
      );
    } else if (none) {
      action = (
        <button className="btn btn-small" disabled={busy} onClick={() => onReserve(book)}>
          {busy ? "Reserving..." : "Reserve"}
        </button>
      );
    }
  }

  return (
    <article className="book-card">
      <h2 className="book-title">{book.title}</h2>
      <p className="book-meta">by {book.author}</p>
      <p className="book-meta">ISBN {book.isbn}</p>
      <p className="book-meta">
        <span className="chip">{book.category}</span>
      </p>
      <div className="availability">
        <span className={`pill ${none ? "pill-none" : "pill-ok"}`}>
          {none
            ? "All copies out"
            : `${book.available_copies} of ${book.total_copies} available`}
        </span>
        {action && <div className="card-action">{action}</div>}
      </div>
    </article>
  );
}

export default function Books() {
  const { user } = useAuth();
  const isMember = user.role === "member";

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The member's own reservations and loans (used to label each card)
  const [reservationByBook, setReservationByBook] = useState({});
  const [loanBookIds, setLoanBookIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadMine = useCallback(async () => {
    if (!isMember) return;
    try {
      const [res, loans] = await Promise.all([
        api("/api/reservations/mine"),
        api("/api/loans/mine"),
      ]);
      const active = {};
      for (const r of res.reservations) {
        if (r.status === "waiting" || r.status === "offered") active[r.book_id] = r;
      }
      setReservationByBook(active);
      setLoanBookIds(loans.loans.filter((l) => !l.returned_at).map((l) => l.book_id));
    } catch (err) {
      setActionError(err);
    }
  }, [isMember]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  // Search 300 ms after the user stops typing
  useEffect(() => {
    let cancelled = false; // ignore answers that arrive after a newer search started
    setLoading(true);

    const timer = setTimeout(
      async () => {
        try {
          const data = await api(`/api/books?q=${encodeURIComponent(query.trim())}`);
          if (!cancelled) {
            setBooks(data.books);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) setError(err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      query ? 300 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function reserve(book) {
    setNotice(null);
    setActionError(null);
    setBusyId(book.id);
    try {
      await api("/api/reservations", { method: "POST", body: { bookId: book.id } });
      setNotice(`You joined the queue for "${book.title}".`);
      await loadMine();
    } catch (err) {
      setActionError(err); // the server's message, e.g. "You already have a reservation..."
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h1 className="page-title">Books</h1>
      <p className="muted">Search by title, author or ISBN.</p>

      <div className="search">
        <input
          type="search"
          aria-label="Search books"
          placeholder="Search by title, author or ISBN"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      <ErrorMessage error={actionError} />
      <ErrorMessage error={error} />

      {loading && <p className="center-note">Loading...</p>}

      {!loading && !error && books.length === 0 && (
        <p className="center-note">
          {query ? `No books match "${query}".` : "No books in the library yet."}
        </p>
      )}

      {!loading && books.length > 0 && (
        <>
          <p className="muted result-count">
            {books.length} {books.length === 1 ? "book" : "books"}
          </p>
          <div className="book-grid">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isMember={isMember}
                reservation={reservationByBook[book.id]}
                hasLoan={loanBookIds.includes(book.id)}
                busy={busyId === book.id}
                onReserve={reserve}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}