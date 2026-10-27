import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import ErrorMessage from "../components/ErrorMessage";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      // On success the user is set and the router redirects automatically
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  function fillDemo(demoEmail, demoPassword) {
    setEmail(demoEmail);
    setPassword(demoPassword);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Library Login</h1>
        <p className="muted">Sign in to search, borrow and reserve books.</p>

        <ErrorMessage error={error} />

        <form onSubmit={handleSubmit} noValidate>
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
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-block" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Log in"}
          </button>
        </form>

        <p className="switch-link">
          New member? <Link to="/register">Create an account</Link>
        </p>

        <div className="demo-box">
          Demo accounts (from the seed script):
          <div className="demo-actions">
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => fillDemo("librarian@library.com", "Library@123")}
            >
              Fill librarian
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => fillDemo("ravi@example.com", "Member@123")}
            >
              Fill member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}