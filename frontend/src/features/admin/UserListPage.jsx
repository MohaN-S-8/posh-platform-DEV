import AddIcon from "@mui/icons-material/Add";
import KeyIcon from "@mui/icons-material/Key";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { useAuthStore } from "../../store/authStore";

const ROLES = { 1: "Super Admin", 2: "Company Admin", 3: "HR", 4: "Employee" };

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cfd7df",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  background: "white",
  color: "#111827",
};

const initialForm = {
  employee_id: "",
  first_name: "",
  last_name: "",
  email: "",
  mobile: "",
  department: "",
  designation: "",
  role_id: 4,
  company_id: "",
};

export function UserListPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [passwordForm, setPasswordForm] = useState({ userId: "", password: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const canCreateSuperAdmin = user?.role_id === 1;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const userReq = apiClient.get("/users/");
      const companyReq =
        user?.role_id === 1 ? apiClient.get("/companies/") : Promise.resolve({ data: [] });
      const [userRes, companyRes] = await Promise.all([userReq, companyReq]);
      setUsers(userRes.data || []);
      setCompanies(companyRes.data || []);
      setForm((current) => ({
        ...current,
        company_id: user?.role_id === 2 ? user.company_id : current.company_id,
      }));
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const roleOptions = useMemo(
    () =>
      Object.entries(ROLES)
        .map(([value, label]) => ({ value: Number(value), label }))
        .filter((role) => canCreateSuperAdmin || role.value !== 1),
    [canCreateSuperAdmin],
  );

  const filtered = users.filter((u) =>
    `${u.employee_id} ${u.first_name} ${u.last_name || ""} ${u.email} ${u.department || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  const submitCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        email: form.email.trim().toLowerCase(),
        role_id: Number(form.role_id),
        company_id: Number(user?.role_id === 2 ? user.company_id : form.company_id),
      };
      await apiClient.post("/users/", payload);
      setSuccess("User created successfully. Temporary password was emailed.");
      setForm({
        ...initialForm,
        role_id: 4,
        company_id: user?.role_id === 2 ? user.company_id : "",
      });
      setShowCreate(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create user.");
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post(`/users/${passwordForm.userId}/reset-password`, {
        new_password: passwordForm.password,
      });
      setSuccess("Password changed successfully.");
      setPasswordForm({ userId: "", password: "" });
      setShowPassword(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (target) => {
    const newStatus = target.status === "Active" ? "Inactive" : "Active";
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(`/users/${target.user_id}/status?status=${newStatus}`);
      setSuccess(`User ${newStatus.toLowerCase()} successfully.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update user status.");
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            style={{
              background: "none",
              border: "none",
              color: "#17324d",
              cursor: "pointer",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            Back to Dashboard
          </button>
          <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
            User Management
          </h1>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            placeholder="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "220px" }}
          />
          <button
            type="button"
            onClick={() => setShowCreate((current) => !current)}
            style={primaryButtonStyle}
          >
            <AddIcon fontSize="small" />
            New User
          </button>
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      {showCreate && (
        <form onSubmit={submitCreate} style={panelStyle}>
          <h2 style={panelTitleStyle}>Create User</h2>
          <div style={formGridStyle}>
            {[
              ["employee_id", "Employee ID"],
              ["first_name", "First Name"],
              ["last_name", "Last Name"],
              ["email", "Email"],
              ["mobile", "Mobile"],
              ["department", "Department"],
              ["designation", "Designation"],
            ].map(([field, label]) => (
              <label key={field} style={labelStyle}>
                {label}
                <input
                  required={["employee_id", "first_name", "last_name", "email", "mobile"].includes(field)}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  style={inputStyle}
                />
              </label>
            ))}
            <label style={labelStyle}>
              Role
              <select
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                style={inputStyle}
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            {user?.role_id === 1 && (
              <label style={labelStyle}>
                Company
                <select
                  required
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select company</option>
                  {companies.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button type="submit" disabled={saving} style={primaryButtonStyle}>
            {saving ? "Creating..." : "Create User"}
          </button>
        </form>
      )}

      {showPassword && (
        <form onSubmit={submitPassword} style={panelStyle}>
          <h2 style={panelTitleStyle}>Change User Password</h2>
          <div style={formGridStyle}>
            <label style={labelStyle}>
              User
              <select
                required
                value={passwordForm.userId}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, userId: e.target.value })
                }
                style={inputStyle}
              >
                <option value="">Select user</option>
                {users.map((target) => (
                  <option key={target.user_id} value={target.user_id}>
                    {target.first_name} {target.last_name || ""} - {target.email}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              New Password
              <input
                required
                type="password"
                minLength={8}
                maxLength={15}
                value={passwordForm.password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, password: e.target.value })
                }
                style={inputStyle}
              />
            </label>
          </div>
          <button type="submit" disabled={saving} style={primaryButtonStyle}>
            {saving ? "Changing..." : "Change Password"}
          </button>
        </form>
      )}

      <div style={tableWrapStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
          <thead>
            <tr style={{ background: "#17324d", color: "white" }}>
              {["Employee ID", "Name", "Email", "Department", "Role", "Status", "Actions"].map(
                (h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", color: "#64748b" }}>
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((target) => (
                <tr key={target.user_id} style={{ borderBottom: "1px solid #eef2f6" }}>
                  <td style={tdStyle}>{target.employee_id}</td>
                  <td style={{ ...tdStyle, color: "#17324d", fontWeight: 700 }}>
                    {target.first_name} {target.last_name || ""}
                  </td>
                  <td style={tdStyle}>{target.email}</td>
                  <td style={tdStyle}>{target.department || "-"}</td>
                  <td style={tdStyle}>{ROLES[target.role_id] || "Unknown"}</td>
                  <td style={tdStyle}>{target.status}</td>
                  <td style={{ ...tdStyle, display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => toggleStatus(target)}
                      style={secondaryButtonStyle}
                    >
                      {target.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordForm({ userId: String(target.user_id), password: "" });
                        setShowPassword(true);
                      }}
                      style={secondaryButtonStyle}
                    >
                      <KeyIcon fontSize="small" />
                      Password
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadingOverlay
        show={loading || saving}
        title={saving ? "Saving user" : "Loading users"}
        message={saving ? "Applying user management changes." : "Fetching user list."}
      />
    </div>
  );
}

const panelStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  marginBottom: "20px",
};

const panelTitleStyle = {
  color: "#17324d",
  margin: "0 0 16px",
  fontSize: "20px",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
  marginBottom: "16px",
};

const labelStyle = {
  color: "#17324d",
  fontWeight: 700,
  fontSize: "13px",
  display: "grid",
  gap: "6px",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  background: "#17324d",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const secondaryButtonStyle = {
  padding: "7px 10px",
  background: "#f0f4ff",
  color: "#17324d",
  border: "1px solid #cdd9e2",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
};

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};

const successStyle = {
  background: "#e8f5ee",
  border: "1px solid #1f7a4d",
  borderRadius: "8px",
  color: "#1f7a4d",
  padding: "12px 14px",
  marginBottom: "18px",
};

const tableWrapStyle = {
  background: "white",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  overflowX: "auto",
};

const thStyle = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: "13px",
};

const tdStyle = {
  padding: "12px 14px",
  color: "#64748b",
  fontSize: "13px",
};
