import { useCallback, useEffect, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

const emptyForm = {
  name: "",
  id_no: "",
  email: "",
  contact: "",
  username: "",
  ic_role: "Internal Committee Member",
  password: "",
};

const employeeOptionLabel = (employee) => {
  const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  const employeeId = employee.employee_id ? ` (${employee.employee_id})` : "";
  const company = employee.company_id ? ` - Company ${employee.company_id}` : "";
  return `${name || employee.email} - ${employee.email}${employeeId}${company}`;
};

export function CreateIcPage() {
  const [icUsers, setIcUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingIc, setEditingIc] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadIcUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/users/");
      const users = res.data || [];
      setIcUsers(users.filter((item) => item.role_id === 3));
      setEmployees(users.filter((item) => item.role_id === 4));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load IC users."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadIcUsers, 0);
    return () => window.clearTimeout(timer);
  }, [loadIcUsers]);

  const handleEmployeeSearch = (value) => {
    setEmployeeSearch(value);
    setError("");
    const normalized = value.trim().toLowerCase();
    const match = employees.find((employee) => {
      const label = employeeOptionLabel(employee).toLowerCase();
      return (
        label === normalized ||
        String(employee.user_id) === value ||
        String(employee.email || "").toLowerCase() === normalized ||
        String(employee.employee_id || "").toLowerCase() === normalized
      );
    });
    if (!match) {
      setSelectedEmployee(null);
      setForm(emptyForm);
      return;
    }
    setSelectedEmployee(match);
    setForm({
      name: `${match.first_name || ""} ${match.last_name || ""}`.trim(),
      id_no: match.employee_id || "",
      email: match.email || "",
      contact: match.mobile || "",
      username: match.username || match.email || "",
      ic_role: "Internal Committee Member",
      password: "",
    });
  };

  const submitIc = async (event) => {
    event.preventDefault();
    if (!editingIc && !selectedEmployee) {
      setError("Please select an employee from User Master before creating IC access.");
      return;
    }

    const digits = form.contact.replace(/\D/g, "");
    const mobile = digits.length > 10 ? digits.slice(-10) : digits;
    const [firstName, ...restName] = form.name.trim().split(/\s+/);

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (editingIc) {
        await apiClient.put(`/users/${editingIc.user_id}`, {
          employee_id: form.id_no.trim(),
          first_name: firstName,
          last_name: restName.join(" ") || "IC",
          email: form.email.trim().toLowerCase(),
          mobile,
          username: form.username.trim(),
          role_id: 3,
          ic_role: form.ic_role.trim() || "Internal Committee Member",
          department: editingIc.department || "Internal Committee",
          designation: editingIc.designation || "IC Member",
        });
        if (form.password) {
          await apiClient.post(`/users/${editingIc.user_id}/reset-password`, {
            new_password: form.password,
          });
        }
        setSuccess("IC user updated.");
      } else {
        await apiClient.post(`/users/${selectedEmployee.user_id}/upgrade-to-ic`, {
          ic_role: form.ic_role.trim() || "Internal Committee Member",
        });
        if (form.password) {
          await apiClient.post(`/users/${selectedEmployee.user_id}/reset-password`, {
            new_password: form.password,
          });
        }
        setSuccess("Employee upgraded to IC.");
      }
      setForm(emptyForm);
      setEditingIc(null);
      setSelectedEmployee(null);
      setEmployeeSearch("");
      await loadIcUsers();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save IC user."));
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (icUser) => {
    setEditingIc(icUser);
    setSelectedEmployee(null);
    setEmployeeSearch("");
    setError("");
    setSuccess("");
    setForm({
      name: `${icUser.first_name || ""} ${icUser.last_name || ""}`.trim(),
      id_no: icUser.employee_id || "",
      email: icUser.email || "",
      contact: icUser.mobile || "",
      username: icUser.username || icUser.email || "",
      ic_role: icUser.ic_role || "Internal Committee Member",
      password: "",
    });
  };

  const cancelEdit = () => {
    setEditingIc(null);
    setSelectedEmployee(null);
    setEmployeeSearch("");
    setForm(emptyForm);
    setError("");
    setSuccess("");
  };

  const deleteIc = async (icUser) => {
    const name = `${icUser.first_name || ""} ${icUser.last_name || ""}`.trim();
    if (!window.confirm(`Delete ${name || icUser.email} from IC users?`)) return;
    setDeletingId(icUser.user_id);
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/users/${icUser.user_id}`);
      setSuccess("IC user deleted.");
      await loadIcUsers();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete IC user."));
    } finally {
      setDeletingId("");
    }
  };

  const toggleIcStatus = async (icUser) => {
    const nextStatus = icUser.status === "Active" ? "Inactive" : "Active";
    setStatusUpdatingId(icUser.user_id);
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(`/users/${icUser.user_id}/status?status=${nextStatus}`);
      setSuccess(`IC user ${nextStatus === "Active" ? "activated" : "deactivated"}.`);
      await loadIcUsers();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update IC status."));
    } finally {
      setStatusUpdatingId("");
    }
  };

  return (
    <PortalShell title="Create IC" subtitle="Upgrade User Master employees to IC users">
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <section style={panelStyle}>
        <h3 style={titleStyle}>{editingIc ? "Edit IC User" : "Create IC User"}</h3>
        <p style={mutedStyle}>
          {editingIc
            ? "Update IC user details and optionally set a new password."
            : "Select an existing Employee from User Master. Their ID, email, contact, and username are filled automatically before upgrading access."}
        </p>
        <form onSubmit={submitIc}>
          {!editingIc && (
            <label style={{ ...labelStyle, marginBottom: "16px" }}>
              Search Employee *
              <input
                required
                type="text"
                list="ic-employee-options"
                value={employeeSearch}
                placeholder="Type user name, email, employee ID, or user ID"
                onChange={(event) => handleEmployeeSearch(event.target.value)}
                style={inputStyle}
              />
              <datalist id="ic-employee-options">
                {employees.map((employee) => (
                  <option key={employee.user_id} value={employeeOptionLabel(employee)} />
                ))}
              </datalist>
              {!loading && employees.length === 0 && (
                <span style={hintStyle}>No Employee users are available to upgrade.</span>
              )}
              {selectedEmployee && (
                <span style={hintStyle}>Selected employee will be converted to IC.</span>
              )}
            </label>
          )}
          <div style={formGridStyle}>
            <label style={labelStyle}>
              Name *
              <input
                required
                value={form.name}
                placeholder="Full name"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              ID No *
              <input
                required
                value={form.id_no}
                placeholder="e.g. IC-001"
                onChange={(event) => setForm({ ...form, id_no: event.target.value.toUpperCase() })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Email ID *
              <input
                required
                type="email"
                value={form.email}
                placeholder="name@example.com"
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Contact No *
              <input
                required
                value={form.contact}
                placeholder="10 digit mobile"
                onChange={(event) => setForm({ ...form, contact: event.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Username *
              <input
                required
                value={form.username}
                placeholder="e.g. jane.doe"
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              IC Responsibility *
              <input
                required
                value={form.ic_role}
                placeholder="Internal Committee Member"
                onChange={(event) => setForm({ ...form, ic_role: event.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              New Password
              <input
                type="password"
                value={form.password}
                placeholder={
                  editingIc
                    ? "Leave blank to keep current password"
                    : "Optional. Leave blank to keep employee password"
                }
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <div style={actionGroupStyle}>
            <button type="submit" disabled={submitting} style={primaryButtonStyle}>
              {submitting
                ? editingIc
                  ? "Saving..."
                  : "Upgrading..."
                : editingIc
                  ? "Save IC User"
                  : "Upgrade to IC"}
            </button>
            {editingIc && (
              <button type="button" onClick={cancelEdit} style={secondaryButtonStyle}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <div style={sectionTitleStyle}>IC Users Created</div>
        <div style={tableWrapStyle}>
          <table style={{ width: "100%", minWidth: "860px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#faf8ff" }}>
                {["Name", "ID No", "Email", "Contact", "Username", "IC Responsibility", "Status", "Action"].map((heading) => (
                  <th key={heading} style={thStyle}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={emptyStyle}>Loading IC users...</td></tr>
              ) : icUsers.length === 0 ? (
                <tr><td colSpan={8} style={emptyStyle}>No IC users created yet.</td></tr>
              ) : (
                icUsers.map((icUser) => (
                  <tr key={icUser.user_id} style={{ borderTop: "1px solid var(--portal-border)" }}>
                    <td style={tdStyle}>{icUser.first_name} {icUser.last_name || ""}</td>
                    <td style={tdStyle}>{icUser.employee_id}</td>
                    <td style={tdStyle}>{icUser.email}</td>
                    <td style={tdStyle}>{icUser.mobile || "-"}</td>
                    <td style={tdStyle}>{icUser.username || icUser.email}</td>
                    <td style={tdStyle}><span style={roleBadgeStyle}>{icUser.ic_role || "IC"}</span></td>
                    <td style={tdStyle}><span style={statusBadgeStyle(icUser.status)}>{icUser.status}</span></td>
                    <td style={tdStyle}>
                      <div style={actionGroupStyle}>
                        <button type="button" onClick={() => startEdit(icUser)} style={secondaryButtonStyle}>
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={statusUpdatingId === icUser.user_id}
                          onClick={() => toggleIcStatus(icUser)}
                          style={secondaryButtonStyle}
                        >
                          {statusUpdatingId === icUser.user_id
                            ? "Updating..."
                            : icUser.status === "Active"
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === icUser.user_id}
                          onClick={() => deleteIc(icUser)}
                          style={dangerButtonStyle}
                        >
                          {deletingId === icUser.user_id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalShell>
  );
}

const panelStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(74,46,131,0.08)",
  marginBottom: "24px",
};

const titleStyle = {
  margin: "0 0 8px",
  color: "var(--portal-purple)",
};

const mutedStyle = {
  margin: "0 0 16px",
  color: "var(--portal-muted)",
  fontSize: "14px",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
  marginBottom: "14px",
};

const labelStyle = {
  display: "grid",
  gap: "7px",
  color: "var(--portal-text)",
  fontSize: "13px",
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "var(--portal-text)",
  background: "white",
};

const hintStyle = {
  color: "var(--portal-muted)",
  fontSize: "12px",
  fontWeight: 600,
};

const primaryButtonStyle = {
  background: "var(--portal-purple)",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  background: "#f7f3ff",
  color: "var(--portal-purple)",
  border: "1px solid #d8c7ff",
  borderRadius: "8px",
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButtonStyle = {
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  borderRadius: "8px",
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const actionGroupStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  color: "var(--portal-purple)",
  fontSize: "13px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const tableWrapStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  overflowX: "auto",
};

const thStyle = {
  padding: "12px",
  textAlign: "left",
  color: "var(--portal-muted)",
  fontSize: "12px",
  textTransform: "uppercase",
};

const tdStyle = {
  padding: "12px",
  color: "var(--portal-text)",
  fontSize: "14px",
};

const emptyStyle = {
  padding: "28px",
  textAlign: "center",
  color: "var(--portal-muted)",
};

const roleBadgeStyle = {
  background: "#f3e8ff",
  color: "var(--portal-purple)",
  borderRadius: "999px",
  padding: "4px 10px",
  fontWeight: 800,
  fontSize: "12px",
};

const statusBadgeStyle = (status) => ({
  background: status === "Active" ? "#dcfce7" : "#ffedd5",
  color: status === "Active" ? "#166534" : "#9a3412",
  borderRadius: "999px",
  padding: "4px 10px",
  fontWeight: 800,
  fontSize: "12px",
});

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
