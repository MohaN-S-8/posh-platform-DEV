import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";

const emptyForm = {
  company_code: "",
  company_name: "",
  industry_type: "",
  website: "",
  registration_number: "",
  gst_number: "",
  employee_strength: "",
  address: "",
  contact_person: "",
  contact_email: "",
  contact_mobile: "",
};

const fields = [
  { label: "Company Code", key: "company_code", required: true, createOnly: true },
  { label: "Company Name", key: "company_name", required: true },
  { label: "Industry Type", key: "industry_type" },
  {
    label: "Website",
    key: "website",
    type: "url",
    placeholder: "https://example.com",
  },
  { label: "Registration Number", key: "registration_number" },
  { label: "GST Number", key: "gst_number" },
  { label: "Employee Strength", key: "employee_strength", type: "number", min: 1 },
  { label: "Contact Person", key: "contact_person" },
  { label: "Contact Email", key: "contact_email", type: "email" },
  { label: "Contact Mobile", key: "contact_mobile", pattern: "\\d{10}", maxLength: 10 },
];

export function CompanyListPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [languageRows, setLanguageRows] = useState([]);
  const [defaultLanguageId, setDefaultLanguageId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/companies/");
      setCompanies(res.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load companies."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(fetchCompanies, 0);
    return () => window.clearTimeout(loadTimer);
  }, [fetchCompanies]);

  const normalizePayload = () => ({
    ...form,
    employee_strength: form.employee_strength ? Number(form.employee_strength) : null,
  });

  const openCreate = () => {
    setEditingCompany(null);
    setLanguageRows([]);
    setDefaultLanguageId("");
    setForm(emptyForm);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const openEdit = async (company) => {
    setEditingCompany(company);
    setForm({
      ...emptyForm,
      ...company,
      employee_strength: company.employee_strength || "",
    });
    setShowForm(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.get(`/companies/${company.company_id}/languages`);
      setLanguageRows(res.data || []);
      const currentDefault = res.data?.find((row) => row.is_default);
      setDefaultLanguageId(String(currentDefault?.language_id || ""));
    } catch {
      setLanguageRows([]);
      setDefaultLanguageId("");
    }
  };

  const saveCompany = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      if (editingCompany) {
        const payload = normalizePayload();
        delete payload.company_code;
        await apiClient.put(`/companies/${editingCompany.company_id}`, payload);
        setSuccess("Company details updated.");
      } else {
        await apiClient.post("/companies/", normalizePayload());
        setSuccess("Company created.");
      }
      setShowForm(false);
      setEditingCompany(null);
      setForm(emptyForm);
      await fetchCompanies();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save company."));
    } finally {
      setSubmitting(false);
    }
  };

  const saveLanguages = async () => {
    if (!editingCompany) return;
    const languageIds = languageRows
      .filter((row) => row.enabled)
      .map((row) => row.language_id);
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.put(`/companies/${editingCompany.company_id}/languages`, {
        language_ids: languageIds,
        default_language_id: defaultLanguageId ? Number(defaultLanguageId) : null,
      });
      setLanguageRows(res.data || []);
      setSuccess("Language preferences updated.");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update language preferences."));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (company) => {
    const newStatus = company.status === "Active" ? "Inactive" : "Active";
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(`/companies/${company.company_id}/status?status=${newStatus}`);
      setSuccess(`Company ${newStatus.toLowerCase()}.`);
      await fetchCompanies();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update status."));
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f5f7fa", minHeight: "100vh" }}>
      <div style={headerStyle}>
        <div>
          <button type="button" onClick={() => navigate("/admin")} style={linkButtonStyle}>
            Back to Dashboard
          </button>
          <h1 style={{ color: "#1a3c5e", margin: 0 }}>Company Management</h1>
        </div>
        <button type="button" onClick={openCreate} style={primaryButtonStyle}>
          Add Company
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      {showForm && (
        <div style={panelStyle}>
          <h3 style={{ color: "#1a3c5e", marginTop: 0 }}>
            {editingCompany ? "Edit Company" : "Create New Company"}
          </h3>
          <form onSubmit={saveCompany}>
            <div style={formGridStyle}>
              {fields
                .filter((field) => !editingCompany || !field.createOnly)
                .map(
                  ({
                    label,
                    key,
                    type = "text",
                    required,
                    pattern,
                    maxLength,
                    min,
                    placeholder,
                  }) => (
                  <label key={key} style={labelStyle}>
                    {label}
                    <input
                      type={type}
                      required={required}
                      pattern={pattern}
                      maxLength={maxLength}
                      min={min}
                      placeholder={placeholder}
                      value={form[key] || ""}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  ),
                )}
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                Address
                <textarea
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button type="submit" disabled={submitting} style={primaryButtonStyle}>
                {submitting ? "Saving..." : editingCompany ? "Save Changes" : "Create Company"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={secondaryButtonStyle}>
                Cancel
              </button>
            </div>
          </form>

          {editingCompany && (
            <div style={{ ...panelInsetStyle, marginTop: "20px" }}>
              <h4 style={{ margin: "0 0 12px", color: "#1a3c5e" }}>
                Language Preferences
              </h4>
              <div style={languageGridStyle}>
                {languageRows.map((language) => (
                  <label key={language.language_id} style={checkboxStyle}>
                    <input
                      type="checkbox"
                      checked={language.enabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setLanguageRows((current) =>
                          current.map((row) =>
                            row.language_id === language.language_id
                              ? { ...row, enabled }
                              : row,
                          ),
                        );
                        if (enabled && !defaultLanguageId) {
                          setDefaultLanguageId(String(language.language_id));
                        }
                      }}
                    />
                    {language.language_name}
                    <input
                      type="radio"
                      name="default_language"
                      disabled={!language.enabled}
                      checked={String(language.language_id) === defaultLanguageId}
                      onChange={() => setDefaultLanguageId(String(language.language_id))}
                    />
                    Default
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={saveLanguages}
                disabled={submitting}
                style={{ ...primaryButtonStyle, marginTop: "14px" }}
              >
                Save Languages
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#666" }}>Loading companies...</p>
      ) : (
        <div style={tableWrapStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
            <thead>
              <tr style={{ background: "#1a3c5e", color: "white" }}>
                {["Code", "Name", "Industry", "Contact", "GST", "Employees", "Status", "Actions"].map(
                  (heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                    No companies found. Create one above.
                  </td>
                </tr>
              ) : (
                companies.map((company, index) => (
                  <tr
                    key={company.company_id}
                    style={{
                      background: index % 2 === 0 ? "white" : "#f9f9f9",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <td style={strongCellStyle}>{company.company_code}</td>
                    <td style={tdStyle}>{company.company_name}</td>
                    <td style={tdStyle}>{company.industry_type || "-"}</td>
                    <td style={tdStyle}>
                      {company.contact_person || "-"}
                      <br />
                      <span style={{ color: "#64748b" }}>{company.contact_email || "-"}</span>
                    </td>
                    <td style={tdStyle}>{company.gst_number || "-"}</td>
                    <td style={tdStyle}>{company.employee_strength || "-"}</td>
                    <td style={tdStyle}>
                      <span style={statusStyle(company.status)}>{company.status}</span>
                    </td>
                    <td style={{ ...tdStyle, display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => openEdit(company)}
                        style={secondaryButtonStyle}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(company)}
                        style={secondaryButtonStyle}
                      >
                        {company.status === "Active" ? "Deactivate" : "Activate"}
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

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "24px",
};

const panelStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "24px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: "24px",
};

const panelInsetStyle = {
  border: "1px solid #d8e1ea",
  borderRadius: "8px",
  padding: "16px",
  background: "#f8fafc",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const languageGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "10px",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  color: "#17324d",
  fontWeight: 700,
  fontSize: "13px",
};

const checkboxStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  color: "#17324d",
  fontSize: "13px",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #d8e1ea",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  padding: "10px 18px",
  background: "#1a3c5e",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle = {
  padding: "8px 12px",
  background: "#eef4f8",
  color: "#17324d",
  border: "1px solid #cdd9e2",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
};

const linkButtonStyle = {
  background: "none",
  border: "none",
  color: "#1a3c5e",
  cursor: "pointer",
  marginBottom: "8px",
  padding: 0,
  fontWeight: 700,
};

const tableWrapStyle = {
  background: "white",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  overflowX: "auto",
};

const thStyle = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "13px",
};

const tdStyle = {
  padding: "12px 16px",
  fontSize: "14px",
  color: "#334155",
};

const strongCellStyle = {
  ...tdStyle,
  fontWeight: 700,
  color: "#1a3c5e",
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
  background: "#e8f5ee",
  border: "1px solid #1f7a4d",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#1f7a4d",
  marginBottom: "16px",
};

const statusStyle = (status) => ({
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  background: status === "Active" ? "#e8f5e9" : "#fdf0f0",
  color: status === "Active" ? "#1f7a4d" : "#c0392b",
});
