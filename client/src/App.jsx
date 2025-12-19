import { BrowserRouter } from "react-router-dom";
import Navbar from "./components/Navbar";
import AppRouter from "./routes/AppRouter";
import { useAuth } from "./context/AuthContext.jsx";

export default function App() {
  const { user, logout } = useAuth();

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar user={user} onLogout={logout} />
        <main className="app-main">
          <AppRouter user={user} />
        </main>
      </div>
    </BrowserRouter>
  );
}
