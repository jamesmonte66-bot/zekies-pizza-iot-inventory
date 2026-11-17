
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { signOut } from "firebase/auth";

import {
  Activity,
  Box,
  ChevronRight,
  Database,
  FileText,
  LogOut,
  UserPlus,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";

import { auth, database } from "../firebase";
import "../App.css";

function Layout() {
  const navigate = useNavigate();

  const [firebaseConnected, setFirebaseConnected] = useState(false);

  // Firebase connection status
  useEffect(() => {
    const connectionRef = ref(database, ".info/connected");

    const unsubscribe = onValue(connectionRef, (snapshot) => {
      setFirebaseConnected(snapshot.val() === true);
    });

    return () => unsubscribe();
  }, []);

  // Sidebar navigation
  const navigation = [
    {
      to: "/",
      label: "Dashboard",
      icon: Activity,
      end: true,
    },
    {
      to: "/inventory",
      label: "Inventory",
      icon: Box,
    },
    {
      to: "/transactions",
      label: "Transactions",
      icon: Database,
    },
    {
      to: "/reports",
      label: "Reports",
      icon: FileText,
    },
    {
      to: "/register-staff",
      label: "Staff Registration",
      icon: UserPlus,
    },
  ];

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="pro-app">

      {/* SIDEBAR */}
      <aside className="pro-sidebar">

        {/* BRAND */}
        <div className="pro-brand">
          <div className="pro-brand-logo">
            <img
              src="/zekies-logo.jpg"
              alt="Zekie's Pizza"
            />
          </div>

          <div className="pro-brand-text">
            <h2>Zekie's Pizza</h2>
            <span>IoT Inventory System</span>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION */}
        <div className="pro-sidebar-content">
          <div className="pro-nav-section">

            <span className="pro-nav-title">
              Workspace
            </span>

            <nav className="pro-nav">
              {navigation.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `pro-nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <span className="pro-nav-icon">
                    <Icon size={19} />
                  </span>

                  <span className="pro-nav-label">
                    {label}
                  </span>

                  <ChevronRight
                    size={16}
                    className="pro-nav-arrow"
                  />
                </NavLink>
              ))}
            </nav>

          </div>
        </div>

        {/* FIXED BOTTOM SECTION */}
        <div className="pro-sidebar-footer">

          {/* SYSTEM STATUS */}
          <div className="pro-sidebar-system-fixed">
            <span className="pro-nav-title">
              System
            </span>

            <div className="pro-system-status-card">

              <div className="pro-system-icon">
                {firebaseConnected ? (
                  <Wifi size={18} />
                ) : (
                  <WifiOff size={18} />
                )}
              </div>

              <div className="pro-system-text">
                <strong>
                  {firebaseConnected
                    ? "System online"
                    : "System offline"}
                </strong>

                <span>
                  {firebaseConnected
                    ? "Firebase connected"
                    : "Firebase disconnected"}
                </span>
              </div>

              <span
                className={`pro-status-dot ${
                  firebaseConnected ? "online" : "offline"
                }`}
              />

            </div>
          </div>

          {/* LOGOUT */}
          <button
            type="button"
            className="pro-logout"
            onClick={handleLogout}
          >
            <span className="pro-logout-icon">
              <LogOut size={18} />
            </span>

            <span>Logout</span>
          </button>

        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="pro-main">
        <Outlet />
      </main>

    </div>
  );
}

export default Layout;
