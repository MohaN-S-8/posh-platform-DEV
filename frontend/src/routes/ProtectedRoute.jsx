import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuthStore } from "../store/authStore";

// Blocks unauthenticated users — redirects to /login
export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Prop validation
ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};
