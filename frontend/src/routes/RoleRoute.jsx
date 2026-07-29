import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuthStore } from "../store/authStore";
import { hasPermission } from "../utils/accessControl";

// allowedRoles: array of numbers.
// Role IDs: 1=Super Admin, 2=Admin, 5=Client / Management, 3=HR / IC, 4=Employee
export function RoleRoute({ children, allowedRoles, requiredPermission }) {
  const { user } = useAuthStore();

  if (
    !user ||
    !allowedRoles.includes(user.role_id) ||
    !hasPermission(user, requiredPermission)
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

// Prop validation
RoleRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.number).isRequired,
  requiredPermission: PropTypes.string,
};

RoleRoute.defaultProps = {
  requiredPermission: "",
};
