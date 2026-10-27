import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import ErrorMessage from "../components/ErrorMessage";

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="muted">Member accounts can search, reserve and view their loans.</p>

        <ErrorMessage error={error} />

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password (at least 8 characters)</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-block" type="submit" disabled={busy}>
            {busy ? "Creating..." : "Sign up"}
          </button>
        </form>

        <p className="switch-link">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}