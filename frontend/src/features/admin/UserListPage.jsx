import { ValidatedForm } from "../../components/ValidatedForm";
import { useBrandingStore } from "../../store/brandingStore";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import KeyIcon from "@mui/icons-material/Key";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { MasterCityInput } from "../../components/MasterCityInput";
import { BranchMasterSelect } from "../../components/BranchMasterSelect";
import { branchFields, clearedBranchFields } from "../../utils/branchFields";
import {
  employeePersonalOptions,
  normalizeEmployeeStatus,
  showEmploymentField,
} from "../../utils/employeeOptions";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const ROLES = {
  1: "Super Admin",
  2: "Admin",
  5: "Client Admin",
  3: "IC",
  4: "Employee",
};

const ROLE_CREATE_FLOW = {
  1: [1, 2, 5, 3, 4],
  2: [5, 3, 4],
  5: [4, 3],
  3: [],
};

function defaultRoleFor(user, companyId = user?.company_id) {
  if (user?.role_id === 1 && Number(companyId) === 1) return 2;
  return 4;
}

function defaultIcRoleFor(roleId) {
  return Number(roleId) === 3 ? "Admin" : "";
}

function emptyMessageFor(user) {
  if (user?.role_id === 2) {
    return "No Client / Management, IC, or Employee users found. Admin can create and manage these users here.";
  }
  if (user?.role_id === 5) {
    return "No Employee or IC users found. Admin can create and manage its own Employee and IC users here.";
  }
  if (user?.role_id === 3) {
    return "IC cannot create or manage employee accounts.";
  }
  return "No users found.";
}

function cleanUserPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      value === "" ? null : value,
    ]),
  );
}

function userDisplayName(target) {
  return (
    `${target.first_name || ""} ${target.last_name || ""}`.trim() ||
    target.email ||
    "User"
  );
}

