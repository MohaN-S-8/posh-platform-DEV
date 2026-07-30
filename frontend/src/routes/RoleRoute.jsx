import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import apiClient from "../api/client";
import { useAuthStore } from "../store/authStore";
import { hasPermission } from "../utils/accessControl";

const roleLabels = {
  1: "Super Admin",
  2: "Company Admin",
  5: "Client Admin (Mgmt)",
  3: "HR",
  4: "Employee",
};

const defaultAllowed = {
  "Super Admin": new Set([
    "Home",
    "Create Admin",
    "Masters (State/City/Scope)",
    "Create Company & Work Order",
    "Company Registration - PoSH",
    "Employee Master - PoSH",
    "PoSH Office Master",
    "Role & Access Matrix",
  ]),
  "Company Admin": new Set([
    "Home",
    "PoSH Policy",
    "Create Company & Work Order",
    "Company Registration - PoSH",
    "Employee Master - PoSH",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "Analytics & Reports",
  ]),
  "Client Admin (Mgmt)": new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "Analytics & Reports",
    "Employee Master - PoSH",
  ]),
  HR: new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Complaints",
    "Employee Master - PoSH",
  ]),
  Employee: new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Complaints",
  ]),
};

const accessAliases = {
  Home: ["Home", "Home Page"],
  "Assessment & Certificate": ["Assessment & Certificate", "Assessment & Certificates"],
  "POSH Complaints": ["POSH Complaints", "Raise POSH Complaints"],
};

const accessNamesFor = (accessItem) => accessAliases[accessItem] || [accessItem];

// allowedRoles: array of numbers.
// Role IDs: 1=Super Admin, 2=Admin, 5=Client / Management, 3=HR / IC, 4=Employee
export function RoleRoute({ children, allowedRoles, requiredPermission, accessItem }) {
  const { user } = useAuthStore();
  const [matrixDecision, setMatrixDecision] = useState(null);
  const [checkingMatrix, setCheckingMatrix] = useState(Boolean(accessItem));

  useEffect(() => {
    let isMounted = true;
    const checkRoleAccess = async () => {
      if (!user || !accessItem) {
        setMatrixDecision(null);
        setCheckingMatrix(false);
        return;
      }
      setCheckingMatrix(true);
      try {
        const res = await apiClient.get("/admin-config/my-role-access");
        const names = accessNamesFor(accessItem);
        const accessRecord = (res.data || []).find(
          (record) => names.includes(record.access_item),
        );
        if (isMounted) {
          setMatrixDecision(
            accessRecord ? Boolean(accessRecord.is_allowed) : null,
          );
        }
      } catch {
        if (isMounted) setMatrixDecision(null);
      } finally {
        if (isMounted) setCheckingMatrix(false);
      }
    };
    checkRoleAccess();
    return () => {
      isMounted = false;
    };
  }, [accessItem, user]);

  if (!user) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (checkingMatrix) {
    return null;
  }

  const allowedByRole = allowedRoles.includes(user.role_id);
  const allowedByDefault = Boolean(defaultAllowed[roleLabels[user.role_id]]?.has(accessItem));
  const allowedByMatrix = matrixDecision === true;
  const deniedByMatrix = matrixDecision === false;
  const permissionAllowed = allowedByMatrix || hasPermission(user, requiredPermission);

  if (
    deniedByMatrix ||
    (!allowedByRole && !allowedByDefault && !allowedByMatrix) ||
    !permissionAllowed
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

// Prop validation
RoleRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.number).isRequired,
  accessItem: PropTypes.string,
  requiredPermission: PropTypes.string,
};

RoleRoute.defaultProps = {
  accessItem: "",
  requiredPermission: "",
};
