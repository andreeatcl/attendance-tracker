import { Link } from "react-router-dom";
import Button from "./ui/Button";

export default function Navbar({ user, onLogout }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link
          to={
            user
              ? user.role === "organizer"
                ? "/organizer"
                : "/participant"
              : "/login"
          }
          className="brand"
        >
          Attendance Tracker
        </Link>
        <div className="nav-right">
          {user ? <div className="pill">{user.role}</div> : null}
          {user ? (
            <Button type="button" onClick={onLogout}>
              Logout
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
