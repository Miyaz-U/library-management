import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Books from "./pages/Books";
import MyLoans from "./pages/MyLoans";
import MyReservations from "./pages/MyReservations";
import Circulation from "./pages/Circulation";
import Overdue from "./pages/Overdue";
import ManageBooks from "./pages/ManageBooks";

// Pages that need a logged-in user
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-note">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Pages only librarians should see (the server also enforces this)
function RequireLibrarian({ children }) {
  const { user } = useAuth();
  if (user.role !== "librarian") return <Navigate to="/" replace />;
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
        <Route path="/loans" element={<MyLoans />} />
        <Route path="/reservations" element={<MyReservations />} />
        <Route path="/circulation" element={<RequireLibrarian><Circulation /></RequireLibrarian>} />
        <Route path="/overdue" element={<RequireLibrarian><Overdue /></RequireLibrarian>} />
        <Route path="/manage" element={<RequireLibrarian><ManageBooks /></RequireLibrarian>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}