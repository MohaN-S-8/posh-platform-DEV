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

const providerCompanyId = 1;

export function CreateAdminPage() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(emptyForm);
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
      setAdmins((res.data || []).filter((user) => user.role_id === 2));
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
    const digits = form.contact.replace(/\D/g, "");
    const mobile = digits.length > 10 ? digits.slice(-10) : digits;
    const [firstName, ...restName] = form.name.trim().split(/\s+/);

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/users/", {
        company_id: providerCompanyId,
        employee_id: form.id_no.trim(),
        first_name: firstName,
        last_name: restName.join(" ") || "Admin",
        email: form.email.trim().toLowerCase(),
        mobile,
        username: form.username.trim(),
        password: form.password || null,
        role_id: 2,
        department: "Company Administration",
        designation: "Company Admin",
      });
      setSuccess("Company Admin created. Login credentials email has been sent.");
      setForm(emptyForm);
      await loadAdmins();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create Company Admin."));
    } finally {
      setSubmitting(false);
    }
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
    <PortalShell title="Create Admin" subtitle="Super Admin creates Company Admin logins">
      {/* <div style={noticeStyle}>
        Only the Super Admin can create a Company Admin login. This mirrors only Master Admin has rights from the master file.
      </div> */}

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <section style={panelStyle}>
        <h3 style={titleStyle}>Create Admin</h3>
        <p style={mutedStyle}>
          Creates a Company Admin login. An automatic email is sent to the member with their credentials.
        </p>
        <form onSubmit={createAdmin}>
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
              Username (create) *
              <input
                required
                value={form.username}
                placeholder="e.g. jane.doe"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Password (create) *
              <input
                type="password"
                value={form.password}
                placeholder="Leave blank to auto-generate"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <button type="submit" disabled={submitting} style={primaryButtonStyle}>
            {submitting ? "Creating..." : "Create Company Admin"}
          </button>
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
                    <td style={tdStyle}>{admin.username || admin.email}</td>
                    <td style={tdStyle}>{admin.mobile || "-"}</td>
                    <td style={tdStyle}>{admin.email}</td>
                    <td style={tdStyle}><span style={roleBadgeStyle}>Company Admin</span></td>
                    <td style={tdStyle}><span style={statusBadgeStyle(admin.status)}>{admin.status}</span></td>
                    <td style={tdStyle}>
                      <div style={actionGroupStyle}>
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
