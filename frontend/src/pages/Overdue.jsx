import { useEffect, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { formatDate, rupees } from "../format";

export default function Overdue() {
  const [report, setReport] = useState(null); // null = still loading
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/reports/overdue").then(setReport).catch(setError);
  }, []);

  if (error) return <ErrorMessage error={error} />;
  if (!report) return <p className="center-note">Loading...</p>;

  return (
    <section>
      <h1 className="page-title">Overdue Report</h1>
      <p className="muted">Books past their due date, most overdue first.</p>

      <div className="summary">
        <div className="summary-item">
          <span className="summary-number">{report.count}</span>
          <span className="muted">overdue {report.count === 1 ? "book" : "books"}</span>
        </div>
        <div className="summary-item">
          <span className={`summary-number ${report.total_fines > 0 ? "fine-text" : ""}`}>
            {rupees(report.total_fines)}
          </span>
          <span className="muted">fines so far</span>
        </div>
      </div>

      {report.count === 0 ? (
        <p className="center-note">No overdue books. Everything is on time.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Member</th>
                <th>Copy</th>
                <th>Due</th>
                <th>Days overdue</th>
                <th>Fine</th>
              </tr>
            </thead>
            <tbody>
              {report.loans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.title}</td>
                  <td>{loan.member_name}</td>
                  <td>{loan.copy_code}</td>
                  <td>{formatDate(loan.due_date)}</td>
                  <td>{loan.overdue_days}</td>
                  <td className="fine-text">{rupees(loan.fine)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}