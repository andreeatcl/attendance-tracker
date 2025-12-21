import { Link } from "react-router-dom";
import HeroIcon from "./icons/HeroIcon";

export default function Navbar({ user, onLogout }) {
  const personalPath =
    user?.role === "organizer"
      ? "/organizer"
      : user?.role === "participant"
      ? "/participant"
      : "/";

  const displayName = [user?.firstName, user?.lastName]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");

  const userLabel = displayName || user?.email;

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <HeroIcon className="brand-logo" />
          Attendance Tracker
        </Link>
        <div className="nav-right">
          {user ? (
            <>
              <Link className="nav-link" to={personalPath}>
                My Page
              </Link>
              <div className="pill nav-user">{userLabel}</div>
              <button
                type="button"
                className="nav-link nav-logout"
                onClick={onLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link className="nav-link" to="/login">
                Login
              </Link>
              <Link className="nav-link" to="/register">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
