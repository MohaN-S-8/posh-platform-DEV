import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const emptyAddress = {
  address1: "",
  address2: "",
  address3: "",
  city: "",
  state: "",
  pincode: "",
  country: "IN",
};

const emptyContact = {
  employee_id: "",
  name: "",
  designation: "",
  contact_no: "",
  email: "",
};

const emptyBranch = {
  branch_name: "",
  branch_id: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "IN",
};

const emptyForm = {
  company_id: "",
  company_code: "",
  company_name: "",
  company_type: "Limited",
  industry_type: "",
  website: "",
  employee_strength: "",
  registration_number: "",
  gst_number: "",
  corp_address: emptyAddress,
  billing_address: emptyAddress,
  account_contact: emptyContact,
  coordinator_contact: emptyContact,
  client_admin_password: "",
  branches: [],
};

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed || fallback;
  } catch {
    return fallback;
  }
};

const fullNameParts = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || "Client",
    last_name: parts.slice(1).join(" ") || "Admin",
  };
};

const clientUsername = (companyCode, email) =>
  `${String(companyCode || "client").toLowerCase()}.${String(email || "admin").split("@")[0]}`.replace(/[^a-z0-9._-]/g, "");

const employeeName = (employee) =>
  `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim() || employee?.name || "";

const employeeOptionLabel = (employee) =>
  `${employeeName(employee)} - ${employee.email}${employee.employee_id ? ` (${employee.employee_id})` : ""}`;

export function CompanyRegistrationPage() {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [masters, setMasters] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const masterOptions = useCallback(
    (category) => masters.filter((item) => item.category === category && item.is_active),
    [masters],
  );

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.company_id) === String(form.company_id)),
    [companies, form.company_id],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [companyRes, masterRes, employeeRes] = await Promise.all([
        apiClient.get("/companies/registration-candidates/"),
        apiClient.get("/companies/master-codes/"),
        apiClient.get("/companies/employee-master/"),
      ]);
      setCompanies((companyRes.data || []).filter((company) => Number(company.company_id) !== 1));
      setMasters(masterRes.data || []);
      setEmployees(employeeRes.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load company registration data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const hydrateCompany = (companyId) => {
    const company = companies.find((item) => String(item.company_id) === String(companyId));
    if (!company) {
      setForm(emptyForm);
      return;
    }
    setForm({
      company_id: company.company_id,
      company_code: company.company_code || "",
      company_name: company.company_name || "",
      company_type: company.company_type && company.company_type !== "Work Order" ? company.company_type : "Limited",
      industry_type: company.industry_type === "Pending Registration" ? "" : company.industry_type || "",
      website: company.website || "",
      employee_strength: company.employee_strength || "",
      registration_number: company.registration_number || "",
      gst_number: company.gst_number || "",
      corp_address: { ...emptyAddress, ...parseJson(company.corp_address_json, {}) },
      billing_address: { ...emptyAddress, ...parseJson(company.billing_address_json, {}) },
      account_contact: { ...emptyContact, ...parseJson(company.account_contact_json, {}) },
      coordinator_contact: { ...emptyContact, ...parseJson(company.coordinator_contact_json, {}) },
      client_admin_password: "",
      branches: parseJson(company.branches_json, []),
    });
  };

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setNested = (section, key, value) => {
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  };

  const setBranch = (index, key, value) => {
    setForm((current) => {
      const branches = current.branches.map((branch) => ({ ...branch }));
      branches[index] = { ...branches[index], [key]: value };
      return { ...current, branches };
    });
  };

  const addBranch = () => {
    setForm((current) => ({
      ...current,
      branches: [...current.branches, { ...emptyBranch }],
    }));
  };

  const removeBranch = (index) => {
    setForm((current) => ({
      ...current,
      branches: current.branches.filter((_, branchIndex) => branchIndex !== index),
    }));
  };

  const selectContactEmployee = (section, userId) => {
    const employee = employees.find((item) => String(item.id) === String(userId));
    if (!employee) return;
    setForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        employee_id: String(employee.id),
        employee_search: employeeOptionLabel(employee),
        name: employeeName(employee),
        email: employee.email || "",
        contact_no: employee.mobile || current[section].contact_no || "",
        designation: employee.designation || current[section].designation || "",
      },
    }));
  };

  const saveRegistration = async (event) => {
    event.preventDefault();
    if (!form.company_id) {
      setError("Select an approved company first.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.put(`/companies/${form.company_id}/registration`, {
        company_name: form.company_name,
        company_type: form.company_type,
        industry_type: form.industry_type,
        website: form.website || null,
        employee_strength: form.employee_strength ? Number(form.employee_strength) : null,
        registration_number: form.registration_number,
        gst_number: form.gst_number,
        corp_address_json: JSON.stringify(form.corp_address),
        billing_address_json: JSON.stringify(form.billing_address),
        account_contact_json: JSON.stringify(form.account_contact),
        coordinator_contact_json: JSON.stringify(form.coordinator_contact),
        branches_json: JSON.stringify(form.branches),
        contact_person: form.coordinator_contact.name,
        contact_email: form.coordinator_contact.email,
        contact_mobile: form.coordinator_contact.contact_no,
      });

      let clientAdminMessage = "";
      if (user?.role_id === 2) {
        const name = fullNameParts(form.coordinator_contact.name);
        await apiClient.post(`/companies/${form.company_id}/client-admin`, {
          ...name,
          email: form.coordinator_contact.email,
          mobile: form.coordinator_contact.contact_no,
          role_id: 5,
          company_id: Number(form.company_id),
          employee_id: `CL-${form.company_code}-${form.company_id}`,
          username: clientUsername(form.company_code, form.coordinator_contact.email),
          password: form.client_admin_password || null,
          designation: form.coordinator_contact.designation || "Client Admin",
          department: "Management",
        });
        clientAdminMessage = " Client Admin login created and welcome email triggered.";
      }

      setSuccess(`Company registration saved.${clientAdminMessage}`);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save company registration."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell
      title="Company Registration - PoSH"
      subtitle="Company Admin registers clients and creates their Client Admin login."
    >
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <form style={panelStyle} onSubmit={saveRegistration}>
        <h3 style={panelTitleStyle}>Company Registration - PoSH</h3>
        <p style={helperTextStyle}>
          Only approved companies from Create Company & Work Order appear below. Coordinator Contact becomes the client&apos;s Client Admin login when saved by a Company Admin.
        </p>

        {loading ? (
          <div style={emptyStyle}>Loading approved companies...</div>
        ) : (
          <>
            <div style={twoGridStyle}>
              <label style={labelStyle}>
                Company Name *
                <select
                  required
                  value={form.company_id}
                  onChange={(event) => hydrateCompany(event.target.value)}
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
                Company Code (auto)
                <input readOnly value={form.company_code} style={{ ...inputStyle, background: "#f7f3ff" }} />
              </label>
            </div>

            <div style={threeGridStyle}>
              <label style={labelStyle}>
                Company Type
                <select value={form.company_type} onChange={(event) => setField("company_type", event.target.value)} style={inputStyle}>
                  <option>Limited</option>
                  <option>Proprietor</option>
                  <option>Partnership</option>
                </select>
              </label>
              <label style={labelStyle}>
                Industry
                <input required value={form.industry_type} onChange={(event) => setField("industry_type", event.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                CIN No
                <input value={form.registration_number} onChange={(event) => setField("registration_number", event.target.value)} style={inputStyle} />
              </label>
            </div>

            <div style={threeGridStyle}>
              <label style={labelStyle}>
                GST No
                <input value={form.gst_number} onChange={(event) => setField("gst_number", event.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Employee Strength
                <input type="number" min="0" value={form.employee_strength} onChange={(event) => setField("employee_strength", event.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Website Link
                <input type="url" placeholder="https://example.com" value={form.website} onChange={(event) => setField("website", event.target.value)} style={inputStyle} />
              </label>
            </div>

            <AddressSection title="Corporate Office Address" section="corp_address" values={form.corp_address} onChange={setNested} masterOptions={masterOptions} />
            <AddressSection title="Billing Address" section="billing_address" values={form.billing_address} onChange={setNested} masterOptions={masterOptions} />

            <EmployeeContactSection
              title="Account Contact"
              section="account_contact"
              values={form.account_contact}
              employees={employees}
              onSelect={selectContactEmployee}
              onChange={setNested}
            />

            <EmployeeContactSection
              title="Coordinator Contact (Becomes Client Admin)"
              description="Add the employee first in Employee Master, then pick them here - this employee becomes the Client Admin login."
              section="coordinator_contact"
              values={form.coordinator_contact}
              employees={employees}
              onSelect={selectContactEmployee}
              onChange={setNested}
            />

            {user?.role_id === 2 && (
              <section style={sectionStyle}>
                <h4 style={sectionHeadingStyle}>Client Admin Credentials</h4>
                <div style={twoGridStyle}>
                  <label style={labelStyle}>
                    Password
                    <input
                      type="password"
                      minLength={8}
                      maxLength={15}
                      value={form.client_admin_password}
                      placeholder="Leave blank to auto-generate"
                      onChange={(event) => setField("client_admin_password", event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </section>
            )}

            <section style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <h4 style={sectionHeadingStyle}>Branches</h4>
                <button type="button" onClick={addBranch} style={secondaryButtonStyle}>Add Branch</button>
              </div>
              {form.branches.map((branch, index) => (
                <div key={`branch-${index}`} style={branchPanelStyle}>
                  <div style={sectionHeaderStyle}>
                    <strong style={{ color: "var(--portal-purple)" }}>Branch {index + 1}</strong>
                    {form.branches.length > 1 && (
                      <button type="button" onClick={() => removeBranch(index)} style={secondaryButtonStyle}>Remove</button>
                    )}
                  </div>
                  <div style={twoGridStyle}>
                    <TextInput label="Branch Name" value={branch.branch_name} onChange={(value) => setBranch(index, "branch_name", value)} />
                    <TextInput label="Branch ID" value={branch.branch_id} onChange={(value) => setBranch(index, "branch_id", value)} />
                    <TextInput label="Branch Address 1" value={branch.address1} onChange={(value) => setBranch(index, "address1", value)} />
                    <TextInput label="Branch Address 2" value={branch.address2} onChange={(value) => setBranch(index, "address2", value)} />
                    <TextInput label="Branch City" list="city-options" value={branch.city} onChange={(value) => setBranch(index, "city", value)} />
                    <TextInput label="Branch State" list="state-options" value={branch.state} onChange={(value) => setBranch(index, "state", value)} />
                    <TextInput label="Branch Country" list="country-options" value={branch.country} onChange={(value) => setBranch(index, "country", value)} />
                  </div>
                </div>
              ))}
            </section>

            <div style={actionsStyle}>
              <button type="submit" disabled={saving || !selectedCompany} style={primaryButtonStyle}>
                {saving ? "Saving..." : user?.role_id === 2 ? "Save Registration & Create Client Admin" : "Save Registration"}
              </button>
            </div>
          </>
        )}
      </form>
      <section style={registeredSectionStyle}>
        <h3 style={registeredTitleStyle}>Registered Companies</h3>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Company", "Branches", "Account Contact", "Client Admin Username", "Status"].map((heading) => (
                  <th key={heading} style={thStyle}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={5} style={emptyCellStyle}>
                    {user?.role_id === 2
                      ? "No approved companies assigned to this Company Admin. Ask Super Admin to assign the work-order service to this admin before approval."
                      : "No approved companies available for registration."}
                  </td>
                </tr>
              ) : (
                companies.map((company) => {
                  const account = parseJson(company.account_contact_json, {});
                  const coordinator = parseJson(company.coordinator_contact_json, {});
                  const branches = parseJson(company.branches_json, []);
                  const registered = Boolean(account.email || coordinator.email || branches.length);
                  return (
                    <tr key={company.company_id}>
                      <td style={tdStyle}>{company.company_name}</td>
                      <td style={tdStyle}>{Array.isArray(branches) ? branches.length : 0}</td>
                      <td style={tdStyle}>{account.name || "-"}</td>
                      <td style={tdStyle}>{coordinator.email ? clientUsername(company.company_code, coordinator.email) : "-"}</td>
                      <td style={tdStyle}>
                        <span style={statusBadgeStyle(registered)}>{registered ? "Registered" : "Pending"}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <datalist id="city-options">
        {masterOptions("City Code").map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
      </datalist>
      <datalist id="state-options">
        {masterOptions("State Code").map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
      </datalist>
      <datalist id="country-options">
        {masterOptions("Country Code").map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
      </datalist>
    </PortalShell>
  );
}

function AddressSection({ title, section, values, onChange, masterOptions }) {
  return (
    <section style={sectionStyle}>
      <h4 style={sectionHeadingStyle}>{title}</h4>
      <div style={twoGridStyle}>
        <TextInput label="Address Line 1" required value={values.address1} onChange={(value) => onChange(section, "address1", value)} />
        <TextInput label="Address Line 2" value={values.address2} onChange={(value) => onChange(section, "address2", value)} />
      </div>
      <div style={fourGridStyle}>
        <TextInput label="City" required list="city-options" value={values.city} onChange={(value) => onChange(section, "city", value)} />
        <TextInput label="State" required list="state-options" value={values.state} onChange={(value) => onChange(section, "state", value)} />
        <TextInput label="Pincode" required value={values.pincode} onChange={(value) => onChange(section, "pincode", value)} />
        <label style={labelStyle}>
          Country
          <select value={values.country} onChange={(event) => onChange(section, "country", event.target.value)} style={inputStyle}>
            {masterOptions("Country Code").map((item) => (
              <option key={item.id} value={item.code}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function EmployeeContactSection({
  title,
  description = "Add the employee first in Employee Master, then pick them here.",
  section,
  values,
  employees,
  onSelect,
  onChange,
}) {
  const activeEmployees = employees.filter((employee) => employee.status !== "Inactive");
  const selectedEmployee = activeEmployees.find((employee) => String(employee.id) === String(values.employee_id));
  const employeeSearchValue = values.employee_search ?? (selectedEmployee ? employeeOptionLabel(selectedEmployee) : "");
  const listId = `${section}-employee-options`;
  const handleEmployeeSearch = (value) => {
    onChange(section, "employee_search", value);
    const normalized = value.trim().toLowerCase();
    const match = activeEmployees.find((employee) => {
      const label = employeeOptionLabel(employee).toLowerCase();
      return (
        label === normalized ||
        String(employee.id) === value ||
        String(employee.email || "").toLowerCase() === normalized ||
        String(employee.employee_id || "").toLowerCase() === normalized
      );
    });
    if (match) {
      onSelect(section, match.id);
    } else {
      onChange(section, "employee_id", "");
    }
  };
  return (
    <section style={sectionStyle}>
      <h4 style={sectionHeadingStyle}>{title}</h4>
      <p style={helperTextStyle}>{description}</p>
      <div style={twoGridStyle}>
        <label style={labelStyle}>
          Select Employee *
          <input
            required
            type="text"
            list={listId}
            value={employeeSearchValue}
            placeholder={
              activeEmployees.length
                ? "Type name, email, or employee ID"
                : "No active employees found - add or activate in Employee Master first"
            }
            onChange={(event) => handleEmployeeSearch(event.target.value)}
            style={inputStyle}
          />
          <datalist id={listId}>
            {activeEmployees.map((employee) => (
              <option key={employee.id} value={employeeOptionLabel(employee)} />
            ))}
          </datalist>
        </label>
        <TextInput label="Designation" required value={values.designation} onChange={(value) => onChange(section, "designation", value)} />
        <TextInput label="Contact No" required value={values.contact_no} onChange={(value) => onChange(section, "contact_no", value)} />
        <TextInput label="Email" type="email" required value={values.email} onChange={(value) => onChange(section, "email", value)} />
      </div>
    </section>
  );
}

function TextInput({ label, value, onChange, type = "text", required = false, list }) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        type={type}
        required={required}
        list={list}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

const addressShape = PropTypes.shape({
  address1: PropTypes.string,
  address2: PropTypes.string,
  address3: PropTypes.string,
  city: PropTypes.string,
  state: PropTypes.string,
  pincode: PropTypes.string,
  country: PropTypes.string,
});

const contactShape = PropTypes.shape({
  employee_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  employee_search: PropTypes.string,
  name: PropTypes.string,
  designation: PropTypes.string,
  contact_no: PropTypes.string,
  email: PropTypes.string,
});

AddressSection.propTypes = {
  title: PropTypes.string.isRequired,
  section: PropTypes.string.isRequired,
  values: addressShape.isRequired,
  onChange: PropTypes.func.isRequired,
  masterOptions: PropTypes.func.isRequired,
};

EmployeeContactSection.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  section: PropTypes.string.isRequired,
  values: contactShape.isRequired,
  employees: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      name: PropTypes.string,
      first_name: PropTypes.string,
      last_name: PropTypes.string,
      email: PropTypes.string,
      mobile: PropTypes.string,
      designation: PropTypes.string,
    }),
  ).isRequired,
  onSelect: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
};

TextInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  type: PropTypes.string,
  required: PropTypes.bool,
  list: PropTypes.string,
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

const helperTextStyle = {
  margin: 0,
  color: "var(--portal-muted)",
  lineHeight: 1.55,
  fontSize: "13px",
};

const twoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const threeGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const fourGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const sectionStyle = {
  display: "grid",
  gap: "12px",
  paddingTop: "8px",
};

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
};

const sectionHeadingStyle = {
  margin: 0,
  color: "var(--portal-purple)",
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: 0,
};

const branchPanelStyle = {
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "14px",
  background: "#faf8ff",
  display: "grid",
  gap: "12px",
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

const emptyStyle = {
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

const registeredSectionStyle = {
  marginTop: "18px",
};

const registeredTitleStyle = {
  margin: "0 0 12px",
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
  minWidth: "760px",
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

const emptyCellStyle = {
  ...tdStyle,
  textAlign: "center",
  color: "var(--portal-muted)",
};

const statusBadgeStyle = (registered) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "4px 10px",
  background: registered ? "#e8f5ee" : "#fff7e6",
  color: registered ? "#137333" : "#9a6700",
  fontWeight: 800,
  fontSize: "12px",
});
