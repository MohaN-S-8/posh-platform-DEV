import { useCallback, useEffect, useState } from "react";
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
  name: "",
  designation: "",
  contact_no: "",
  email: "",
};

const POSH_SERVICE_CODE = "POSH";
const POSH_SERVICE_NAME = "PoSH Training & Compliance";

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
  company_code: "",
  company_name: "",
  reference_no: "",
  company_type: "Limited",
  company_status_type: "Client",
  client_id: "",
  scope_codes_json: "",
  service_details_json: "",
  referral_from: "",
  referral_name: "",
  industry_type: "",
  website: "",
  registration_number: "",
  gst_number: "",
  posh_policy: "",
  posh_policy_version: "",
  posh_policy_effective_date: "",
  posh_policy_document_path: "",
  posh_policy_document_name: "",
  certificate_issue_mode: "Automatic",
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
  {
    label: "Reference No",
    key: "reference_no",
    required: true,
    placeholder: "01/2026",
  },
  {
    label: "Company Name",
    key: "company_name",
    required: true,
    placeholder: "Select or enter company name",
  },
  {
    label: "Company Code (first 4 letters)",
    key: "company_code",
    required: true,
    createOnly: true,
    placeholder: "Auto-fills from company name",
  },
  {
    label: "Company Status",
    key: "company_status_type",
    type: "select",
    options: ["Client", "Master"],
  },
];

const clientDataFields = [
  {
    label: "Referral From",
    key: "referral_from",
    type: "select",
    options: [
      "Social Media",
      "Friends",
      "BNI",
      "Vendors",
      "Client",
      "Relatives",
    ],
  },
  { label: "Referral Name", key: "referral_name" },
  { label: "Contact Person Name", key: "contact_person", required: true },
  {
    label: "Contact Person Email",
    key: "contact_email",
    type: "email",
    required: true,
  },
  { label: "Contact Person Number", key: "contact_mobile", required: true },
];

