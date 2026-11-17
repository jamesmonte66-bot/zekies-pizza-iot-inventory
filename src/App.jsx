
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { onValue, ref } from "firebase/database";

import { auth, database } from "./firebase";

import Layout from "./components/Layout";
import StaffLayout from "./components/StaffLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import Transactions from "./pages/Transactions";
import AuditLogs from "./pages/AuditLogs";

import StaffDashboard from "./pages/StaffDashboard";
import RegisterStaff from "./pages/RegisterStaff";

function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let stopProfile = null;
    let version = 0;
    let mounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        const currentVersion = ++version;

        if (stopProfile) {
          stopProfile();
          stopProfile = null;
        }

        if (!mounted) return;

        setUser(null);
        setCheckingAuth(true);

        if (!currentUser) {
          setCheckingAuth(false);
          return;
        }

        const userRef = ref(
          database,
          `Users/${currentUser.uid}`
        );

        const rejectAccount = async (reason) => {
          if (!mounted || currentVersion !== version) {
            return;
          }

          console.warn(reason);

          try {
            await signOut(auth);
          } catch (error) {
            console.error("Sign-out failed:", error);
          }

          if (mounted && currentVersion === version) {
            setUser(null);
            setCheckingAuth(false);
          }
        };

        stopProfile = onValue(
          userRef,
          (snapshot) => {
            if (!mounted || currentVersion !== version) {
              return;
            }

            if (!snapshot.exists()) {
              void rejectAccount("User profile missing.");
              return;
            }

            const profile = snapshot.val();

            if (profile.status !== "active") {
              void rejectAccount("Account is inactive.");
              return;
            }

            if (!["admin", "staff"].includes(profile.role)) {
              void rejectAccount("Invalid user role.");
              return;
            }

            setUser({
              uid: currentUser.uid,
              email: currentUser.email,
              userRole: profile.role,
              userBranch: profile.branch,
              userFullName: profile.fullName,
            });

            setCheckingAuth(false);
          },
          (error) => {
            console.error("Profile read error:", error);
            void rejectAccount("Unable to verify user.");
          }
        );
      },
      (error) => {
        console.error("Authentication error:", error);
        setUser(null);
        setCheckingAuth(false);
      }
    );

    return () => {
      mounted = false;
      version++;

      unsubscribe();

      if (stopProfile) {
        stopProfile();
      }
    };
  }, []);

  if (checkingAuth) {
    return (
      <div className="auth-loading">
        Loading system...
      </div>
    );
  }

  return (
    <Routes>
      {/* LOGIN */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={user.userRole === "admin" ? "/" : "/staff"}
              replace
            />
          ) : (
            <Login />
          )
        }
      />

      {/* ADMIN ROUTES */}
      <Route
        element={
          <ProtectedRoute
            user={user}
            allowedRoles={["admin"]}
          >
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-logs" element={<AuditLogs />} />

        <Route
          path="/register-staff"
          element={<RegisterStaff />}
        />
      </Route>

      {/* STAFF ROUTES */}
      <Route
        element={
          <ProtectedRoute
            user={user}
            allowedRoles={["staff"]}
          >
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/staff" element={<StaffDashboard />} />

        <Route
          path="/staff/inventory"
          element={<Inventory />}
        />

        <Route
          path="/staff/transactions"
          element={<Transactions />}
        />
      </Route>

      {/* UNKNOWN ROUTES */}
      <Route
        path="*"
        element={
          <Navigate
            to={
              !user
                ? "/login"
                : user.userRole === "admin"
                  ? "/"
                  : "/staff"
            }
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
