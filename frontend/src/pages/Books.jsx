import { useEffect, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";

function BookCard({ book }) {
  const none = book.available_copies === 0;
  return (
    <article className="book-card">
      <h2 className="book-title">{book.title}</h2>
      <p className="book-meta">by {book.author}</p>
      <p className="book-meta">ISBN {book.isbn}</p>
      <p className="book-meta">
        <span className="chip">{book.category}</span>
      </p>
      <p className="availability">
        <span className={`pill ${none ? "pill-none" : "pill-ok"}`}>
          {none
            ? "All copies out"
            : `${book.available_copies} of ${book.total_copies} available`}
        </span>
      </p>
    </article>
  );
}

export default function Books() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}