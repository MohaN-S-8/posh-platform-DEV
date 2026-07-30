import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

const emptyForm = {
  company_id: "",
  employee_id: "",
  first_name: "",
  last_name: "",
  email: "",
  mobile: "",
  date_of_birth: "",
  father_name: "",
  emergency_contact: "",
  gender: "",
  blood_group: "",
  physically_challenged: "",
  marital_status: "",
  pan_number: "",
  foreign_national: "",
  joining_date: "",
  designation: "",
  department: "",
  location_city: "",
  employment_status: "",
  employee_status: "",
  resignation_date: "",
  resignation_reason: "",
  reporting_to: "",
  branch_name: "",
  branch_id: "",
  transfer_date: "",
  transfer_location: "",
  transfer_branch_name: "",
  transfer_branch_id: "",
  ic_role: "",
};

const personalFields = [
  ["employee_id", "Employee ID", "text", true],
  ["first_name", "Emp Name - First", "text", true],
  ["last_name", "Emp Name - Last"],
  ["date_of_birth", "DOB", "date"],
  ["father_name", "Father Name"],
  ["mobile", "Contact No", "text", true],
  ["emergency_contact", "Emergency Contact"],
  ["email", "Email", "email", true],
  ["gender", "Gender"],
  ["blood_group", "Blood Group"],
  ["physically_challenged", "Physically Challenged"],
  ["marital_status", "Marital Status"],
  ["pan_number", "PAN No"],
  ["foreign_national", "Foreign National"],
];

const employmentFields = [
  ["joining_date", "Date of Joining", "date"],
  ["designation", "Designation"],
  ["department", "Department"],
  ["location_city", "Location / City"],
  ["employment_status", "Employment Status"],
  ["employee_status", "Status of Employee"],
  ["resignation_date", "Date of Resignation", "date"],
  ["resignation_reason", "Reason for Resignation"],
  ["reporting_to", "Reporting To"],
  ["branch_name", "Branch Name"],
  ["branch_id", "Branch ID"],
];

const transferFields = [
  ["transfer_date", "Transfer Date", "date"],
  ["transfer_location", "Transfer Location"],
  ["transfer_branch_name", "Transfer Branch Name"],
  ["transfer_branch_id", "Transfer Branch ID"],
  ["ic_role", "IC Role"],
];

const cleanPayload = (payload) =>
  Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value]),
  );

const formPayload = (form) =>
  Object.fromEntries(Object.keys(emptyForm).map((key) => [key, form[key] ?? ""]));

