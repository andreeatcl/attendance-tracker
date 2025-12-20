import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "../pages/AuthPage";
import HomePage from "../pages/HomePage";
import OrganizerPage from "../pages/OrganizerPage";
import ParticipantPage from "../pages/ParticipantPage";

function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ user, role, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role)
    return (
      <Navigate
        to={user.role === "organizer" ? "/organizer" : "/participant"}
        replace
      />
    );
  return children;
}

export default function AppRouter({ user }) {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route
        path="/organizer"
        element={
          <RequireRole user={user} role="organizer">
            <OrganizerPage />
          </RequireRole>
        }
      />
      <Route
        path="/participant"
        element={
          <RequireRole user={user} role="participant">
            <ParticipantPage />
          </RequireRole>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={
              user
                ? user.role === "organizer"
                  ? "/organizer"
                  : "/participant"
                : "/"
            }
            replace
          />
        }
      />
    </Routes>
  );
}
