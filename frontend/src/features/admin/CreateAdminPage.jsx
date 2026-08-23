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
  password: "",
};

const employeeOptionLabel = (employee) => {
  const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  const employeeId = employee.employee_id ? ` (${employee.employee_id})` : "";
  const company = employee.company_id ? ` - Company ${employee.company_id}` : "";
  return `${name || employee.email} - ${employee.email}${employeeId}${company}`;
};

export function CreateAdminPage() {
  const [admins, setAdmins] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/users/");
      const users = res.data || [];
      setAdmins(users.filter((user) => user.role_id === 2));
      setEmployees(users.filter((user) => user.role_id === 4));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load company admins."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadAdmins, 0);
    return () => window.clearTimeout(timer);
  }, [loadAdmins]);

  const createAdmin = async (event) => {
    event.preventDefault();
    if (!editingAdmin && !selectedEmployee) {
      setError("Please select an employee from Employee Master before creating admin access.");
      return;
    }
    const digits = form.contact.replace(/\D/g, "");
    const mobile = digits.length > 10 ? digits.slice(-10) : digits;
    const [firstName, ...restName] = form.name.trim().split(/\s+/);

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        employee_id: form.id_no.trim(),
        first_name: firstName,
        last_name: restName.join(" ") || "Admin",
        email: form.email.trim().toLowerCase(),
        mobile,
        username: form.username.trim(),
        role_id: 2,
        department: "Company Administration",
        designation: "Company Admin",
      };
      if (editingAdmin) {
        await apiClient.put(`/users/${editingAdmin.user_id}`, payload);
        if (form.password) {
          await apiClient.post(`/users/${editingAdmin.user_id}/reset-password`, {
            new_password: form.password,
          });
        }
        setSuccess("Company Admin updated.");
      } else {
        await apiClient.put(`/users/${selectedEmployee.user_id}`, payload);
        if (form.password) {
          await apiClient.post(`/users/${selectedEmployee.user_id}/reset-password`, {
            new_password: form.password,
          });
        }
        setSuccess("Employee upgraded to Company Admin.");
      }
      setForm(emptyForm);
      setEditingAdmin(null);
      setSelectedEmployee(null);
      setEmployeeSearch("");
      await loadAdmins();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create Company Admin."));
    } finally {
      setSubmitting(false);
    }
  };

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
      password: "",
    });
  };

  const startEdit = (admin) => {
    setEditingAdmin(admin);
    setSelectedEmployee(null);
    setEmployeeSearch("");
    setError("");
    setSuccess("");
    setForm({
      name: `${admin.first_name || ""} ${admin.last_name || ""}`.trim(),
      id_no: admin.employee_id || "",
      email: admin.email || "",
      contact: admin.mobile || "",
      username: admin.username || admin.email || "",
      password: "",
    });
  };

  const cancelEdit = () => {
    setEditingAdmin(null);
    setSelectedEmployee(null);
    setEmployeeSearch("");
    setForm(emptyForm);
    setError("");
    setSuccess("");
  };

  const deleteAdmin = async (admin) => {
    const adminName = `${admin.first_name} ${admin.last_name || ""}`.trim();
    if (!window.confirm(`Delete ${adminName || admin.email} from Company Admin logins?`)) {
      return;
    }
    setDeletingId(admin.user_id);
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/users/${admin.user_id}`);
      setSuccess("Company Admin deleted.");
      await loadAdmins();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete Company Admin."));
    } finally {
      setDeletingId("");
    }
  };

  const toggleAdminStatus = async (admin) => {
    const nextStatus = admin.status === "Active" ? "Inactive" : "Active";
    setStatusUpdatingId(admin.user_id);
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(`/users/${admin.user_id}/status?status=${nextStatus}`);
      setSuccess(`Company Admin ${nextStatus === "Active" ? "activated" : "deactivated"}.`);
      await loadAdmins();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update Company Admin status."));
    } finally {
      setStatusUpdatingId("");
    }
  };

  return (
    <PortalShell title="Create Admin" subtitle="Super Admin upgrades Employee Master users to Company Admin">
      {/* <div style={noticeStyle}>
        Only the Super Admin can create a Company Admin login. This mirrors only Master Admin has rights from the master file.
      </div> */}

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <section style={panelStyle}>
        <h3 style={titleStyle}>{editingAdmin ? "Edit Admin" : "Create Admin"}</h3>
        <p style={mutedStyle}>
          {editingAdmin
            ? "Update Company Admin details and optionally set a new password."
            : "Select an existing Employee Master user. Their ID, email, contact, and username are filled automatically before upgrading access."}
        </p>
        <form onSubmit={createAdmin}>
          {!editingAdmin && (
            <label style={{ ...labelStyle, marginBottom: "16px" }}>
              Search Employee *
              <input
                required
                type="text"
                list="company-admin-employee-options"
                value={employeeSearch}
                placeholder="Type employee name, email, employee ID, or user ID"
                onChange={(e) => handleEmployeeSearch(e.target.value)}
                style={inputStyle}
              />
              <datalist id="company-admin-employee-options">
                {employees.map((employee) => (
                  <option key={employee.user_id} value={employeeOptionLabel(employee)} />
                ))}
              </datalist>
              {!loading && employees.length === 0 && (
                <span style={hintStyle}>
                  No Employee Master users are available to upgrade.
                </span>
              )}
              {selectedEmployee && (
                <span style={hintStyle}>
                  Selected employee will be converted to Company Admin.
                </span>
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
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              ID No *
              <input
                required
                value={form.id_no}
                placeholder="e.g. SCS-ADM-002"
                onChange={(e) => setForm({ ...form, id_no: e.target.value.toUpperCase() })}
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
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Contact No *
              <input
                required
                value={form.contact}
                placeholder="+91 ..."
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Username *
              <input
                required
                value={form.username}
                placeholder="e.g. jane.doe"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              {editingAdmin ? "New Password" : "New Password"}
              <input
                type="password"
                value={form.password}
                placeholder={
                  editingAdmin
                    ? "Leave blank to keep current password"
                    : "Optional. Leave blank to keep employee password"
                }
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <div style={actionGroupStyle}>
            <button type="submit" disabled={submitting} style={primaryButtonStyle}>
              {submitting
                ? editingAdmin
                  ? "Saving..."
                  : "Upgrading..."
                : editingAdmin
                  ? "Save Admin"
                  : "Upgrade to Company Admin"}
            </button>
            {editingAdmin && (
              <button type="button" onClick={cancelEdit} style={secondaryButtonStyle}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <div style={sectionTitleStyle}>Admins Created</div>
        <div style={tableWrapStyle}>
          <table style={{ width: "100%", minWidth: "860px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#faf8ff" }}>
                {["Name", "ID No", "Email", "Contact", "Username", "Role", "Status", "Action"].map((heading) => (
                  <th key={heading} style={thStyle}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={emptyStyle}>Loading admins...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={8} style={emptyStyle}>No Company Admin logins created yet.</td></tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.user_id} style={{ borderTop: "1px solid var(--portal-border)" }}>
                    <td style={tdStyle}>{admin.first_name} {admin.last_name || ""}</td>
                    <td style={tdStyle}>{admin.employee_id}</td>
                    <td style={tdStyle}>{admin.email}</td>
                    <td style={tdStyle}>{admin.mobile || "-"}</td>
                    <td style={tdStyle}>{admin.username || admin.email}</td>
                    <td style={tdStyle}><span style={roleBadgeStyle}>Company Admin</span></td>
                    <td style={tdStyle}><span style={statusBadgeStyle(admin.status)}>{admin.status}</span></td>
                    <td style={tdStyle}>
                      <div style={actionGroupStyle}>
                        <button
                          type="button"
                          onClick={() => startEdit(admin)}
                          style={secondaryButtonStyle}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={statusUpdatingId === admin.user_id}
                          onClick={() => toggleAdminStatus(admin)}
                          style={secondaryButtonStyle}
                        >
                          {statusUpdatingId === admin.user_id
                            ? "Updating..."
                            : admin.status === "Active"
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === admin.user_id}
                          onClick={() => deleteAdmin(admin)}
                          style={dangerButtonStyle}
                        >
                          {deletingId === admin.user_id ? "Deleting..." : "Delete"}
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

// const noticeStyle = {
//   background: "#fff1f2",
//   border: "1px solid #fecdd3",
//   borderRadius: "8px",
//   padding: "12px 16px",
//   color: "#9f1239",
//   fontWeight: 800,
//   marginBottom: "18px",
// };

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
