import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Books from "./pages/Books";

// Pages that need a logged-in user
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-note">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Login and register pages: logged-in users are sent to the home page
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-note">Loading...</p>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/" element={<Books />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}