function userSearchText(target) {
  return [
    target.employee_id,
    userDisplayName(target),
    target.email,
    target.mobile,
    target.username,
    target.department,
    target.designation,
    target.branch_name,
    target.branch_id,
    target.ic_role,
    ROLES[target.role_id],
    target.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

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
  date_of_birth: "",
  father_name: "",
  emergency_contact: "",
  gender: "",
  blood_group: "",
  physically_challenged: "",
  marital_status: "",
  pan_number: "",
  foreign_national: "",
  department: "",
  designation: "",
  joining_date: "",
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
  role_id: 4,
  company_id: "",
  password: "",
};

const personalFields = [
  ["employee_id", "Employee ID"],
  ["first_name", "First Name"],
  ["last_name", "Last Name"],
  ["date_of_birth", "Date of Birth", "date"],
  ["father_name", "Father Name"],
  ["mobile", "Contact Number"],
  ["emergency_contact", "Emergency Contact"],
  ["email", "Email", "email"],
  ["gender", "Gender"],
  ["blood_group", "Blood Group"],
  ["physically_challenged", "Physically Challenged"],
  ["marital_status", "Marital Status"],
  ["pan_number", "PAN"],
  ["foreign_national", "Foreign National"],
];

const employmentFields = [
  ["employee_status", "Status of Employee"],
  ["employment_status", "Employment Status"],
  ["joining_date", "Date of Joining", "date"],
  ["designation", "Designation"],
  ["department", "Department"],
  ["transfer_location", "Location / City"],
  ["resignation_date", "Date of Resignation", "date"],
  ["resignation_reason", "Reason for Resignation"],
  ["reporting_to", "Reporting To"],
  ["branch_name", "Branch Name"],
  ["branch_id", "Branch ID"],
  ["transfer_enabled", "Transfer", "checkbox"],
  ["transfer_date", "Transfer Date", "date"],
  ["transfer_branch_name", "Transfer Branch Name"],
  ["transfer_branch_id", "Transfer Branch ID"],
  ["ic_role", "IC Role"],
];

export function UserListPage() {
  const PORTAL_COMPANY_NAME = useBrandingStore((state) => state.portalName);
  const location = useLocation();
  const { user } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [transferEnabled, setTransferEnabled] = useState(false);
  const [editTransferEnabled, setEditTransferEnabled] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    userId: "",
    password: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bulkErrors, setBulkErrors] = useState([]);
  const [search, setSearch] = useState("");
  const [userFilterId, setUserFilterId] = useState("all");
  const isHrRoute = location.pathname.startsWith("/hr/");
  const pageTitle =
    user?.role_id === 2
      ? "Company Users"
      : isHrRoute
        ? "Employee Management"
        : "User Management";
  const createButtonLabel =
    user?.role_id === 2
      ? "New Company User"
      : user?.role_id === 5
        ? "New Employee / IC"
        : user?.role_id === 3
          ? "New Employee"
          : "New User";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const userReq = apiClient.get("/users/");
      const companyReq =
        user?.role_id === 1
          ? apiClient.get("/companies/")
          : user?.role_id === 2
            ? apiClient.get("/companies/registration-candidates/")
            : Promise.resolve({ data: [] });
      const [userRes, companyRes] = await Promise.all([userReq, companyReq]);
      setUsers(userRes.data || []);
      const ownCompanyId = user?.company_id || 1;
      const availableCompanies = companyRes.data || [];
      const ownCompany = availableCompanies.find(
        (company) => Number(company.company_id) === Number(ownCompanyId),
      );
      setCompanies([
        {
          company_id: ownCompanyId,
          company_name:
            Number(ownCompanyId) === 1
              ? PORTAL_COMPANY_NAME
              : ownCompany?.company_name ||
                user?.company_name ||
                "Your company",
        },
        ...availableCompanies.filter(
          (company) => Number(company.company_id) !== Number(ownCompanyId),
        ),
      ]);
      const nextRole = defaultRoleFor(user, ownCompanyId);
      setForm((current) => ({
        ...current,
        role_id: current.role_id || nextRole,
        ic_role:
          current.ic_role || defaultIcRoleFor(current.role_id || nextRole),
        company_id:
          user?.role_id === 1 || user?.role_id === 2
            ? current.company_id || ownCompanyId
            : user?.company_id || "",
      }));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load users."));
    } finally {
      setLoading(false);
    }
  }, [user, PORTAL_COMPANY_NAME]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const roleOptionsFor = (companyId) =>
    (ROLE_CREATE_FLOW[user?.role_id] || [])
      .filter(
        (value) =>
          value !== 1 ||
          (Number(user?.role_id) === 1 && Number(companyId) === 1),
      )
      .map((value) => ({
        value,
        label: value === 1 ? "Co-Partner" : ROLES[value],
      }));

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((target) => {
      const matchesUser =
        userFilterId === "all" || String(target.user_id) === userFilterId;
      const matchesSearch = !query || userSearchText(target).includes(query);
      return matchesUser && matchesSearch;
    });
  }, [search, userFilterId, users]);

  const canManageUser = (target) =>
    (ROLE_CREATE_FLOW[user?.role_id] || []).includes(target.role_id);

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
        company_id: Number(
          user?.role_id === 1 || user?.role_id === 2
            ? form.company_id
            : user.company_id,
        ),
      };
      await apiClient.post("/users/", cleanUserPayload(payload));
      setSuccess(
        form.password
          ? "User created successfully."
          : "User created successfully. Temporary password was emailed.",
      );
      setForm({
        ...initialForm,
        role_id: defaultRoleFor(user),
        ic_role: defaultIcRoleFor(defaultRoleFor(user)),
        company_id:
          user?.role_id === 1 || user?.role_id === 2
            ? user?.company_id || 1
            : user?.company_id || "",
      });
      setShowCreate(false);
      setTransferEnabled(false);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create user."));
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
      setSuccess(
        passwordForm.password
          ? "Password changed successfully."
          : "Temporary password generated and emailed.",
      );
      setPasswordForm({ userId: "", password: "" });
      setShowPassword(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to change password."));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (target) => {
    setEditingUser(target);
    setEditTransferEnabled(
      Boolean(
        target.transfer_date ||
        target.transfer_branch_name ||
        target.transfer_branch_id,
      ),
    );
    setEditForm({
      ...initialForm,
      ...target,
      employee_status: normalizeEmployeeStatus(target.employee_status),
      date_of_birth: target.date_of_birth || "",
      joining_date: target.joining_date || "",
      resignation_date: target.resignation_date || "",
      transfer_date: target.transfer_date || "",
      role_id: target.role_id,
      company_id: target.company_id || "",
      ic_role: target.ic_role || defaultIcRoleFor(target.role_id),
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.put(
        `/users/${editingUser.user_id}`,
        cleanUserPayload({
          ...editForm,
          password: undefined,
          email: editForm.email.trim().toLowerCase(),
          role_id: Number(editForm.role_id),
        }),
      );
      setSuccess("User updated successfully.");
      setEditingUser(null);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update user."));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (target) => {
    const newStatus = target.status === "Active" ? "Inactive" : "Active";
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(
        `/users/${target.user_id}/status?status=${newStatus}`,
      );
      setSuccess(`User ${newStatus.toLowerCase()} successfully.`);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update user status."));
    }
  };

  const deleteUser = async (target) => {
    const confirmed = window.confirm(
      `Delete ${target.first_name} ${target.last_name || ""}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/users/${target.user_id}`);
      setSuccess("User deleted successfully.");
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete user."));
    }
  };

  const upgradeToIc = async (target) => {
    const name = `${target.first_name || ""} ${target.last_name || ""}`.trim();
    const confirmed = window.confirm(
      `Upgrade ${name || target.email} from Employee to IC?`,
    );
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post(`/users/${target.user_id}/upgrade-to-ic`, {
        ic_role: target.ic_role || "Internal Committee Member",
      });
      setSuccess("Employee upgraded to IC successfully.");
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to upgrade employee to IC."));
    } finally {
      setSaving(false);
    }
  };

  const downloadBulkTemplate = async () => {
    setError("");
    try {
      const res = await apiClient.get("/users/bulk-template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "text/csv" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "user_bulk_template.csv";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to download user bulk template."));
    }
  };

  const uploadBulkUsers = async (file) => {
    if (!file) return;
    setBulkUploading(true);
    setError("");
    setSuccess("");
    setBulkErrors([]);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiClient.post("/users/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBulkErrors(res.data?.errors || []);
      setSuccess(
        `Bulk upload finished. Created ${res.data?.created_count || 0} user(s), ${
          res.data?.error_count || 0
        } error(s).`,
      );
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to upload users."));
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <PortalShell
      title={pageTitle}
      subtitle="Manage user accounts, roles, and access credentials."
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <select
            value={userFilterId}
            onChange={(e) => setUserFilterId(e.target.value)}
            style={{ ...inputStyle, width: "220px" }}
          >
            <option value="all">All Users</option>
            {users.map((target) => (
              <option key={target.user_id} value={String(target.user_id)}>
                {userDisplayName(target)}
              </option>
            ))}
          </select>
          <input
            placeholder="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "260px" }}
          />
          <button
            type="button"
            onClick={() => {
              setUserFilterId("all");
              setSearch("");
            }}
            style={secondaryButtonStyle}
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={downloadBulkTemplate}
            style={secondaryButtonStyle}
          >
            <FileDownloadIcon fontSize="small" />
            Template
          </button>
          <label style={{ ...secondaryButtonStyle, cursor: "pointer" }}>
            <UploadFileIcon fontSize="small" />
            {bulkUploading ? "Uploading..." : "Bulk Upload"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={bulkUploading}
              onChange={(event) => {
                uploadBulkUsers(event.target.files?.[0]);
                event.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const nextShowCreate = !showCreate;
              setShowCreate(nextShowCreate);
              if (nextShowCreate) {
                const nextRole = defaultRoleFor(
                  user,
                  form.company_id || user?.company_id || 1,
                );
                setForm((current) => ({
                  ...current,
                  role_id: nextRole,
                  ic_role: defaultIcRoleFor(nextRole),
                  company_id:
                    user?.role_id === 1 || user?.role_id === 2
                      ? current.company_id || user?.company_id || 1
                      : user?.company_id || "",
                }));
              }
            }}
            style={primaryButtonStyle}
          >
            <AddIcon fontSize="small" />
            {createButtonLabel}
          </button>
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}
      {bulkErrors.length > 0 && (
        <div style={errorStyle}>
          <strong>Rows needing correction:</strong>{" "}
          {bulkErrors
            .slice(0, 5)
            .map((item) => `Row ${item.row}: ${item.error}`)
            .join(" | ")}
          {bulkErrors.length > 5 ? ` | ${bulkErrors.length - 5} more...` : ""}
        </div>
      )}

      {showCreate && (
        <ValidatedForm error={error} onSubmit={submitCreate} style={panelStyle}>
          <h2 style={panelTitleStyle}>
            Create{" "}
            {roleOptionsFor(form.company_id).find(
              (role) => role.value === Number(form.role_id),
            )?.label || "User"}
          </h2>
          <div style={formGridStyle}>
            <label style={labelStyle}>
              Company
              <select
                required
                disabled={![1, 2].includes(Number(user?.role_id))}
                value={form.company_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ...clearedBranchFields,
                    company_id: e.target.value,
                    role_id: defaultRoleFor(user, e.target.value),
                    ic_role: "",
                  })
                }
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
            <label style={labelStyle}>
              Role
              <select
                value={form.role_id}
                onChange={(e) => {
                  const nextRole = Number(e.target.value);
                  setForm({
                    ...form,
                    role_id: nextRole,
                    ic_role: defaultIcRoleFor(nextRole),
                  });
                }}
                style={inputStyle}
              >
                {roleOptionsFor(form.company_id).map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={sectionLabelStyle}>Personal Information</div>
          <div style={formGridStyle}>
            {personalFields.map(([field, label, type = "text"]) => (
              <label key={field} style={labelStyle}>
                {label}
                {employeePersonalOptions[field] ? (
                  <select
                    value={form[field] || ""}
                    onChange={(event) =>
                      setForm({ ...form, [field]: event.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="">Select {label}</option>
                    {form[field] &&
                      !employeePersonalOptions[field].includes(form[field]) && (
                        <option value={form[field]}>{form[field]}</option>
                      )}
                    {employeePersonalOptions[field].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={[
                      "employee_id",
                      "first_name",
                      "last_name",
                      "email",
                      "mobile",
                    ].includes(field)}
                    type={type}
                    pattern={field === "mobile" ? "\\d{10}" : undefined}
                    maxLength={field === "mobile" ? 10 : undefined}
                    value={form[field]}
                    onChange={(e) =>
                      setForm({ ...form, [field]: e.target.value })
                    }
                    style={inputStyle}
                  />
                )}
              </label>
            ))}
          </div>
          <div style={sectionLabelStyle}>Employment Details</div>
          <div style={formGridStyle}>
            {employmentFields
              .filter(([field]) =>
                showEmploymentField(field, form.employee_status),
              )
              .filter(
                ([field]) =>
                  ![
                    "transfer_date",
                    "transfer_branch_name",
                    "transfer_branch_id",
                  ].includes(field) || transferEnabled,
              )
              .filter(
                ([field]) => field !== "ic_role" || Number(form.role_id) === 3,
              )
              .map(([field, label, type = "text"]) => (
                <label key={field} style={labelStyle}>
                  {label}
                  {field === "transfer_enabled" ? (
                    <input
                      type="checkbox"
                      checked={transferEnabled}
                      onChange={(event) =>
                        setTransferEnabled(event.target.checked)
                      }
                    />
                  ) : employeePersonalOptions[field] ? (
                    <select
                      required={field === "employee_status"}
                      value={form[field] || ""}
                      onChange={(event) =>
                        setForm({ ...form, [field]: event.target.value })
                      }
                      style={inputStyle}
                    >
                      <option value="">Select {label}</option>
                      {employeePersonalOptions[field].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : ["branch_name", "transfer_branch_name"].includes(
                      field,
                    ) ? (
                    <BranchMasterSelect
                      companyId={form.company_id}
                      branchId={
                        field === "branch_name"
                          ? form.branch_id
                          : form.transfer_branch_id
                      }
                      branchName={form[field]}
                      required={field === "branch_name"}
                      style={inputStyle}
                      onChange={(branch) =>
                        setForm((current) => ({
                          ...current,
                          ...branchFields(branch, {
                            transfer: field === "transfer_branch_name",
                            userForm: true,
                          }),
                        }))
                      }
                    />
                  ) : field === "transfer_location" ? (
                    <MasterCityInput
                      required
                      value={form[field] || ""}
                      onChange={(value) => setForm({ ...form, [field]: value })}
                    />
                  ) : (
                    <input
                      readOnly={["branch_id", "transfer_branch_id"].includes(
                        field,
                      )}
                      required={[
                        "joining_date",
                        "designation",
                        "department",
                        "transfer_location",
                        "employee_status",
                        "branch_name",
                        "branch_id",
                      ].includes(field)}
                      type={type}
                      value={form[field] || ""}
                      onChange={(e) =>
                        setForm({ ...form, [field]: e.target.value })
                      }
                      style={inputStyle}
                    />
                  )}
                </label>
              ))}
            <label style={labelStyle}>
              Password
              <input
                type="password"
                minLength={8}
                maxLength={15}
                value={form.password || ""}
                placeholder="Leave blank to auto-generate"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={inputStyle}
              />
            </label>
          </div>
          <button type="submit" disabled={saving} style={primaryButtonStyle}>
            {saving ? "Creating..." : "Create User"}
          </button>
        </ValidatedForm>
      )}

      {showPassword && (
        <ValidatedForm
          error={error}
          onSubmit={submitPassword}
          style={panelStyle}
        >
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
                {users.filter(canManageUser).map((target) => (
                  <option key={target.user_id} value={target.user_id}>
                    {target.first_name} {target.last_name || ""} -{" "}
                    {target.email}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              New Password
              <input
                type="password"
                minLength={8}
                maxLength={15}
                value={passwordForm.password}
                placeholder="Leave blank to auto-generate"
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
        </ValidatedForm>
      )}

      {editingUser && (
        <ValidatedForm error={error} onSubmit={submitEdit} style={panelStyle}>
          <h2 style={panelTitleStyle}>Edit User</h2>
          <div style={formGridStyle}>
            <label style={labelStyle}>
              Company
              <input
                readOnly
                value={
                  companies.find(
                    (company) =>
                      Number(company.company_id) ===
                      Number(editForm.company_id),
                  )?.company_name ||
                  (Number(editForm.company_id) === 1
                    ? PORTAL_COMPANY_NAME
                    : user?.company_name || "Your company")
                }
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Role
              <select
                value={editForm.role_id}
                onChange={(e) => {
                  const nextRole = Number(e.target.value);
                  setEditForm({
                    ...editForm,
                    role_id: nextRole,
                    ic_role: defaultIcRoleFor(nextRole),
                  });
                }}
                style={inputStyle}
              >
                {roleOptionsFor(editForm.company_id).map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={sectionLabelStyle}>Personal Information</div>
          <div style={formGridStyle}>
            {personalFields.map(([field, label, type = "text"]) => (
              <label key={field} style={labelStyle}>
                {label}
                {employeePersonalOptions[field] ? (
                  <select
                    value={editForm[field] || ""}
                    onChange={(event) =>
                      setEditForm({ ...editForm, [field]: event.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="">Select {label}</option>
                    {editForm[field] &&
                      !employeePersonalOptions[field].includes(
                        editForm[field],
                      ) && (
                        <option value={editForm[field]}>
                          {editForm[field]}
                        </option>
                      )}
                    {employeePersonalOptions[field].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={[
                      "employee_id",
                      "first_name",
                      "last_name",
                      "email",
                      "mobile",
                    ].includes(field)}
                    type={type}
                    pattern={field === "mobile" ? "\\d{10}" : undefined}
                    maxLength={field === "mobile" ? 10 : undefined}
                    value={editForm[field]}
                    onChange={(e) =>
                      setEditForm({ ...editForm, [field]: e.target.value })
                    }
                    style={inputStyle}
                  />
                )}
              </label>
            ))}
          </div>
          <div style={sectionLabelStyle}>Employment Details</div>
          <div style={formGridStyle}>
            {employmentFields
              .filter(([field]) =>
                showEmploymentField(field, editForm.employee_status),
              )
              .filter(
                ([field]) =>
                  ![
                    "transfer_date",
                    "transfer_branch_name",
                    "transfer_branch_id",
                  ].includes(field) || editTransferEnabled,
              )
              .filter(
                ([field]) =>
                  field !== "ic_role" || Number(editForm.role_id) === 3,
              )
              .map(([field, label, type = "text"]) => (
                <label key={field} style={labelStyle}>
                  {label}
                  {field === "transfer_enabled" ? (
                    <input
                      type="checkbox"
                      checked={editTransferEnabled}
                      onChange={(event) =>
                        setEditTransferEnabled(event.target.checked)
                      }
                    />
                  ) : employeePersonalOptions[field] ? (
                    <select
                      required={field === "employee_status"}
                      value={editForm[field] || ""}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          [field]: event.target.value,
                        })
                      }
                      style={inputStyle}
                    >
                      <option value="">Select {label}</option>
                      {editForm[field] &&
                        !employeePersonalOptions[field].includes(
                          editForm[field],
                        ) && (
                          <option value={editForm[field]}>
                            {editForm[field]}
                          </option>
                        )}
                      {employeePersonalOptions[field].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : ["branch_name", "transfer_branch_name"].includes(
                      field,
                    ) ? (
                    <BranchMasterSelect
                      companyId={editForm.company_id}
                      branchId={
                        field === "branch_name"
                          ? editForm.branch_id
                          : editForm.transfer_branch_id
                      }
                      branchName={editForm[field]}
                      required={field === "branch_name"}
                      style={inputStyle}
                      onChange={(branch) =>
                        setEditForm((current) => ({
                          ...current,
                          ...branchFields(branch, {
                            transfer: field === "transfer_branch_name",
                            userForm: true,
                          }),
                        }))
                      }
                    />
                  ) : field === "transfer_location" ? (
                    <MasterCityInput
                      required
                      value={editForm[field] || ""}
                      onChange={(value) =>
                        setEditForm({ ...editForm, [field]: value })
                      }
                    />
                  ) : (
                    <input
                      readOnly={["branch_id", "transfer_branch_id"].includes(
                        field,
                      )}
                      required={[
                        "joining_date",
                        "designation",
                        "department",
                        "transfer_location",
                        "employee_status",
                        "branch_name",
                        "branch_id",
                      ].includes(field)}
                      type={type}
                      value={editForm[field] || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, [field]: e.target.value })
                      }
                      style={inputStyle}
                    />
                  )}
                </label>
              ))}
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>
          </div>
        </ValidatedForm>
      )}

      <div style={tableWrapStyle}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: "860px",
          }}
        >
          <thead>
            <tr style={{ background: "#17324d", color: "white" }}>
              {[
                "Employee ID",
                "Name",
                "Email",
                "Department",
                "Role",
                "Status",
                "Actions",
              ].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "32px", color: "#64748b" }}>
                  {users.length === 0
                    ? emptyMessageFor(user)
                    : "No users match these filters."}
                </td>
              </tr>
            ) : (
              filtered.map((target) => (
                <tr
                  key={target.user_id}
                  style={{ borderBottom: "1px solid #eef2f6" }}
                >
                  <td style={tdStyle}>{target.employee_id}</td>
                  <td style={{ ...tdStyle, color: "#17324d", fontWeight: 700 }}>
                    {target.first_name} {target.last_name || ""}
                  </td>
                  <td style={tdStyle}>{target.email}</td>
                  <td style={tdStyle}>{target.department || "-"}</td>
                  <td style={tdStyle}>{ROLES[target.role_id] || "Unknown"}</td>
                  <td style={tdStyle}>{target.status}</td>
                  <td
                    style={{
                      ...tdStyle,
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {canManageUser(target) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(target)}
                          style={secondaryButtonStyle}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(target)}
                          style={secondaryButtonStyle}
                        >
                          {target.status === "Active"
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordForm({
                              userId: String(target.user_id),
                              password: "",
                            });
                            setShowPassword(true);
                          }}
                          style={secondaryButtonStyle}
                        >
                          <KeyIcon fontSize="small" />
                          Password
                        </button>
                        {target.role_id === 4 &&
                          [1, 2, 5].includes(user?.role_id) && (
                            <button
                              type="button"
                              onClick={() => upgradeToIc(target)}
                              style={secondaryButtonStyle}
                            >
                              Upgrade to IC
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => deleteUser(target)}
                          style={dangerButtonStyle}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>View only</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LoadingOverlay
        show={loading || saving || bulkUploading}
        title={
          bulkUploading
            ? "Uploading users"
            : saving
              ? "Saving user"
              : "Loading users"
        }
        message={
          bulkUploading
            ? "Validating CSV rows and creating users."
            : saving
              ? "Applying user management changes."
              : "Fetching user list."
        }
      />
    </PortalShell>
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

const sectionLabelStyle = {
  color: "#4A2E83",
  fontSize: "12px",
  fontWeight: 900,
  margin: "8px 0 12px",
  textTransform: "uppercase",
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

const dangerButtonStyle = {
  padding: "7px 10px",
  background: "#fff7f6",
  color: "#c0392b",
  border: "1px solid #f3b4ae",
  borderRadius: "6px",
  cursor: "pointer",
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
