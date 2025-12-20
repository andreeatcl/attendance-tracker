import { Link } from "react-router-dom";
import Button from "./ui/Button";

export default function Navbar({ user, onLogout }) {
  const personalPath =
    user?.role === "organizer"
      ? "/organizer"
      : user?.role === "participant"
      ? "/participant"
      : "/";

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          Attendance Tracker
        </Link>
        <div className="nav-right">
          {user ? (
            <>
              <Link className="nav-link" to={personalPath}>
                My page
              </Link>
              <div className="pill">{user.role}</div>
              <Button type="button" className="nav-logout" onClick={onLogout}>
                Logout
              </Button>
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