const workOrderFields = [
  ["client_id", "Client ID", "readonly"],
  ["deliverables", "Deliverables"],
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

const getJsonArray = (form, key) => {
  const rows = parseJson(form[key], []);
  return Array.isArray(rows) && rows.length ? rows : [{}];
};

const getJsonObject = (form, key, fallback) => {
  const row = parseJson(form[key], fallback);
  return row && typeof row === "object" && !Array.isArray(row)
    ? { ...fallback, ...row }
    : fallback;
};

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const parseBranchCsv = (text) => {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const normalizeHeader = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const fieldForHeader = {
    branchname: "branch_name",
    branchid: "branch_id",
    address1: "address1",
    branchaddress1: "address1",
    address2: "address2",
    branchaddress2: "address2",
    city: "city",
    branchcity: "city",
    state: "state",
    branchstate: "state",
    country: "country",
    branchcountry: "country",
  };
  const headerRow = rows[0].map(normalizeHeader);
  const hasHeader = headerRow.some((header) => fieldForHeader[header]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const fallbackOrder = [
    "branch_name",
    "branch_id",
    "address1",
    "address2",
    "city",
    "state",
    "country",
  ];

  return dataRows
    .map((cells) => {
      const branch = { ...emptyBranch };
      cells.forEach((value, index) => {
        const field = hasHeader
          ? fieldForHeader[headerRow[index]]
          : fallbackOrder[index];
        if (field) branch[field] = value;
      });
      return branch;
    })
    .filter((branch) =>
      Object.values(branch).some((value) => String(value || "").trim()),
    );
};

const setJsonObjectValue = (setForm, key, fallback, field, value) => {
  setForm((current) => {
    const row = getJsonObject(current, key, fallback);
    return { ...current, [key]: JSON.stringify({ ...row, [field]: value }) };
  });
};

const setJsonArrayValue = (setForm, key, index, field, value) => {
  setForm((current) => {
    const rows = getJsonArray(current, key).map((row) => ({ ...row }));
    rows[index] = { ...rows[index], [field]: value };
    return { ...current, [key]: JSON.stringify(rows) };
  });
};

const removeJsonArrayRow = (setForm, key, index) => {
  setForm((current) => {
    const rows = getJsonArray(current, key).filter(
      (_, rowIndex) => rowIndex !== index,
    );
    return { ...current, [key]: JSON.stringify(rows.length ? rows : [{}]) };
  });
};

const addJsonArrayRow = (setForm, key, emptyRow) => {
  setForm((current) => {
    const rows = getJsonArray(current, key).filter((row) =>
      Object.values(row).some(Boolean),
    );
    return { ...current, [key]: JSON.stringify([...rows, emptyRow]) };
  });
};

const generateCompanyCode = (name) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);

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

const fixedPoshServiceRows = (form) => {
  const rows = getJsonArray(form, "service_details_json");
  const existing =
    rows.find((row) => row.scope === POSH_SERVICE_CODE) ||
    rows.find((row) =>
      [
        "assigned_to",
        "start_date",
        "stop_date",
        "frequency",
        "notes",
        "billing_amount",
        "deliverables",
      ].some((field) => row[field]),
    ) ||
    {};
  return [
    {
      ...existing,
      scope: POSH_SERVICE_CODE,
      deliverables: existing.deliverables || POSH_SERVICE_NAME,
    },
  ];
};

const nextReferenceNo = (companies) => {
  const year = new Date().getFullYear();
  const maxNumber = companies.reduce((maxValue, company) => {
    const [numberPart, yearPart] = String(company.reference_no || "").split(
      "/",
    );
    if (Number(yearPart) !== year) return maxValue;
    const parsed = Number(numberPart);
    return Number.isFinite(parsed) ? Math.max(maxValue, parsed) : maxValue;
  }, 0);
  return `${maxNumber + 1}/${year}`;
};

export function CompanyListPage() {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState([1, 2].includes(user?.role_id));
  const [editingCompany, setEditingCompany] = useState(null);
  const [selectedExistingCompany, setSelectedExistingCompany] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [masters, setMasters] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [approvingCompanyId, setApprovingCompanyId] = useState(null);
  const [policyDocumentFile, setPolicyDocumentFile] = useState(null);

  const fetchMasters = useCallback(async () => {
    try {
      const res = await apiClient.get("/companies/master-codes/");
      setMasters(res.data || []);
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          "Failed to load country, state, and city masters.",
        ),
      );
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/companies/");
      setCompanies(
        (res.data || []).filter((company) => Number(company.company_id) !== 1),
      );
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
    (category) =>
      masters.filter((item) => item.category === category && item.is_active),
    [masters],
  );

  const normalizePayload = () => {
    const serviceRows = fixedPoshServiceRows(form);
    return {
      ...form,
      reference_no: form.reference_no || nextReferenceNo(companies),
      company_code: generateCompanyCode(form.company_name),
      company_type:
        form.company_type && form.company_type !== "Work Order"
          ? form.company_type
          : "Limited",
      company_status_type: form.company_status_type || "Client",
      industry_type: form.industry_type,
      scope_codes_json: JSON.stringify([POSH_SERVICE_CODE]),
      service_details_json: JSON.stringify(serviceRows),
      corp_address_json: form.corp_address_json || JSON.stringify(emptyAddress),
      billing_address_json:
        form.billing_address_json || JSON.stringify(emptyAddress),
      account_contact_json:
        form.account_contact_json || JSON.stringify(emptyContact),
      coordinator_contact_json:
        form.coordinator_contact_json || JSON.stringify(emptyContact),
      branches_json: form.branches_json || JSON.stringify([]),
      employee_strength: form.employee_strength
        ? Number(form.employee_strength)
        : null,
      contact_person:
        form.contact_person ||
        getJsonObject(form, "coordinator_contact_json", emptyContact).name ||
        null,
      contact_email:
        form.contact_email ||
        getJsonObject(form, "coordinator_contact_json", emptyContact).email ||
        null,
      contact_mobile:
        form.contact_mobile ||
        getJsonObject(form, "coordinator_contact_json", emptyContact)
          .contact_no ||
        null,
    };
  };

  const handleCompanyNameChange = (value) => {
    const match =
      value.trim().length >= 3
        ? companies.find(
            (company) =>
              company.company_name.toLowerCase() === value.trim().toLowerCase(),
          )
        : null;
    if (match && !editingCompany) {
      setSelectedExistingCompany(match);
      setForm({
        ...emptyForm,
        ...match,
        company_name: match.company_name,
        company_code: match.company_code,
        service_details_json: JSON.stringify(fixedPoshServiceRows(match)),
        scope_codes_json: JSON.stringify([POSH_SERVICE_CODE]),
        client_id: "",
        employee_strength: match.employee_strength || "",
        certificate_issue_mode: match.certificate_issue_mode || "Automatic",
      });
      return;
    }
    setSelectedExistingCompany(null);
    setForm((current) => ({
      ...current,
      company_name: value,
      company_code: !editingCompany
        ? generateCompanyCode(value)
        : current.company_code,
    }));
  };

  const openCreate = () => {
    setEditingCompany(null);
    setSelectedExistingCompany(null);
    setForm({
      ...emptyForm,
      reference_no: nextReferenceNo(companies),
      service_details_json: JSON.stringify(fixedPoshServiceRows(emptyForm)),
      scope_codes_json: JSON.stringify([POSH_SERVICE_CODE]),
      certificate_issue_mode: "Automatic",
    });
    setPolicyDocumentFile(null);
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
      service_details_json: JSON.stringify(fixedPoshServiceRows(company)),
      scope_codes_json: JSON.stringify([POSH_SERVICE_CODE]),
      certificate_issue_mode: company.certificate_issue_mode || "Automatic",
    });
    setPolicyDocumentFile(null);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const saveCompany = async (e) => {
    e.preventDefault();
    if (!form.industry_type?.trim()) {
      setError("Industry is required before submitting for approval.");
      return;
    }
    if (!form.posh_policy?.trim()) {
      setError("PoSH Policy is required before submitting for approval.");
      return;
    }
    if (!form.posh_policy_version?.trim()) {
      setError(
        "PoSH Policy version is required before submitting for approval.",
      );
      return;
    }
    if (!form.posh_policy_effective_date?.trim()) {
      setError(
        "PoSH Policy approved/effective date is required before submitting for approval.",
      );
      return;
    }
    if (!form.posh_policy_document_path && !policyDocumentFile) {
      setError(
        "PoSH Policy PDF document is required before submitting for approval.",
      );
      return;
    }
    const generatedCompanyCode = generateCompanyCode(form.company_name);
    if (generatedCompanyCode.length !== 4) {
      setError(
        "Company name must contain at least 4 letters to generate the company code.",
      );
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      let savedCompany = null;
      if (editingCompany) {
        const payload = normalizePayload();
        delete payload.company_code;
        const res = await apiClient.put(
          `/companies/${editingCompany.company_id}`,
          payload,
        );
        savedCompany = res.data;
        setSuccess("Company details updated.");
      } else if (selectedExistingCompany) {
        const payload = normalizePayload();
        delete payload.company_code;
        const res = await apiClient.put(
          `/companies/${selectedExistingCompany.company_id}`,
          payload,
        );
        savedCompany = res.data;
        setSuccess("Company work order submitted for approval.");
      } else {
        const res = await apiClient.post("/companies/", normalizePayload());
        savedCompany = res.data;
        setSuccess("Company work order submitted for approval.");
      }
      if (policyDocumentFile && savedCompany?.company_id) {
        const filePayload = new FormData();
        filePayload.append("file", policyDocumentFile);
        await apiClient.post(
          `/companies/${savedCompany.company_id}/policy-document`,
          filePayload,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      }
      setShowForm(false);
      setEditingCompany(null);
      setSelectedExistingCompany(null);
      setForm(emptyForm);
      setPolicyDocumentFile(null);
      await fetchCompanies();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save company."));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (company) => {
    const newStatus = company.status === "Active" ? "Inactive" : "Active";
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(
        `/companies/${company.company_id}/status?status=${newStatus}`,
      );
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
      const res = await apiClient.patch(
        `/companies/${company.company_id}/approve`,
      );
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
    if (
      !window.confirm(
        `Delete ${company.company_name}? This will remove it from company lists.`,
      )
    ) {
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

  const poshService = fixedPoshServiceRows(form)[0];
  const poshPreviewClientId =
    poshService.client_id ||
    generateClientIdPreview(
      form.company_code,
      POSH_SERVICE_CODE,
      nextClientSequence(companies),
    );

  return (
    <PortalShell
      title="Company Setup"
      subtitle="Create companies, work orders, and registration details from one place."
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
      {!showForm && (
        <div style={topActionsStyle}>
          <button type="button" onClick={openCreate} style={primaryButtonStyle}>
            Create Company & Work Order
          </button>
        </div>
      )}

      <datalist id="state-code-options">
        {masterOptions("State Code").map((item) => (
          <option key={item.id} value={item.code}>
            {item.name}
          </option>
        ))}
      </datalist>
      <datalist id="country-code-options">
        {masterOptions("Country Code").map((item) => (
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
            {editingCompany
              ? "Edit Company & Work Order"
              : "Create Company & Work Order"}
          </h3>
          <p style={helperTextStyle}>
            Reference No auto-generates as Running No / Year. Company Code
            derives from the first 4 letters of the company name. Selecting one
            or more scopes generates a Client ID per scope automatically.
          </p>
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
                          onChange={(e) =>
                            setForm({ ...form, [key]: e.target.value })
                          }
                          style={inputStyle}
                        >
                          <option value="">Select</option>
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
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
                          list={
                            key === "company_name"
                              ? "company-name-options"
                              : undefined
                          }
                          readOnly={
                            key === "reference_no" || key === "company_code"
                          }
                          value={
                            key === "reference_no"
                              ? form.reference_no || nextReferenceNo(companies)
                              : form[key] || ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            if (key === "company_name") {
                              handleCompanyNameChange(value);
                              return;
                            }
                            setForm((current) => ({
                              ...current,
                              [key]: value,
                            }));
                          }}
                          style={{
                            ...inputStyle,
                            background:
                              key === "reference_no" || key === "company_code"
                                ? "#f7f3ff"
                                : "white",
                          }}
                        />
                      )}
                    </label>
                  ),
                )}
              <div style={sectionStyle}>
                <h4 style={sectionHeadingStyle}>Client Data Details</h4>
                <p style={helperTextStyle}>
                  POSH is the only active work-order service.
                </p>
                <div style={formGridStyle}>
                  {clientDataFields.map(
                    ({ label, key, type = "text", required, options }) => (
                      <label key={key} style={labelStyle}>
                        {label}
                        {type === "select" ? (
                          <select
                            required={required}
                            value={form[key] || ""}
                            onChange={(e) =>
                              setForm({ ...form, [key]: e.target.value })
                            }
                            style={inputStyle}
                          >
                            <option value="">-</option>
                            {options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={type}
                            required={required}
                            value={form[key] || ""}
                            onChange={(e) =>
                              setForm({ ...form, [key]: e.target.value })
                            }
                            style={inputStyle}
                          />
                        )}
                      </label>
                    ),
                  )}
                </div>
                <div style={panelInsetStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <strong style={{ color: "var(--portal-purple)" }}>
                      {POSH_SERVICE_NAME}{" "}
                      {poshPreviewClientId ? `- ${poshPreviewClientId}` : ""}
                    </strong>
                  </div>
                  <div style={formGridStyle}>
                    {workOrderFields.map(([field, label, type = "text"]) => (
                      <label key={`work-posh-${field}`} style={labelStyle}>
                        {label}
                        {type === "readonly" ? (
                          <input
                            readOnly
                            value={poshPreviewClientId}
                            style={{ ...inputStyle, background: "#f7f3ff" }}
                          />
                        ) : type === "frequency" ? (
                          <select
                            value={poshService[field] || ""}
                            onChange={(e) =>
                              setJsonArrayValue(
                                setForm,
                                "service_details_json",
                                0,
                                field,
                                e.target.value,
                              )
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
                            value={poshService[field] || ""}
                            onChange={(e) => {
                              const user = assignableUsers.find(
                                (item) =>
                                  String(item.user_id) === e.target.value,
                              );
                              setForm((current) => {
                                const rows = fixedPoshServiceRows(current);
                                rows[0] = {
                                  ...rows[0],
                                  assigned_to: e.target.value,
                                  assigned_to_name: user?.name || "",
                                  assigned_to_role: user?.role_label || "",
                                };
                                return {
                                  ...current,
                                  service_details_json: JSON.stringify(rows),
                                };
                              });
                            }}
                            style={inputStyle}
                          >
                            <option value="">Select user</option>
                            {assignableUsers.map((user) => (
                              <option key={user.user_id} value={user.user_id}>
                                {user.name} - {user.email} -{" "}
                                {user.role_label || "User"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={type}
                            value={poshService[field] || ""}
                            onChange={(e) =>
                              setJsonArrayValue(
                                setForm,
                                "service_details_json",
                                0,
                                field,
                                e.target.value,
                              )
                            }
                            style={inputStyle}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={sectionStyle}>
                <h4 style={sectionHeadingStyle}>
                  Company Registration Details
                </h4>
                <div style={formGridStyle}>
                  <label style={labelStyle}>
                    Company Type *
                    <select
                      required
                      value={
                        form.company_type && form.company_type !== "Work Order"
                          ? form.company_type
                          : "Limited"
                      }
                      onChange={(event) =>
                        setForm({ ...form, company_type: event.target.value })
                      }
                      style={inputStyle}
                    >
                      <option>Limited</option>
                      <option>Proprietor</option>
                      <option>Partnership</option>
                    </select>
                  </label>
                  <label style={labelStyle}>
                    Industry *
                    <input
                      required
                      value={form.industry_type || ""}
                      onChange={(event) =>
                        setForm({ ...form, industry_type: event.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    CIN / Registration No
                    <input
                      value={form.registration_number || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          registration_number: event.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    GST No
                    <input
                      value={form.gst_number || ""}
                      onChange={(event) =>
                        setForm({ ...form, gst_number: event.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    POSH Policy *
                    <input
                      required
                      value={form.posh_policy || ""}
                      onChange={(event) =>
                        setForm({ ...form, posh_policy: event.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Version *
                    <input
                      required
                      value={form.posh_policy_version || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          posh_policy_version: event.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Approved / Effective Date *
                    <input
                      required
                      type="date"
                      value={form.posh_policy_effective_date || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          posh_policy_effective_date: event.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Policy PDF *
                    <input
                      required={!form.posh_policy_document_path}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) =>
                        setPolicyDocumentFile(event.target.files?.[0] || null)
                      }
                      style={inputStyle}
                    />
                    {(policyDocumentFile || form.posh_policy_document_name) && (
                      <span style={helperTextStyle}>
                        {policyDocumentFile?.name ||
                          form.posh_policy_document_name}
                      </span>
                    )}
                  </label>
                  <label
                    style={{
                      ...labelStyle,
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      border: "1px solid var(--portal-border)",
                      borderRadius: "8px",
                      background: "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        (form.certificate_issue_mode || "Automatic") ===
                        "Automatic"
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          certificate_issue_mode: event.target.checked
                            ? "Automatic"
                            : "Manual",
                        })
                      }
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span>
                      Issue certificates automatically after assessment pass
                    </span>
                  </label>
                  <label style={labelStyle}>
                    Employee Strength
                    <input
                      type="number"
                      min="0"
                      value={form.employee_strength || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          employee_strength: event.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Website
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={form.website || ""}
                      onChange={(event) =>
                        setForm({ ...form, website: event.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>
                </div>

                <CompanyAddressFields
                  title="Corporate Office Address"
                  jsonKey="corp_address_json"
                  form={form}
                  setForm={setForm}
                  masterOptions={masterOptions}
                />
                <CompanyAddressFields
                  title="Billing Address"
                  jsonKey="billing_address_json"
                  form={form}
                  setForm={setForm}
                  masterOptions={masterOptions}
                />
                <CompanyContactFields
                  title="Account Contact"
                  jsonKey="account_contact_json"
                  form={form}
                  setForm={setForm}
                />
                <CompanyContactFields
                  title="Coordinator Contact"
                  jsonKey="coordinator_contact_json"
                  form={form}
                  setForm={setForm}
                  onContactSync={(nextContact) =>
                    setForm((current) => ({
                      ...current,
                      contact_person: nextContact.name,
                      contact_email: nextContact.email,
                      contact_mobile: nextContact.contact_no,
                    }))
                  }
                />
                <CompanyBranchFields form={form} setForm={setForm} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={submitting}
                style={primaryButtonStyle}
              >
                {submitting
                  ? "Saving..."
                  : editingCompany
                    ? "Save Changes"
                    : "Submit for Approval"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={secondaryButtonStyle}
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
        <>
          <h3 style={tableHeadingStyle}>Companies & Work Orders</h3>
          <div style={tableWrapStyle}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "960px",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#faf8ff",
                    color: "var(--portal-muted)",
                  }}
                >
                  {[
                    "Ref No",
                    "Company",
                    "Code",
                    "Status",
                    "Client ID(s)",
                    "Policy",
                    "Certificate",
                    "Approval",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
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
                  companies.map((company, index) => (
                    <tr
                      key={company.company_id}
                      style={{
                        background: index % 2 === 0 ? "white" : "#f9f9f9",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <td style={strongCellStyle}>
                        {company.reference_no || "-"}
                      </td>
                      <td style={tdStyle}>{company.company_name}</td>
                      <td style={tdStyle}>{company.company_code}</td>
                      <td style={tdStyle}>
                        {company.company_status_type || "Client"}
                      </td>
                      <td style={tdStyle}>{company.client_id || "-"}</td>
                      <td style={tdStyle}>
                        <strong>
                          {company.posh_policy_version
                            ? `v${company.posh_policy_version}`
                            : "-"}
                        </strong>
                        <br />
                        <span>
                          {company.posh_policy_effective_date ||
                            "No effective date"}
                        </span>
                        <br />
                        <span>
                          {company.posh_policy_document_name ||
                            "No PDF uploaded"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {company.certificate_issue_mode || "Automatic"}
                      </td>
                      <td style={tdStyle}>
                        <span style={approvalStyle(company.approval_status)}>
                          {company.approval_status || "Pending"}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
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
                          {company.status === "Active"
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                        {user?.role_id === 1 &&
                          company.approval_status !== "Approved" && (
                            <button
                              type="button"
                              onClick={() => approveCompany(company)}
                              disabled={
                                approvingCompanyId === company.company_id
                              }
                              style={primaryButtonStyle}
                            >
                              {approvingCompanyId === company.company_id
                                ? "Approving..."
                                : "Approve"}
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
        </>
      )}
    </PortalShell>
  );
}

function CompanyAddressFields({
  title,
  jsonKey,
  form,
  setForm,
  masterOptions,
}) {
  const values = getJsonObject(form, jsonKey, emptyAddress);
  const update = (field, value) =>
    setJsonObjectValue(setForm, jsonKey, emptyAddress, field, value);

  return (
    <div style={panelInsetStyle}>
      <h4 style={sectionHeadingStyle}>{title}</h4>
      <div style={formGridStyle}>
        <label style={labelStyle}>
          Address Line 1 *
          <input
            required
            value={values.address1 || ""}
            onChange={(event) => update("address1", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Address Line 2 *
          <input
            required
            value={values.address2 || ""}
            onChange={(event) => update("address2", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Address Line 3 *
          <input
            required
            value={values.address3 || ""}
            onChange={(event) => update("address3", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          City *
          <input
            required
            list="city-code-options"
            value={values.city || ""}
            onChange={(event) => update("city", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          State *
          <input
            required
            list="state-code-options"
            value={values.state || ""}
            onChange={(event) => update("state", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Pincode *
          <input
            required
            value={values.pincode || ""}
            onChange={(event) => update("pincode", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Country *
          <select
            required
            value={values.country || "IN"}
            onChange={(event) => update("country", event.target.value)}
            style={inputStyle}
          >
            {masterOptions("Country Code").map((item) => (
              <option key={item.id} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function CompanyContactFields({
  title,
  jsonKey,
  form,
  setForm,
  onContactSync,
}) {
  const values = getJsonObject(form, jsonKey, emptyContact);
  const update = (field, value) => {
    const nextContact = { ...values, [field]: value };
    setForm((current) => ({
      ...current,
      [jsonKey]: JSON.stringify(nextContact),
    }));
    if (onContactSync) onContactSync(nextContact);
  };

  return (
    <div style={panelInsetStyle}>
      <h4 style={sectionHeadingStyle}>{title}</h4>
      <div style={formGridStyle}>
        <label style={labelStyle}>
          Name *
          <input
            required
            value={values.name || ""}
            onChange={(event) => update("name", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Designation *
          <input
            required
            value={values.designation || ""}
            onChange={(event) => update("designation", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Contact No *
          <input
            required
            value={values.contact_no || ""}
            onChange={(event) => update("contact_no", event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Email *
          <input
            required
            type="email"
            value={values.email || ""}
            onChange={(event) => update("email", event.target.value)}
            style={inputStyle}
          />
        </label>
      </div>
    </div>
  );
}

function CompanyBranchFields({ form, setForm }) {
  const branches = getJsonArray(form, "branches_json");
  const uploadBranches = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBranchCsv(String(reader.result || ""));
      if (parsed.length) {
        setForm((current) => ({
          ...current,
          branches_json: JSON.stringify(parsed),
        }));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={panelInsetStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <h4 style={sectionHeadingStyle}>Branches</h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <label style={{ ...secondaryButtonStyle, cursor: "pointer" }}>
            Bulk Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => uploadBranches(event.target.files?.[0])}
              style={{ display: "none" }}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              addJsonArrayRow(setForm, "branches_json", emptyBranch)
            }
            style={secondaryButtonStyle}
          >
            Add Branch
          </button>
        </div>
      </div>
      {branches.map((branch, index) => (
        <div
          key={`branch-${index}`}
          style={{
            ...panelInsetStyle,
            background: "white",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <strong style={{ color: "var(--portal-purple)" }}>
              Branch {index + 1}
            </strong>
            {branches.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  removeJsonArrayRow(setForm, "branches_json", index)
                }
                style={secondaryButtonStyle}
              >
                Remove
              </button>
            )}
          </div>
          <div style={formGridStyle}>
            {[
              ["branch_name", "Branch Name"],
              ["branch_id", "Branch ID"],
              ["address1", "Address 1"],
              ["address2", "Address 2"],
              ["city", "City"],
              ["state", "State"],
              ["country", "Country"],
            ].map(([field, label]) => (
              <label key={field} style={labelStyle}>
                {label}
                <input
                  value={branch[field] || ""}
                  onChange={(event) =>
                    setJsonArrayValue(
                      setForm,
                      "branches_json",
                      index,
                      field,
                      event.target.value,
                    )
                  }
                  style={inputStyle}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const companyFormShape = PropTypes.shape({
  corp_address_json: PropTypes.string,
  billing_address_json: PropTypes.string,
  account_contact_json: PropTypes.string,
  coordinator_contact_json: PropTypes.string,
  branches_json: PropTypes.string,
});

CompanyAddressFields.propTypes = {
  title: PropTypes.string.isRequired,
  jsonKey: PropTypes.string.isRequired,
  form: companyFormShape.isRequired,
  setForm: PropTypes.func.isRequired,
  masterOptions: PropTypes.func.isRequired,
};

CompanyContactFields.propTypes = {
  title: PropTypes.string.isRequired,
  jsonKey: PropTypes.string.isRequired,
  form: companyFormShape.isRequired,
  setForm: PropTypes.func.isRequired,
  onContactSync: PropTypes.func,
};

CompanyContactFields.defaultProps = {
  onContactSync: null,
};

CompanyBranchFields.propTypes = {
  form: companyFormShape.isRequired,
  setForm: PropTypes.func.isRequired,
};

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

const topActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "20px",
};

const helperTextStyle = {
  margin: "-4px 0 18px",
  color: "var(--portal-muted)",
  fontSize: "13px",
  lineHeight: 1.5,
};

const tableHeadingStyle = {
  margin: "26px 0 12px",
  color: "var(--portal-purple)",
  fontSize: "14px",
  textTransform: "uppercase",
  letterSpacing: 0,
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "16px",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  color: "var(--portal-text)",
  fontWeight: 700,
  fontSize: "13px",
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
