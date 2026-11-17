import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({
  user,
  allowedRoles,
  children,
}) {
  const location = useLocation();

  // Not logged in
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // If no role restriction was provided,
  // simply require authentication.
  if (!allowedRoles || allowedRoles.length === 0) {
    return children;
  }

  // Role is stored in Firebase Realtime Database,
  // so App.jsx will provide userRole.
  const userRole = user.userRole;

  if (!allowedRoles.includes(userRole)) {
    if (userRole === "staff") {
      return <Navigate to="/staff" replace />;
    }

    if (userRole === "admin") {
      return <Navigate to="/" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;