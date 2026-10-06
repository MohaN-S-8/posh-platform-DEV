export const employeePersonalOptions = {
  physically_challenged: ["Yes", "No"],
  marital_status: ["Single", "Married"],
  employment_status: ["Permanent", "Temporary"],
  employee_status: ["Employed", "Unemployed"],
};

export function normalizeEmployeeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["employed", "active"].includes(status)) return "Employed";
  if (["unemployed", "inactive", "resigned"].includes(status)) return "Unemployed";
  return value || "";
}

export function showEmploymentField(field, status) {
  if (["employee_status", "ic_role"].includes(field)) return true;
  if (["resignation_date", "resignation_reason"].includes(field)) return status === "Unemployed";
  return status === "Employed";
}
