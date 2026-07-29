import { useCallback, useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const emptyForm = {
  company_code: "",
  company_name: "",
  reference_no: "",
  company_type: "",
  company_status_type: "CLIENT",
  client_id: "",
  scope_codes_json: "",
  service_details_json: "",
  referral_from: "",
  referral_name: "",
  industry_type: "",
  website: "",
  registration_number: "",
  gst_number: "",
  employee_strength: "",
  address: "",
  corp_address_json: "",
  billing_address_json: "",
  account_contact_json: "",
  coordinator_contact_json: "",
  branches_json: "",
  contact_person: "",
  contact_email: "",
  contact_mobile: "",
};

const fields = [
  { label: "Reference No", key: "reference_no", required: true, placeholder: "01/2026" },
  { label: "Company CODE", key: "company_code", required: true, createOnly: true, placeholder: "Auto from company name" },
  { label: "Company Name", key: "company_name", required: true, placeholder: "Select or enter company name" },
  { label: "Company Type", key: "company_type", required: true, placeholder: "Proprietor / Partnership / Limited" },
  { label: "Company Status", key: "company_status_type", type: "select", options: ["MASTER", "CLIENT"] },
  { label: "Industry", key: "industry_type", required: true },
  {
    label: "Website",
    key: "website",
    type: "url",
    placeholder: "https://example.com",
  },
  { label: "CIN No", key: "registration_number" },
  { label: "GST Number", key: "gst_number" },
  { label: "Employee Strength", key: "employee_strength", type: "number", min: 1 },
  { label: "Contact Person Name", key: "contact_person", required: true },
  { label: "Contact Person Email", key: "contact_email", type: "email", required: true },
  { label: "Contact Person Number", key: "contact_mobile", required: true },
  { label: "Referral From", key: "referral_from", type: "select", options: ["Social Media", "Friends", "BNI", "Vendors", "Client", "Relatives"] },
  { label: "Referral Name", key: "referral_name" },
];

const addressFields = [
  ["address1", "Address 1"],
  ["address2", "Address 2"],
  ["address3", "Address 3"],
  ["city", "City"],
  ["pincode", "Pincode"],
  ["state", "State"],
  ["country", "Country"],
];

const contactFields = [
  ["name", "Name"],
  ["designation", "Designation"],
  ["contact_no", "Contact No"],
  ["email", "Email"],
];

const branchFields = [
  ["branch_name", "Branch Name"],
  ["branch_id", "Branch ID"],
  ["address1", "Branch Address 1"],
  ["address2", "Branch Address 2"],
  ["city", "Branch City"],
  ["state", "Branch State"],
  ["country", "Branch Country"],
];

const workOrderFields = [
  ["client_id", "Client ID", "readonly"],
  ["scope", "Scope", "scope"],
  ["deliverables", "Deliverables", "deliverables"],
  ["start_date", "Start Date", "date"],
  ["stop_date", "Stop Date", "date"],
  ["frequency", "Frequency", "frequency"],
  ["notes", "Notes"],
  ["billing_amount", "Billing Amount"],
  ["assigned_to", "Assigned To", "assigned"],
];

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getJsonValue = (form, key, field) => parseJson(form[key], {})?.[field] || "";

const setJsonValue = (setForm, key, field, value) => {
  setForm((current) => {
    const next = { ...parseJson(current[key], {}), [field]: value };
    return { ...current, [key]: JSON.stringify(next) };
  });
};

const getJsonArray = (form, key) => {
  const rows = parseJson(form[key], []);
  return Array.isArray(rows) && rows.length ? rows : [{}];
};

const setJsonArrayValue = (setForm, key, index, field, value) => {
  setForm((current) => {
    const rows = getJsonArray(current, key).map((row) => ({ ...row }));
    rows[index] = { ...rows[index], [field]: value };
    return { ...current, [key]: JSON.stringify(rows) };
  });
};

const toggleJsonArrayMultiValue = (setForm, key, index, field, value) => {
  setForm((current) => {
    const rows = getJsonArray(current, key).map((row) => ({ ...row }));
    const existing = String(rows[index]?.[field] || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const next = existing.includes(value)
      ? existing.filter((item) => item !== value)
      : [...existing, value];
    rows[index] = { ...rows[index], [field]: next.join(", ") };
    return { ...current, [key]: JSON.stringify(rows) };
  });
};

const addJsonArrayRow = (setForm, key) => {
  setForm((current) => {
    const rows = getJsonArray(current, key).map((row) => ({ ...row }));
    rows.push({});
    return { ...current, [key]: JSON.stringify(rows) };
  });
};

const removeJsonArrayRow = (setForm, key, index) => {
  setForm((current) => {
    const rows = getJsonArray(current, key).filter((_, rowIndex) => rowIndex !== index);
    return { ...current, [key]: JSON.stringify(rows.length ? rows : [{}]) };
  });
};

const generateCompanyCode = (name) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");

const nextClientSequence = (companies) =>
  companies.reduce((maxValue, company) => {
    const rows = parseJson(company.service_details_json, []);
    if (!Array.isArray(rows)) return maxValue;
    return rows.reduce((rowMax, row) => {
      const match = String(row.client_id || "").match(/-(\d+)$/);
      return match ? Math.max(rowMax, Number(match[1])) : rowMax;
    }, maxValue);
  }, 0) + 1;

const generateClientIdPreview = (companyCode, scope, sequence) => {
  if (!companyCode || !scope) return "";
  const year = String(new Date().getFullYear()).slice(-2);
  return `${companyCode}/${scope}/${year}-${sequence}`;
};

const quickMasterFields = [
  { category: "State Code", label: "State Code", placeholder: "Tamil Nadu", codePlaceholder: "TN" },
  { category: "City Code", label: "City Code", placeholder: "Chennai", codePlaceholder: "CHN" },
  { category: "Scope of Work ID", label: "Scope of Work ID", placeholder: "POSH Compliance", codePlaceholder: "POSH" },
];

export function CompanyListPage() {
  // const navigate = useNavigate();
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [selectedExistingCompany, setSelectedExistingCompany] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [languageRows, setLanguageRows] = useState([]);
  const [defaultLanguageId, setDefaultLanguageId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [masters, setMasters] = useState([]);
  const [masterDrafts, setMasterDrafts] = useState(() =>
    quickMasterFields.reduce((drafts, item) => ({
      ...drafts,
      [item.category]: { name: "", code: "" },
    }), {}),
  );
  const [savingMaster, setSavingMaster] = useState("");
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [approvingCompanyId, setApprovingCompanyId] = useState(null);

  const fetchMasters = useCallback(async () => {
    try {
      const res = await apiClient.get("/companies/master-codes/");
      setMasters(res.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load state, city, and scope masters."));
    }
  }, []);

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

  const fetchAssignableUsers = useCallback(async () => {
    try {
      const res = await apiClient.get("/companies/assignable-users/");
      setAssignableUsers(res.data || []);
    } catch {
      setAssignableUsers([]);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(fetchCompanies, 0);
    return () => window.clearTimeout(loadTimer);
  }, [fetchCompanies]);

  useEffect(() => {
    const masterTimer = window.setTimeout(fetchMasters, 0);
    return () => window.clearTimeout(masterTimer);
  }, [fetchMasters]);

  useEffect(() => {
    const usersTimer = window.setTimeout(fetchAssignableUsers, 0);
    return () => window.clearTimeout(usersTimer);
  }, [fetchAssignableUsers]);

  const masterOptions = useCallback(
    (category) => masters.filter((item) => item.category === category && item.is_active),
    [masters],
  );

  const saveQuickMaster = async (category) => {
    const draft = masterDrafts[category] || { name: "", code: "" };
    const name = draft.name.trim();
    const code = draft.code.trim().toUpperCase();
    if (!name || !code) {
      setError("Enter both name and code before creating a master value.");
      return;
    }
    const duplicate = masters.some(
      (item) =>
        item.category === category &&
        String(item.code || "").toUpperCase() === code,
    );
    if (duplicate) {
      setError(`${category} code '${code}' already exists. Choose it from the dropdown or enter a new code.`);
      return;
    }
    setSavingMaster(category);
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/admin-config/master-codes", {
        category,
        name,
        code,
        description: `${category} created from Company Management`,
        is_active: true,
      });
      setMasterDrafts((current) => ({ ...current, [category]: { name: "", code: "" } }));
      setSuccess(`${category} created.`);
      await fetchMasters();
    } catch (err) {
      setError(apiErrorMessage(err, `Failed to create ${category}.`));
    } finally {
      setSavingMaster("");
    }
  };

  const normalizePayload = () => ({
    ...form,
    company_code: form.company_code || generateCompanyCode(form.company_name),
    scope_codes_json: form.scope_codes_json || JSON.stringify(["POSH"]),
    service_details_json: form.service_details_json || JSON.stringify([{}]),
    branches_json: form.branches_json || JSON.stringify([{}]),
    employee_strength: form.employee_strength ? Number(form.employee_strength) : null,
  });

  const handleCompanyNameChange = (value) => {
    const match =
      value.trim().length >= 3
        ? companies.find((company) => company.company_name.toLowerCase() === value.trim().toLowerCase())
        : null;
    if (match && !editingCompany) {
      setSelectedExistingCompany(match);
      setForm({
        ...emptyForm,
        ...match,
        company_name: match.company_name,
        company_code: match.company_code,
        service_details_json: JSON.stringify([{}]),
        scope_codes_json: "",
        client_id: "",
        employee_strength: match.employee_strength || "",
      });
      return;
    }
    setSelectedExistingCompany(null);
    setForm((current) => ({
      ...current,
      company_name: value,
      company_code: !editingCompany && !current.company_code ? generateCompanyCode(value) : current.company_code,
    }));
  };

  const openCreate = () => {
    setEditingCompany(null);
    setSelectedExistingCompany(null);
    setLanguageRows([]);
    setDefaultLanguageId("");
    setForm(emptyForm);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const openEdit = async (company) => {
    setEditingCompany(company);
    setSelectedExistingCompany(null);
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
      } else if (selectedExistingCompany) {
        const payload = normalizePayload();
        delete payload.company_code;
        await apiClient.put(`/companies/${selectedExistingCompany.company_id}`, payload);
        setSuccess("Company work order submitted for approval.");
      } else {
        await apiClient.post("/companies/", normalizePayload());
        setSuccess("Company work order submitted for approval.");
      }
      setShowForm(false);
      setEditingCompany(null);
      setSelectedExistingCompany(null);
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

  const approveCompany = async (company) => {
    setError("");
    setSuccess("");
    setApprovingCompanyId(company.company_id);
    try {
      const res = await apiClient.patch(`/companies/${company.company_id}/approve`);
      const summary = res.data?.email_summary;
      if (summary?.failed) {
        setSuccess(
          `Company approved. Email sent: ${summary.sent}, failed: ${summary.failed}. Notifications: ${summary.notifications}.`,
        );
      } else {
        setSuccess(
          `Company approved. Email sent: ${summary?.sent ?? 0}. Notifications: ${summary?.notifications ?? 0}.`,
        );
      }
      await fetchCompanies();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to approve company work order."));
    } finally {
      setApprovingCompanyId(null);
    }
  };

  const deleteCompany = async (company) => {
    if (!window.confirm(`Delete ${company.company_name}? This will remove it from company lists.`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/companies/${company.company_id}`);
      setSuccess("Company deleted.");
      await fetchCompanies();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete company."));
    }
  };

  return (
    <PortalShell
      title="Company Management"
      subtitle="Manage registered companies, employee counts, and configurations."
    >
      {approvingCompanyId && (
        <div style={loadingOverlayStyle}>
          <div style={loadingPanelStyle}>
            <div style={loadingSpinnerStyle} />
            <strong>Approving company...</strong>
            <span>Sending assignment email and notifications.</span>
          </div>
        </div>
      )}
      <div style={masterStripStyle}>
        {user?.role_id === 1 && quickMasterFields.map((item) => {
            const draft = masterDrafts[item.category] || { name: "", code: "" };
            return (
              <div key={item.category} style={quickMasterStyle}>
                <strong style={{ gridColumn: "1 / -1", color: "var(--portal-purple)" }}>{item.label}</strong>
                <input
                  value={draft.name}
                  placeholder={item.placeholder}
                  onChange={(e) =>
                    setMasterDrafts((current) => ({
                      ...current,
                      [item.category]: { ...draft, name: e.target.value },
                    }))
                  }
                  style={inputStyle}
                />
                <input
                  value={draft.code}
                  placeholder={item.codePlaceholder}
                  onChange={(e) =>
                    setMasterDrafts((current) => ({
                      ...current,
                      [item.category]: { ...draft, code: e.target.value.toUpperCase() },
                    }))
                  }
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => saveQuickMaster(item.category)}
                  disabled={savingMaster === item.category}
                  style={secondaryButtonStyle}
                >
                  {savingMaster === item.category ? "Creating..." : "Create"}
                </button>
              </div>
            );
          })}
        <button type="button" onClick={openCreate} style={primaryButtonStyle}>
          Add Company
        </button>
      </div>

      <datalist id="state-code-options">
        {masterOptions("State Code").map((item) => (
          <option key={item.id} value={item.code}>
            {item.name}
          </option>
        ))}
      </datalist>
      <datalist id="city-code-options">
        {masterOptions("City Code").map((item) => (
          <option key={item.id} value={item.code}>
            {item.name}
          </option>
        ))}
      </datalist>
      <datalist id="scope-code-options">
        {masterOptions("Scope of Work ID").map((item) => (
          <option key={item.id} value={item.code}>
            {item.name}
          </option>
        ))}
      </datalist>
      <datalist id="company-name-options">
        {companies.map((company) => (
          <option key={company.company_id} value={company.company_name}>
            {company.company_code}
          </option>
        ))}
      </datalist>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      {showForm && (
        <div style={panelStyle}>
          <h3 style={{ color: "var(--portal-purple)", marginTop: 0 }}>
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
                    options,
                  }) => (
                  <label key={key} style={labelStyle}>
                    {label}
                    {type === "select" ? (
                      <select
                        required={required}
                        value={form[key] || ""}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Select</option>
                        {options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={type}
                        required={required}
                        pattern={pattern}
                        maxLength={maxLength}
                        min={min}
                        placeholder={placeholder}
                        list={key === "company_name" ? "company-name-options" : undefined}
                        readOnly={key === "company_code" && !!selectedExistingCompany}
                        value={form[key] || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (key === "company_name") {
                            handleCompanyNameChange(value);
                            return;
                          }
                          setForm((current) => ({ ...current, [key]: value }));
                        }}
                        style={{
                          ...inputStyle,
                          background: key === "company_code" && selectedExistingCompany ? "#f7f3ff" : "white",
                        }}
                      />
                    )}
                  </label>
                  ),
                )}
              <div style={sectionStyle}>
                <h4 style={sectionHeadingStyle}>Corporate Office Address</h4>
                <div style={formGridStyle}>
                  {addressFields.map(([field, label]) => (
                    <label key={`corp-${field}`} style={labelStyle}>
                      {label} - Corp Off
                      <input
                        required={["address1", "city", "pincode", "state", "country"].includes(field)}
                        list={field === "city" ? "city-code-options" : field === "state" ? "state-code-options" : undefined}
                        value={getJsonValue(form, "corp_address_json", field)}
                        onChange={(e) =>
                          setJsonValue(setForm, "corp_address_json", field, e.target.value)
                        }
                        style={inputStyle}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div style={sectionStyle}>
                <h4 style={sectionHeadingStyle}>Billing Address</h4>
                <div style={formGridStyle}>
                  {addressFields.map(([field, label]) => (
                    <label key={`billing-${field}`} style={labelStyle}>
                      {label} - Billing Add
                      <input
                        required={["address1", "city", "pincode", "state", "country"].includes(field)}
                        list={field === "city" ? "city-code-options" : field === "state" ? "state-code-options" : undefined}
                        value={getJsonValue(form, "billing_address_json", field)}
                        onChange={(e) =>
                          setJsonValue(setForm, "billing_address_json", field, e.target.value)
                        }
                        style={inputStyle}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div style={sectionStyle}>
                <h4 style={sectionHeadingStyle}>Account Contact 1</h4>
                <div style={formGridStyle}>
                  {contactFields.map(([field, label]) => (
                    <label key={`account-${field}`} style={labelStyle}>
                      {label} - Acc 1
                      <input
                        required
                        type={field === "email" ? "email" : "text"}
                        value={getJsonValue(form, "account_contact_json", field)}
                        onChange={(e) =>
                          setJsonValue(setForm, "account_contact_json", field, e.target.value)
                        }
                        style={inputStyle}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div style={sectionStyle}>
                <h4 style={sectionHeadingStyle}>Coordinator Contact 1 - Company Admin</h4>
                <div style={formGridStyle}>
                  {contactFields.map(([field, label]) => (
                    <label key={`coordinator-${field}`} style={labelStyle}>
                      {label} - Co-ord 1
                      <input
                        required
                        type={field === "email" ? "email" : "text"}
                        value={getJsonValue(form, "coordinator_contact_json", field)}
                        onChange={(e) =>
                          setJsonValue(setForm, "coordinator_contact_json", field, e.target.value)
                        }
                        style={inputStyle}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div style={sectionStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                  <h4 style={sectionHeadingStyle}>Client Data / Work Order Form - 1A</h4>
                  <button type="button" onClick={() => addJsonArrayRow(setForm, "service_details_json")} style={secondaryButtonStyle}>
                    Add Scope
                  </button>
                </div>
                {getJsonArray(form, "service_details_json").map((service, serviceIndex) => {
                  const sequence = nextClientSequence(companies) + serviceIndex;
                  const previewClientId =
                    service.client_id ||
                    generateClientIdPreview(form.company_code, service.scope, sequence);
                  return (
                    <div key={`service-${serviceIndex}`} style={panelInsetStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                        <strong style={{ color: "var(--portal-purple)" }}>
                          Service {serviceIndex + 1} {previewClientId ? `- ${previewClientId}` : ""}
                        </strong>
                        {getJsonArray(form, "service_details_json").length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeJsonArrayRow(setForm, "service_details_json", serviceIndex)}
                            style={secondaryButtonStyle}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div style={formGridStyle}>
                        {workOrderFields.map(([field, label, type = "text"]) => (
                          <label key={`work-${serviceIndex}-${field}`} style={labelStyle}>
                            {label}
                            {type === "readonly" ? (
                              <input
                                readOnly
                                value={previewClientId}
                                style={{ ...inputStyle, background: "#f7f3ff" }}
                              />
                            ) : type === "deliverables" ? (
                              <div style={multiSelectStyle}>
                                {masterOptions("Deliverables").map((item) => {
                                  const selected = String(service[field] || "")
                                    .split(",")
                                    .map((value) => value.trim())
                                    .filter(Boolean);
                                  return (
                                    <label key={item.id} style={multiOptionStyle}>
                                      <input
                                        type="checkbox"
                                        checked={selected.includes(item.code)}
                                        onChange={() =>
                                          toggleJsonArrayMultiValue(
                                            setForm,
                                            "service_details_json",
                                            serviceIndex,
                                            field,
                                            item.code,
                                          )
                                        }
                                      />
                                      {item.name} ({item.code})
                                    </label>
                                  );
                                })}
                                {masterOptions("Deliverables").length === 0 && (
                                  <span style={{ color: "var(--portal-muted)", fontSize: "13px" }}>
                                    Add deliverables in POSH Admin Config.
                                  </span>
                                )}
                              </div>
                            ) : type === "frequency" ? (
                              <select
                                value={service[field] || ""}
                                onChange={(e) =>
                                  setJsonArrayValue(setForm, "service_details_json", serviceIndex, field, e.target.value)
                                }
                                style={inputStyle}
                              >
                                <option value="">Select</option>
                                <option value="OT">One time (OT)</option>
                                <option value="M">Monthly (M)</option>
                                <option value="QRLY">Quarterly (QRLY)</option>
                                <option value="HY">Half yearly (HY)</option>
                                <option value="ANL">Annual (ANL)</option>
                              </select>
                            ) : type === "assigned" ? (
                              <select
                                value={service[field] || ""}
                                onChange={(e) => {
                                  const user = assignableUsers.find((item) => String(item.user_id) === e.target.value);
                                  setForm((current) => {
                                    const rows = getJsonArray(current, "service_details_json").map((row) => ({ ...row }));
                                    rows[serviceIndex] = {
                                      ...rows[serviceIndex],
                                      assigned_to: e.target.value,
                                      assigned_to_name: user?.name || "",
                                    };
                                    return { ...current, service_details_json: JSON.stringify(rows) };
                                  });
                                }}
                                style={inputStyle}
                              >
                                <option value="">Select employee</option>
                                {assignableUsers.map((user) => (
                                  <option key={user.user_id} value={user.user_id}>
                                    {user.name} - {user.email}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={type === "scope" ? "text" : type}
                                list={type === "scope" ? "scope-code-options" : undefined}
                                value={service[field] || ""}
                                onChange={(e) =>
                                  setJsonArrayValue(setForm, "service_details_json", serviceIndex, field, e.target.value)
                                }
                                style={inputStyle}
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={sectionStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                  <h4 style={sectionHeadingStyle}>Branches</h4>
                  <button type="button" onClick={() => addJsonArrayRow(setForm, "branches_json")} style={secondaryButtonStyle}>
                    Add Branch
                  </button>
                </div>
                {getJsonArray(form, "branches_json").map((branch, branchIndex) => (
                  <div key={`branch-${branchIndex}`} style={panelInsetStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                      <strong style={{ color: "var(--portal-purple)" }}>Branch {branchIndex + 1}</strong>
                      {getJsonArray(form, "branches_json").length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeJsonArrayRow(setForm, "branches_json", branchIndex)}
                          style={secondaryButtonStyle}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div style={formGridStyle}>
                      {branchFields.map(([field, label]) => (
                        <label key={`branch-${branchIndex}-${field}`} style={labelStyle}>
                          {label}
                          <input
                            list={field === "city" ? "city-code-options" : field === "state" ? "state-code-options" : undefined}
                            value={branch[field] || ""}
                            onChange={(e) =>
                              setJsonArrayValue(setForm, "branches_json", branchIndex, field, e.target.value)
                            }
                            style={inputStyle}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
              <h4 style={{ margin: "0 0 12px", color: "var(--portal-purple)" }}>
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
              <tr style={{ background: "var(--portal-purple)", color: "white" }}>
                {["Code", "Name", "Client ID", "Industry", "Contact", "GST", "Employees", "Approval", "Status", "Actions"].map(
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
                  <td colSpan={10} style={{ padding: "40px", textAlign: "center", color: "#999" }}>
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
                    <td style={tdStyle}>{company.client_id || "-"}</td>
                    <td style={tdStyle}>{company.industry_type || "-"}</td>
                    <td style={tdStyle}>
                      {company.contact_person || "-"}
                      <br />
                      <span style={{ color: "var(--portal-muted)" }}>{company.contact_email || "-"}</span>
                    </td>
                    <td style={tdStyle}>{company.gst_number || "-"}</td>
                    <td style={tdStyle}>{company.employee_strength || "-"}</td>
                    <td style={tdStyle}>
                      <span style={approvalStyle(company.approval_status)}>{company.approval_status || "Pending"}</span>
                    </td>
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
                      {user?.role_id === 1 && company.approval_status !== "Approved" && (
                        <button
                          type="button"
                          onClick={() => approveCompany(company)}
                          disabled={approvingCompanyId === company.company_id}
                          style={primaryButtonStyle}
                        >
                          {approvingCompanyId === company.company_id ? "Approving..." : "Approve"}
                        </button>
                      )}
                      {user?.role_id === 1 && (
                        <button
                          type="button"
                          onClick={() => deleteCompany(company)}
                          style={dangerButtonStyle}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </PortalShell>
  );
}

// const headerStyle = {
//   display: "flex",
//   justifyContent: "space-between",
//   alignItems: "center",
//   gap: "16px",
//   marginBottom: "24px",
// };

const panelStyle = {
  background: "var(--portal-card)",
  borderRadius: "8px",
  padding: "24px",
  border: "1px solid var(--portal-border)",
  boxShadow: "0 2px 8px rgba(74,46,131,0.08)",
  marginBottom: "24px",
};

const panelInsetStyle = {
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "16px",
  background: "#faf8ff",
};

const sectionStyle = {
  gridColumn: "1 / -1",
  display: "grid",
  gap: "14px",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "16px",
  background: "var(--portal-card)",
};

const sectionHeadingStyle = {
  margin: 0,
  color: "var(--portal-purple)",
  fontSize: "15px",
};

const masterStripStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: "12px",
  alignItems: "end",
  marginBottom: "20px",
};

const quickMasterStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 0.75fr auto",
  gap: "8px",
  alignItems: "end",
  background: "var(--portal-card)",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "12px",
  boxShadow: "0 2px 8px rgba(74,46,131,0.06)",
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
  color: "var(--portal-text)",
  fontWeight: 700,
  fontSize: "13px",
};

const checkboxStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  color: "var(--portal-text)",
  fontSize: "13px",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--portal-border)",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  color: "var(--portal-text)",
  background: "white",
};

const multiSelectStyle = {
  display: "grid",
  gap: "8px",
  minHeight: "42px",
  padding: "10px",
  border: "1px solid var(--portal-border)",
  borderRadius: "6px",
  background: "white",
};

const multiOptionStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "var(--portal-text)",
  fontSize: "13px",
  fontWeight: 600,
};

const primaryButtonStyle = {
  padding: "10px 18px",
  background: "var(--portal-purple)",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle = {
  padding: "8px 12px",
  background: "#f7f3ff",
  color: "var(--portal-purple)",
  border: "1px solid #d8c7ff",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle = {
  padding: "8px 12px",
  background: "#fff1f2",
  color: "#b42318",
  border: "1px solid #fecdd3",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
};

// const linkButtonStyle = {
//   background: "none",
//   border: "none",
//   color: "#1a3c5e",
//   cursor: "pointer",
//   marginBottom: "8px",
//   padding: 0,
//   fontWeight: 700,
// };

const tableWrapStyle = {
  background: "var(--portal-card)",
  borderRadius: "8px",
  border: "1px solid var(--portal-border)",
  boxShadow: "0 2px 8px rgba(74,46,131,0.08)",
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
  color: "var(--portal-text)",
};

const strongCellStyle = {
  ...tdStyle,
  fontWeight: 700,
  color: "var(--portal-purple)",
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
  border: "1px solid var(--portal-purple-light)",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "var(--portal-purple)",
  marginBottom: "16px",
};

const statusStyle = (status) => ({
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  background: status === "Active" ? "#f7f3ff" : "#fdf0f0",
  color: status === "Active" ? "var(--portal-purple)" : "#c0392b",
});

const approvalStyle = (status) => ({
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  background: status === "Approved" ? "#f7f3ff" : "#faf8ff",
  color: "var(--portal-purple)",
});

const loadingOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  display: "grid",
  placeItems: "center",
  background: "rgba(31, 36, 48, 0.24)",
};

const loadingPanelStyle = {
  display: "grid",
  justifyItems: "center",
  gap: "10px",
  width: "min(360px, calc(100vw - 32px))",
  padding: "24px",
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  boxShadow: "0 18px 50px rgba(74,46,131,0.22)",
  color: "var(--portal-purple)",
  textAlign: "center",
};

const loadingSpinnerStyle = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  border: "4px solid #eadfff",
  borderTopColor: "var(--portal-purple)",
  animation: "spin 0.8s linear infinite",
};
