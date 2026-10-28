import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { formatDate } from "../format";

function ReservationCard({ r, busy, onCancel }) {
  const active = r.status === "waiting" || r.status === "offered";

  return (
    <article className="loan-card">
      <h3 className="book-title">{r.title}</h3>
      <p className="book-meta">by {r.author}</p>
      <p className="book-meta">Reserved on {formatDate(r.created_at)}</p>

      {r.status === "waiting" && (
        <p className="queue-line">
          Your place in the queue: <strong>#{r.queue_position}</strong>
        </p>
      )}
      {r.status === "offered" && (
        <div className="alert alert-success">
          A copy is being held for you ({r.copy_code}). Ask a librarian to issue it.
        </div>
      )}
      {r.status === "fulfilled" && <span className="pill pill-ok">Borrowed</span>}
      {r.status === "cancelled" && <span className="pill pill-muted">Cancelled</span>}

      {active && (
        <div className="card-action">
          <button
            className="btn btn-small btn-ghost"
            disabled={busy}
            onClick={() => onCancel(r)}
          >
            {busy ? "Cancelling..." : "Cancel reservation"}
          </button>
        </div>
      )}
    </article>
  );
}

export default function MyReservations() {
  const [items, setItems] = useState(null); // null = still loading
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/reservations/mine");
      setItems(data.reservations);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(r) {
    if (!window.confirm(`Cancel your reservation for "${r.title}"?`)) return;
    setError(null);
    setBusyId(r.id);
    try {
      await api(`/api/reservations/${r.id}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  if (!items && !error) return <p className="center-note">Loading...</p>;

  const active = (items || []).filter((r) => r.status === "waiting" || r.status === "offered");
  const past = (items || []).filter((r) => r.status === "fulfilled" || r.status === "cancelled");

  return (
    <section>
      <h1 className="page-title">My Reservations</h1>
      <p className="muted">Reservations are first come, first served.</p>

      <ErrorMessage error={error} />

      <h2 className="section-title">Active</h2>
      {active.length === 0 ? (
        <p className="center-note">You have no active reservations.</p>
      ) : (
        <div className="card-grid">
          {active.map((r) => (
            <ReservationCard key={r.id} r={r} busy={busyId === r.id} onCancel={cancel} />
          ))}
        </div>
      )}

      <h2 className="section-title">History</h2>
      {past.length === 0 ? (
        <p className="center-note">Nothing here yet.</p>
      ) : (
        <div className="card-grid">
          {past.map((r) => (
            <ReservationCard key={r.id} r={r} busy={false} onCancel={cancel} />
          ))}
        </div>
      )}
    </section>
  );
}