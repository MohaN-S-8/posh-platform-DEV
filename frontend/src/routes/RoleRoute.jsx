import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuthStore } from "../store/authStore";

// allowedRoles: array of numbers, e.g. [1] for Super Admin, [1,2,3] for Admin+HR
// Role IDs: 1=Super Admin, 2=Company Admin, 3=HR, 4=Employee
export function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuthStore();

  if (!user || !allowedRoles.includes(user.role_id)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

// Prop validation
RoleRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.number).isRequired,
};
