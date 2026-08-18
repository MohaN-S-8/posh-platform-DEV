import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

const roles = [
  "Super Admin",
  "Company Admin",
  "Client Admin (Mgmt)",
  "HR",
  "Employee",
];

const pages = [
  "Home",
  "PoSH Policy",
  "POSH Awareness Training",
  "Assessment & Certificate",
  "POSH Compliance",
  "POSH Complaints",
  "POSH Audit",
  "Analytics & Reports",
  "Create Admin",
  "Masters (State/City/Scope)",
  "Create Company & Work Order",
  "Company Registration - PoSH",
  "Employee Master - PoSH",
  "PoSH Office Master",
  "Role & Access Matrix",
];

const defaultAllowed = {
  "Super Admin": new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "POSH Audit",
    "Analytics & Reports",
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
  ]),
  "Client Admin (Mgmt)": new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "POSH Audit",
    "Analytics & Reports",
    "Employee Master - PoSH",
  ]),
  HR: new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
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

export function RoleAccessMatrixPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAccess = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/admin-config/");
      setRecords(res.data?.role_access || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load role access matrix."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadAccess, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccess]);

  const accessMap = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      map.set(`${record.role_label}::${record.access_item}`, record);
    });
    return map;
  }, [records]);

  const isAllowed = (role, page) => {
    const record = accessMap.get(`${role}::${page}`);
    if (record) return Boolean(record.is_allowed);
    return Boolean(defaultAllowed[role]?.has(page));
  };

  const toggleAccess = async (role, page, nextAllowed, pageIndex) => {
    const key = `${role}::${page}`;
    const existing = accessMap.get(key);
    setSavingKey(key);
    setError("");
    setSuccess("");
    try {
      const payload = {
        role_label: role,
        access_item: page,
        access_status: nextAllowed ? "Access enabled" : "NO Access",
        is_allowed: nextAllowed,
        display_order: pageIndex + 1,
      };
      if (existing) {
        await apiClient.put(`/admin-config/role-access/${existing.id}`, payload);
      } else {
        await apiClient.post("/admin-config/role-access", payload);
      }
      setSuccess("Role access updated.");
      await loadAccess();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update role access."));
    } finally {
      setSavingKey("");
    }
  };

  return (
    <PortalShell title="Role & Access Matrix" subtitle="Control exactly what each role can see.">
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <section style={introStyle}>
        <h3 style={introTitleStyle}>Role & Access Matrix</h3>
        <p style={helperTextStyle}>
          Tick or untick which pages each role can see. This is the same pattern as the POSH Access role table in the master file, extended to every role and every backend page.
        </p>
      </section>

      {loading ? (
        <div style={emptyStyle}>Loading role access matrix...</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={pageThStyle}>Page</th>
                {roles.map((role) => (
                  <th key={role} style={thStyle}>{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((page, pageIndex) => (
                <tr key={page}>
                  <td style={pageTdStyle}>{page}</td>
                  {roles.map((role) => {
                    const key = `${role}::${page}`;
                    return (
                      <td key={key} style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={isAllowed(role, page)}
                          disabled={savingKey === key}
                          onChange={(event) => toggleAccess(role, page, event.target.checked, pageIndex)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}

const introStyle = {
  maxWidth: "1040px",
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "18px",
  marginBottom: "16px",
};

const introTitleStyle = {
  margin: "0 0 10px",
  color: "var(--portal-purple)",
  fontSize: "15px",
};

const helperTextStyle = {
  margin: 0,
  color: "var(--portal-muted)",
  fontSize: "13px",
  lineHeight: 1.5,
};

const tableWrapStyle = {
  maxWidth: "1040px",
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: "920px",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "center",
  padding: "11px 12px",
  background: "#faf8ff",
  color: "var(--portal-muted)",
  fontSize: "11px",
  textTransform: "uppercase",
};

const pageThStyle = {
  ...thStyle,
  textAlign: "left",
};

const tdStyle = {
  textAlign: "center",
  padding: "9px 12px",
  borderTop: "1px solid var(--portal-border)",
};

const pageTdStyle = {
  ...tdStyle,
  textAlign: "left",
  color: "var(--portal-text)",
  fontWeight: 600,
};

const emptyStyle = {
  maxWidth: "1040px",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "22px",
  color: "var(--portal-muted)",
  background: "#faf8ff",
};

const errorStyle = {
  background: "#fdf0f0",
  border: "1px solid #e74c3c",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#c0392b",
  marginBottom: "16px",
};

const successStyle = {
  background: "#f7f3ff",
  border: "1px solid #d8c7ff",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "var(--portal-purple)",
  marginBottom: "16px",
};
