import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { signOut } from "firebase/auth";
import {
  Activity,
  Box,
  ChevronRight,
  Database,
  LogOut,
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

const staffNavigation = [
  {
    to: "/staff",
    label: "Dashboard",
    icon: Activity,
    end: true,
  },
  {
    to: "/staff/inventory",
    label: "Inventory",
    icon: Box,
  },
  {
    to: "/staff/transactions",
    label: "Transactions",
    icon: Database,
  },
];

function StaffLayout() {
  const [connected, setConnected] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const connectionRef = ref(
      database,
      ".info/connected"
    );

    const unsubscribe = onValue(
      connectionRef,
      (snapshot) => {
        setConnected(snapshot.val() === true);
      },
      (error) => {
        console.error(
          "Firebase connection error:",
          error
        );

        setConnected(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      setLogoutError("");

      await signOut(auth);

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error("Logout error:", error);

      setLogoutError(
        "Unable to log out. Please try again."
      );
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="app app-shell">

      {/* SIDEBAR */}
      <aside className="sidebar pro-sidebar">

        {/* BRAND */}
        <div className="sidebar-brand">

          <div className="sidebar-brand-logo">
            <img
              src="/zekies-logo.jpg"
              alt="Zekie's Pizza"
              className="zekies-logo"
            />
          </div>

          <div className="sidebar-brand-copy">
            <h1>Zekie's Pizza</h1>
            <p>Staff Workspace</p>
          </div>

        </div>

        {/* WORKSPACE */}
        <div className="sidebar-section-label">
          Workspace
        </div>

        {/* NAVIGATION */}
        <nav className="sidebar-nav">

          {staffNavigation.map(
            ({
              to,
              label,
              icon: Icon,
              end,
            }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `pro-nav-item ${
                    isActive ? "active" : ""
                  }`
                }
              >

                <span className="pro-nav-icon">
                  <Icon
                    size={18}
                    strokeWidth={2}
                  />
                </span>

                <span className="pro-nav-label">
                  {label}
                </span>

                <ChevronRight
                  size={15}
                  className="pro-nav-arrow"
                />

              </NavLink>
            )
          )}

        </nav>

        {/* SIDEBAR BOTTOM */}
        <div className="sidebar-bottom pro-sidebar-bottom">

          <div className="sidebar-section-label">
            System
          </div>

          {/* FIREBASE CONNECTION */}
          <div
            className={`pro-connection ${
              connected ? "online" : "offline"
            }`}
          >

            <div className="connection-icon">
              {connected ? (
                <Wifi size={16} />
              ) : (
                <WifiOff size={16} />
              )}
            </div>

            <div className="connection-information">

              <strong>
                {connected
                  ? "System online"
                  : "System offline"}
              </strong>

              <span>
                {connected
                  ? "Firebase connected"
                  : "Connection unavailable"}
              </span>

            </div>

            <span className="connection-dot" />

          </div>

          {/* LOGOUT ERROR */}
          {logoutError && (
            <div className="sidebar-error">
              {logoutError}
            </div>
          )}

          {/* LOGOUT */}
          <button
            type="button"
            className="pro-sidebar-logout"
            onClick={handleLogout}
            disabled={logoutLoading}
          >
            <LogOut size={17} />

            <span>
              {logoutLoading
                ? "Logging out..."
                : "Log out"}
            </span>
          </button>

          {/* FOOTER */}
          <div className="sidebar-footer">
            Zekie's Pizza Staff
          </div>

        </div>

      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content pro-main-content">
        <Outlet />
      </main>

    </div>
  );
}

export default StaffLayout;