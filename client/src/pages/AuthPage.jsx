import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Field from "../components/ui/Field";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const { user, login, register, loading } = useAuth();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("participant");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    navigate(user.role === "organizer" ? "/organizer" : "/participant", {
      replace: true,
    });
  }, [user, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = String(email || "").trim();
    const trimmedPassword = String(password || "");
    const trimmedFirstName = String(firstName || "").trim();
    const trimmedLastName = String(lastName || "").trim();

    if (mode === "register") {
      if (!trimmedFirstName || !trimmedLastName) {
        const msg = "First name and last name are required";
        setError(msg);
        showToast(msg, "error");
        return;
      }
    }

    const result =
      mode === "login"
        ? await login(trimmedEmail, trimmedPassword)
        : await register(
            trimmedEmail,
            trimmedPassword,
            role,
            trimmedFirstName,
            trimmedLastName
          );

    if (!result.ok) {
      setError(result.message);
      showToast(result.message, "error");
      return;
    }

    showToast(mode === "login" ? "Logged in" : "Account created", "success");
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <div>
            <div className="auth-title">Attendance Tracker</div>
            <div className="auth-sub">
              Organizer creates an event, participants check in with a code.
            </div>
          </div>
          <div className="auth-tabs">
            <Link
              className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
              to="/login"
            >
              Login
            </Link>
            <Link
              className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
              to="/register"
            >
              Register
            </Link>
          </div>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          {mode === "register" ? (
            <div className="grid grid-2">
              <Field label="First name">
                <input
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoComplete="given-name"
                />
              </Field>
              <Field label="Last name">
                <input
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  autoComplete="family-name"
                />
              </Field>
            </div>
          ) : null}

          <Field label="Email">
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          <Field label="Password">
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </Field>

          {mode === "register" ? (
            <Field
              label="Role"
              hint="Choose organizer only if you create events."
            >
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="participant">Participant</option>
                <option value="organizer">Organizer</option>
              </select>
            </Field>
          ) : null}

          {error ? <div className="alert alert-error">{error}</div> : null}

          <Button variant="primary" type="submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Login"
              : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
