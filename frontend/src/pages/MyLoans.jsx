import { useEffect, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { formatDate, rupees, daysUntil } from "../format";

const MAX_BOOKS = 3; // display only; the server enforces the real limit

function OpenLoan({ loan }) {
  const left = daysUntil(loan.due_date);
  let status;
  if (loan.is_overdue) {
    status = (
      <span className="pill pill-none">
        Overdue by {loan.overdue_days} {loan.overdue_days === 1 ? "day" : "days"}
      </span>
    );
  } else if (left === 0) {
    status = <span className="pill pill-warn">Due today</span>;
  } else {
    status = (
      <span className="pill pill-ok">
        {left} {left === 1 ? "day" : "days"} left
      </span>
    );
  }

  return (
    <article className={`loan-card ${loan.is_overdue ? "loan-overdue" : ""}`}>
      <h3 className="book-title">{loan.title}</h3>
      <p className="book-meta">by {loan.author}</p>
      <p className="book-meta">Copy {loan.copy_code}</p>
      <dl className="facts">
        <div>
          <dt>Borrowed</dt>
          <dd>{formatDate(loan.issued_at)}</dd>
        </div>
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
      <div>{status}</div>
    </article>
  );
}

function PastLoan({ loan }) {
  return (
    <article className="loan-card">
      <h3 className="book-title">{loan.title}</h3>
      <p className="book-meta">by {loan.author}</p>
      <dl className="facts">
        <div>
          <dt>Borrowed</dt>
          <dd>{formatDate(loan.issued_at)}</dd>
        </div>
        <div>
          <dt>Returned</dt>
          <dd>{formatDate(loan.returned_at)}</dd>
        </div>
      </dl>
      {loan.fine_amount > 0 ? (
        <span className="pill pill-none">
          Fine {rupees(loan.fine_amount)} ({loan.overdue_days}{" "}
          {loan.overdue_days === 1 ? "day" : "days"} late)
        </span>
      ) : (
        <span className="pill pill-ok">Returned on time</span>
      )}
    </article>
  );
}

export default function MyLoans() {
  const [loans, setLoans] = useState(null); // null = still loading
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/loans/mine")
      .then((data) => setLoans(data.loans))
      .catch(setError);
  }, []);

  if (error) return <ErrorMessage error={error} />;
  if (!loans) return <p className="center-note">Loading...</p>;

  const open = loans.filter((l) => !l.returned_at);
  const past = loans.filter((l) => l.returned_at);
  const finesNow = open.reduce((sum, l) => sum + l.fine, 0);

  return (
    <section>
      <h1 className="page-title">My Loans</h1>
      <p className="muted">Books are lent for 14 days. Late returns cost ₹5 per day.</p>

      <div className="summary">
        <div className="summary-item">
          <span className="summary-number">
            {open.length} / {MAX_BOOKS}
          </span>
          <span className="muted">books borrowed</span>
        </div>
        <div className="summary-item">
          <span className={`summary-number ${finesNow > 0 ? "fine-text" : ""}`}>
            {rupees(finesNow)}
          </span>
          <span className="muted">fines on current loans</span>
        </div>
      </div>

      <h2 className="section-title">Currently borrowed</h2>
      {open.length === 0 ? (
        <p className="center-note">You have no books out right now.</p>
      ) : (
        <div className="card-grid">
          {open.map((loan) => (
            <OpenLoan key={loan.id} loan={loan} />
          ))}
        </div>
      )}

      <h2 className="section-title">History</h2>
      {past.length === 0 ? (
        <p className="center-note">No returned books yet.</p>
      ) : (
        <div className="card-grid">
          {past.map((loan) => (
            <PastLoan key={loan.id} loan={loan} />
          ))}
        </div>
      )}
    </section>
  );
}