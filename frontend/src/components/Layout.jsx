import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Library</span>
          <nav className="nav">
            <NavLink to="/" end>
              Books
            </NavLink>
          </nav>
          <div className="user-box">
            <span className="user-name">{user.name}</span>
            <span className={`badge badge-${user.role}`}>{user.role}</span>
            <button className="btn btn-small btn-ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}