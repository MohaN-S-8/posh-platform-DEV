import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

const emptyForm = {
  employee_id: "",
  first_name: "",
  last_name: "",
  email: "",
  mobile: "",
  department: "",
  designation: "",
  company_id: "",
};

export function OwnerAdminSetupPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/companies/");
      setCompanies(res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load companies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadCompanies, 0);
    return () => window.clearTimeout(timer);
  }, [loadCompanies]);

  const createAdmin = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/users/", {
        ...form,
        email: form.email.trim().toLowerCase(),
        company_id: Number(form.company_id),
        role_id: 2,
      });
      setForm(emptyForm);
      setSuccess("Admin user created. Temporary password was emailed.");
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to create Admin user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button type="button" onClick={() => navigate("/admin")} style={linkButtonStyle}>
        Back to Admin Portal
      </button>
      <h1 style={{ color: "#17324d", margin: "0 0 6px", fontSize: "30px" }}>
        Company Owner Admin Setup
      </h1>
      <p style={{ color: "#64748b", margin: "0 0 24px" }}>
        Direct-link setup page for Super Admin to create the first Admin user for a company.
        Available at /owner/admin-setup and /super-admin/company-owner-setup.
      </p>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <form onSubmit={createAdmin} style={panelStyle}>
        <div style={gridStyle}>
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
          {[
            ["employee_id", "Employee ID"],
            ["first_name", "First Name"],
            ["last_name", "Last Name"],
            ["email", "Email"],
            ["mobile", "Mobile"],
            ["department", "Department"],
            ["designation", "Designation"],
          ].map(([key, label]) => (
            <label key={key} style={labelStyle}>
              {label}
              <input
                required={["employee_id", "first_name", "last_name", "email", "mobile"].includes(key)}
                type={key === "email" ? "email" : "text"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                style={inputStyle}
              />
            </label>
          ))}
        </div>
        <button type="submit" disabled={saving} style={primaryButtonStyle}>
          {saving ? "Creating..." : "Create Admin User"}
        </button>
      </form>

      <LoadingOverlay
        show={loading || saving}
        title={saving ? "Creating Admin" : "Loading companies"}
        message={saving ? "Saving the Admin user." : "Fetching company list."}
      />
    </div>
  );
}

const panelStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "24px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "18px",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  color: "#17324d",
  fontSize: "13px",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d8e1ea",
  borderRadius: "6px",
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  padding: "10px 18px",
  background: "#17324d",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
};

const linkButtonStyle = {
  background: "none",
  border: "none",
  color: "#17324d",
  cursor: "pointer",
  marginBottom: "16px",
  padding: 0,
  fontWeight: 700,
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
