import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { formatDate, rupees } from "../format";

export default function Circulation() {
  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState(null); // null = still loading
  const [held, setHeld] = useState([]);

  const [memberId, setMemberId] = useState("");
  const [bookId, setBookId] = useState("");
  const [copies, setCopies] = useState([]);
  const [copyCode, setCopyCode] = useState("");

  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [m, b, l, h] = await Promise.all([
        api("/api/members"),
        api("/api/books"),
        api("/api/loans?status=open"),
        api("/api/reservations?status=offered"),
      ]);
      setMembers(m.members);
      setBooks(b.books);
      setLoans(l.loans);
      setHeld(h.reservations);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Copies of the chosen book that are not currently on loan
  const loadCopies = useCallback(async (id) => {
    if (!id) {
      setCopies([]);
      return;
    }
    try {
      const data = await api(`/api/books/${id}`);
      setCopies(data.copies.filter((c) => c.status !== "on_loan"));
    } catch (err) {
      setError(err);
    }
  }, []);

  function chooseBook(id) {
    setBookId(id);
    setCopyCode("");
    loadCopies(id);
  }

  async function issue(body, busyKey) {
    setNotice(null);
    setError(null);
    setBusy(busyKey);
    try {
      const data = await api("/api/loans", { method: "POST", body });
      const loan = data.loan;
      setNotice(`Issued "${loan.title}" to ${loan.member_name}. Due ${formatDate(loan.due_date)}.`);
      setCopyCode("");
      await Promise.all([loadAll(), loadCopies(bookId)]);
    } catch (err) {
      setError(err); // the server's message, e.g. "This member already has 3 books..."
    } finally {
      setBusy(null);
    }
  }

  function handleIssue(e) {
    e.preventDefault();
    // An empty choice is sent as missing, so the server explains what is wrong
    issue({ memberId: memberId ? Number(memberId) : undefined, copyCode }, "issue");
  }

  async function returnLoan(loan) {
    if (!window.confirm(`Return "${loan.title}" from ${loan.member_name}?`)) return;
    setNotice(null);
    setError(null);
    setBusy(`return-${loan.id}`);
    try {
      const data = await api(`/api/loans/${loan.id}/return`, { method: "POST" });
      let message = `Returned "${loan.title}". `;
      message += data.loan.fine > 0 ? `Fine to collect: ${rupees(data.loan.fine)}.` : "No fine.";
      if (data.held_for) message += ` The copy is now held for ${data.held_for.member_name}.`;
      setNotice(message);
      await Promise.all([loadAll(), loadCopies(bookId)]);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h1 className="page-title">Circulation</h1>
      <p className="muted">Issue books to members and process returns.</p>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      <ErrorMessage error={error} />

      <div className="panel">
        <h2 className="section-title no-top">Issue a book</h2>
        <form onSubmit={handleIssue} noValidate>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="member">Member</label>
              <select id="member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Choose a member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.active_loans}/3 books)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="book">Book</label>
              <select id="book" value={bookId} onChange={(e) => chooseBook(e.target.value)}>
                <option value="">Choose a book</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.available_copies} available)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="copy">Copy</label>
              <select id="copy" value={copyCode} onChange={(e) => setCopyCode(e.target.value)}>
                <option value="">
                  {bookId && copies.length === 0 ? "No copies on the shelf" : "Choose a copy"}
                </option>
                {copies.map((c) => (
                  <option key={c.id} value={c.copy_code}>
                    {c.copy_code} ({c.status === "on_hold" ? "held for a reservation" : "available"})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy === "issue"}>
            {busy === "issue" ? "Issuing..." : "Issue book"}
          </button>
        </form>
      </div>

      {held.length > 0 && (
        <div className="panel">
          <h2 className="section-title no-top">Held for pickup</h2>
          <p className="muted">These copies are reserved. Only the named member can borrow them.</p>
          <div className="stack">
            {held.map((r) => (
              <div className="row-item" key={r.id}>
                <div>
                  <strong>{r.title}</strong>
                  <div className="book-meta">
                    Copy {r.copy_code} held for {r.member_name}
                  </div>
                </div>
                <button
                  className="btn btn-small"
                  disabled={busy === `held-${r.id}`}
                  onClick={() =>
                    issue({ memberId: r.member_id, copyCode: r.copy_code }, `held-${r.id}`)
                  }
                >
                  {busy === `held-${r.id}` ? "Issuing..." : "Issue"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="section-title">Books currently out</h2>
      {!loans ? (
        <p className="center-note">Loading...</p>
      ) : loans.length === 0 ? (
        <p className="center-note">No books are out right now.</p>
      ) : (
        <div className="card-grid">
          {loans.map((loan) => (
            <article
              key={loan.id}
              className={`loan-card ${loan.is_overdue ? "loan-overdue" : ""}`}
            >
              <h3 className="book-title">{loan.title}</h3>
              <p className="book-meta">
                {loan.member_name} · Copy {loan.copy_code}
              </p>
              <dl className="facts">
                <div>
                  <dt>Due</dt>
                  <dd>{formatDate(loan.due_date)}</dd>
                </div>
                {loan.is_overdue && (
                  <div>
                    <dt>Fine so far</dt>
                    <dd className="fine-text">{rupees(loan.fine)}</dd>
                  </div>
                )}
              </dl>
              {loan.is_overdue && (
                <div>
                  <span className="pill pill-none">
                    Overdue by {loan.overdue_days} {loan.overdue_days === 1 ? "day" : "days"}
                  </span>
                </div>
              )}
              <div className="card-action">
                <button
                  className="btn btn-small btn-ghost"
                  disabled={busy === `return-${loan.id}`}
                  onClick={() => returnLoan(loan)}
                >
                  {busy === `return-${loan.id}` ? "Returning..." : "Return"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}