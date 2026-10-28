import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";

const EMPTY = { title: "", author: "", isbn: "", category: "", copies: "1" };

function BookRow({ book, onAddCopies }) {
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await onAddCopies(book, Number(count));
    setBusy(false);
    setCount("1");
  }

  return (
    <div className="row-item">
      <div>
        <strong>{book.title}</strong>
        <div className="book-meta">
          {book.author} · ISBN {book.isbn} · {book.category}
        </div>
        <div className="book-meta">
          {book.available_copies} of {book.total_copies} copies available
        </div>
      </div>
      <div className="inline-form">
        <input
          className="copies-input"
          type="number"
          min="1"
          aria-label={`Copies to add to ${book.title}`}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          onWheel={(e) => e.target.blur()}
        />
        <button className="btn btn-small btn-ghost" disabled={busy} onClick={submit}>
          {busy ? "Adding..." : "Add copies"}
        </button>
      </div>
    </div>
  );
}

export default function ManageBooks() {
  const [books, setBooks] = useState(null); // null = still loading
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/books");
      setBooks(data.books);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (name) => (e) => setForm({ ...form, [name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      await api("/api/books", {
        method: "POST",
        body: { ...form, copies: Number(form.copies) },
      });
      setNotice(`Added "${form.title}" with ${form.copies} ${Number(form.copies) === 1 ? "copy" : "copies"}.`);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(err); // validation list or "A book with this ISBN already exists"
    } finally {
      setBusy(false);
    }
  }

  async function addCopies(book, count) {
    setNotice(null);
    setError(null);
    try {
      await api(`/api/books/${book.id}/copies`, { method: "POST", body: { count } });
      setNotice(`Added ${count} ${count === 1 ? "copy" : "copies"} to "${book.title}".`);
      await load();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <section>
      <h1 className="page-title">Manage Books</h1>
      <p className="muted">Add new titles and physical copies.</p>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      <ErrorMessage error={error} />

      <div className="panel">
        <h2 className="section-title no-top">Add a book</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" value={form.title} onChange={setField("title")} />
            </div>
            <div className="field">
              <label htmlFor="author">Author</label>
              <input id="author" value={form.author} onChange={setField("author")} />
            </div>
            <div className="field">
              <label htmlFor="isbn">ISBN (10 or 13 digits)</label>
              <input id="isbn" value={form.isbn} onChange={setField("isbn")} />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <input id="category" value={form.category} onChange={setField("category")} />
            </div>
            <div className="field">
              <label htmlFor="copies">Number of copies</label>
              <input
                id="copies"
                type="number"
                min="1"
                value={form.copies}
                onChange={setField("copies")}
                onWheel={(e) => e.target.blur()}
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Saving..." : "Add book"}
          </button>
        </form>
      </div>

      <h2 className="section-title">All books</h2>
      {!books ? (
        <p className="center-note">Loading...</p>
      ) : (
        <div className="stack">
          {books.map((book) => (
            <BookRow key={book.id} book={book} onAddCopies={addCopies} />
          ))}
        </div>
      )}
    </section>
  );
}