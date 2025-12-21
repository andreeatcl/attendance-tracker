import { BrowserRouter } from "react-router-dom";
import Navbar from "./components/Navbar";
import AppRouter from "./routes/AppRouter";
import { useAuth } from "./context/AuthContext.jsx";
import { useToast } from "./context/ToastContext.jsx";

export default function App() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  function handleLogout() {
    logout();
    showToast("Logged out", "info");
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar user={user} onLogout={handleLogout} />
        <main className="app-main">
          <AppRouter user={user} />
        </main>
      </div>
    </BrowserRouter>
  );
}
