import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";

export function CompanyListPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    company_code: "",
    company_name: "",
    industry_type: "",
    contact_email: "",
    contact_mobile: "",
    employee_strength: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/companies/");
      setCompanies(res.data);
    } catch {
      setError("Failed to load companies.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/companies/", {
        ...form,
        employee_strength: form.employee_strength
          ? parseInt(form.employee_strength)
          : null,
      });
      setShowForm(false);
      setForm({
        company_code: "",
        company_name: "",
        industry_type: "",
        contact_email: "",
        contact_mobile: "",
        employee_strength: "",
      });
      fetchCompanies();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create company.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (company) => {
    const newStatus = company.status === "Active" ? "Inactive" : "Active";
    try {
      await apiClient.patch(
        `/companies/${company.company_id}/status?status=${newStatus}`,
      );
      fetchCompanies();
    } catch {
      setError("Failed to update status.");
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f5f7fa", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <button
            onClick={() => navigate("/admin")}
            style={{
              background: "none",
              border: "none",
              color: "#1a3c5e",
              cursor: "pointer",
              marginBottom: "8px",
            }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ color: "#1a3c5e", margin: 0 }}>Company Management</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 20px",
            background: "#1a3c5e",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Add Company
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#fdf0f0",
            border: "1px solid #e74c3c",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#e74c3c",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {showForm && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ color: "#1a3c5e", marginTop: 0 }}>Create New Company</h3>
          <form onSubmit={handleCreate}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              {[
                {
                  label: "Company Code *",
                  key: "company_code",
                  required: true,
                },
                {
                  label: "Company Name *",
                  key: "company_name",
                  required: true,
                },
                { label: "Industry Type", key: "industry_type" },
                { label: "Contact Email", key: "contact_email", type: "email" },
                { label: "Contact Mobile", key: "contact_mobile" },
                {
                  label: "Employee Strength",
                  key: "employee_strength",
                  type: "number",
                },
              ].map(({ label, key, type = "text", required }) => (
                <div key={key}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontWeight: 500,
                      fontSize: "14px",
                    }}
                  >
                    {label}
                  </label>
                  <input
                    type={type}
                    required={required}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "10px 24px",
                  background: "#1a3c5e",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {submitting ? "Creating..." : "Create Company"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: "10px 24px",
                  background: "#f5f5f5",
                  color: "#333",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#666" }}>Loading companies...</p>
      ) : (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#1a3c5e", color: "white" }}>
                {[
                  "Code",
                  "Name",
                  "Industry",
                  "Contact Email",
                  "Employees",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "13px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#999",
                    }}
                  >
                    No companies found. Create one above.
                  </td>
                </tr>
              ) : (
                companies.map((c, i) => (
                  <tr
                    key={c.company_id}
                    style={{
                      background: i % 2 === 0 ? "white" : "#f9f9f9",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#1a3c5e",
                      }}
                    >
                      {c.company_code}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "14px" }}>
                      {c.company_name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "14px",
                        color: "#666",
                      }}
                    >
                      {c.industry_type || "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "14px",
                        color: "#666",
                      }}
                    >
                      {c.contact_email || "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: "14px",
                        color: "#666",
                      }}
                    >
                      {c.employee_strength || "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background:
                            c.status === "Active" ? "#e8f5e9" : "#fdf0f0",
                          color: c.status === "Active" ? "#27ae60" : "#e74c3c",
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => toggleStatus(c)}
                        style={{
                          padding: "4px 12px",
                          fontSize: "12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          border: "none",
                          fontWeight: 600,
                          background:
                            c.status === "Active" ? "#fdf0f0" : "#e8f5e9",
                          color: c.status === "Active" ? "#e74c3c" : "#27ae60",
                        }}
                      >
                        {c.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