export function EmployeeMasterPage() {
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.company_id) === String(form.company_id)),
    [companies, form.company_id],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [companyRes, employeeRes] = await Promise.all([
        apiClient.get("/companies/registration-candidates/"),
        apiClient.get("/companies/employee-master/"),
      ]);
      setCompanies((companyRes.data || []).filter((company) => Number(company.company_id) !== 1));
      setEmployees(employeeRes.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load employee master."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startEdit = (employee) => {
    setEditingId(employee.id);
    setError("");
    setSuccess("");
    setForm(formPayload({
      ...emptyForm,
      ...employee,
      company_id: String(employee.company_id),
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(emptyForm);
    setError("");
    setSuccess("");
  };

  const saveEmployee = async (event) => {
    event.preventDefault();
    if (!form.company_id) {
      setError("Select a company first.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = cleanPayload({
        ...form,
        company_id: Number(form.company_id),
      });
      if (editingId) {
        await apiClient.put(`/companies/employee-master/${editingId}`, payload);
      } else {
        await apiClient.post("/companies/employee-master/", payload);
      }
      setSuccess(editingId ? "Employee master record updated." : "Employee master record created.");
      setForm({ ...emptyForm, company_id: form.company_id });
      setEditingId("");
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create employee master record."));
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (employee) => {
    const name = `${employee.first_name} ${employee.last_name || ""}`.trim();
    if (!window.confirm(`Delete ${name || employee.employee_id} from Employee Master?`)) {
      return;
    }
    setDeletingId(employee.id);
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/companies/employee-master/${employee.id}`);
      setSuccess("Employee master record deleted.");
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete employee master record."));
    } finally {
      setDeletingId("");
    }
  };

  const toggleEmployeeStatus = async (employee) => {
    const nextStatus = employee.status === "Active" ? "Inactive" : "Active";
    setStatusUpdatingId(employee.id);
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(`/companies/employee-master/${employee.id}/status?status=${nextStatus}`);
      setSuccess(`Employee master record ${nextStatus === "Active" ? "activated" : "deactivated"}.`);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update employee master status."));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const filteredEmployees = employees.filter((employee) =>
    `${employee.employee_id} ${employee.first_name} ${employee.last_name || ""} ${employee.email} ${employee.department || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <PortalShell
      title="Employee Master - PoSH"
      subtitle="Create employee master records used by Company Registration contacts."
    >
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <form style={panelStyle} onSubmit={saveEmployee}>
        <h3 style={panelTitleStyle}>Employee Master - PoSH</h3>
        {editingId && (
          <div style={editNoticeStyle}>
            Editing employee master record. Save to update or cancel to create a new record.
          </div>
        )}
        <div style={twoGridStyle}>
          <label style={labelStyle}>
            Company Name *
            <select
              required
              value={form.company_id}
              onChange={(event) => updateForm("company_id", event.target.value)}
              style={inputStyle}
            >
              <option value="">Select Company</option>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Company Code
            <input readOnly value={selectedCompany?.company_code || ""} style={{ ...inputStyle, background: "#f7f3ff" }} />
          </label>
        </div>

        <Section title="Personal Information" fields={personalFields} form={form} onChange={updateForm} />
        <Section title="Employment Information" fields={employmentFields} form={form} onChange={updateForm} />
        <Section title="Transfer / IC Information" fields={transferFields} form={form} onChange={updateForm} />

        <div style={actionsStyle}>
          <button type="submit" disabled={saving} style={primaryButtonStyle}>
            {saving ? "Saving..." : editingId ? "Update Employee" : "Save Employee"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} disabled={saving} style={secondaryButtonStyle}>
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <section style={listSectionStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={listTitleStyle}>Employees Created</h3>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employees"
            style={{ ...inputStyle, maxWidth: "320px" }}
          />
        </div>
        {loading ? (
          <div style={emptyStyle}>Loading employees...</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["Company", "Employee ID", "Name", "Email", "Contact", "Department", "Designation", "Status", "Action"].map((heading) => (
                    <th key={heading} style={thStyle}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={emptyCellStyle}>No employee master records found.</td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                    const company = companies.find((item) => item.company_id === employee.company_id);
                    return (
                      <tr key={employee.id}>
                        <td style={tdStyle}>{company?.company_name || employee.company_id}</td>
                        <td style={strongCellStyle}>{employee.employee_id}</td>
                        <td style={tdStyle}>{employee.first_name} {employee.last_name || ""}</td>
                        <td style={tdStyle}>{employee.email}</td>
                        <td style={tdStyle}>{employee.mobile}</td>
                        <td style={tdStyle}>{employee.department || "-"}</td>
                        <td style={tdStyle}>{employee.designation || "-"}</td>
                        <td style={tdStyle}>
                          <span style={statusBadgeStyle(employee.status)}>{employee.status}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={actionGroupStyle}>
                            <button
                              type="button"
                              onClick={() => startEdit(employee)}
                              style={secondaryButtonStyle}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={statusUpdatingId === employee.id}
                              onClick={() => toggleEmployeeStatus(employee)}
                              style={secondaryButtonStyle}
                            >
                              {statusUpdatingId === employee.id
                                ? "Updating..."
                                : employee.status === "Active"
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === employee.id}
                              onClick={() => deleteEmployee(employee)}
                              style={dangerButtonStyle}
                            >
                              {deletingId === employee.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalShell>
  );
}

function Section({ title, fields, form, onChange }) {
  return (
    <section style={sectionStyle}>
      <h4 style={sectionTitleStyle}>{title}</h4>
      <div style={formGridStyle}>
        {fields.map(([key, label, type = "text", required = false]) => (
          <label key={key} style={labelStyle}>
            {label}{required ? " *" : ""}
            <input
              type={type}
              required={required}
              value={form[key] || ""}
              onChange={(event) => onChange(key, event.target.value)}
              style={inputStyle}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

Section.propTypes = {
  title: PropTypes.string.isRequired,
  fields: PropTypes.arrayOf(PropTypes.array).isRequired,
  form: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])).isRequired,
  onChange: PropTypes.func.isRequired,
};

const panelStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "20px",
  display: "grid",
  gap: "18px",
};

const panelTitleStyle = {
  margin: 0,
  color: "var(--portal-purple)",
  fontSize: "17px",
};

const twoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "16px",
};

const sectionStyle = {
  display: "grid",
  gap: "12px",
  paddingTop: "4px",
};

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  margin: 0,
  color: "var(--portal-purple)",
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: 0,
};

const labelStyle = {
  display: "grid",
  gap: "7px",
  color: "var(--portal-text)",
  fontWeight: 800,
  fontSize: "13px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--portal-border)",
  borderRadius: "7px",
  padding: "10px 12px",
  color: "var(--portal-text)",
  background: "white",
};

const actionsStyle = {
  display: "flex",
  justifyContent: "flex-start",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle = {
  background: "var(--portal-purple)",
  color: "white",
  border: "none",
  borderRadius: "7px",
  padding: "11px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  background: "#f7f3ff",
  color: "var(--portal-purple)",
  border: "1px solid #d8c7ff",
  borderRadius: "7px",
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const dangerButtonStyle = {
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  borderRadius: "7px",
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

const editNoticeStyle = {
  background: "#f7f3ff",
  border: "1px solid #d8c7ff",
  borderRadius: "8px",
  padding: "10px 12px",
  color: "var(--portal-purple)",
  fontWeight: 800,
  fontSize: "13px",
};

const listSectionStyle = {
  marginTop: "18px",
  display: "grid",
  gap: "12px",
};

const listTitleStyle = {
  margin: 0,
  color: "var(--portal-purple)",
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: 0,
};

const tableWrapStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: "900px",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "12px 14px",
  background: "#faf8ff",
  color: "var(--portal-muted)",
  fontSize: "12px",
  textTransform: "uppercase",
};

const tdStyle = {
  padding: "12px 14px",
  borderTop: "1px solid var(--portal-border)",
  color: "var(--portal-text)",
  fontSize: "13px",
};

const strongCellStyle = {
  ...tdStyle,
  color: "var(--portal-purple)",
  fontWeight: 800,
};

const emptyCellStyle = {
  ...tdStyle,
  textAlign: "center",
  color: "var(--portal-muted)",
};

const emptyStyle = {
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "22px",
  color: "var(--portal-muted)",
  background: "#faf8ff",
};

const statusBadgeStyle = (status) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "4px 10px",
  background: status === "Active" ? "#e8f5ee" : "#ffedd5",
  color: status === "Active" ? "#137333" : "#9a3412",
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
