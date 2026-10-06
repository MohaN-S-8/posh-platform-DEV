const personalLabels = new Set(["first name", "last name", "full name", "father name", "father's name", "contact person", "presiding officer", "presiding officer name", "resource person"]);
export function inputValidationMessage(control, label) {
  if (control.tagName !== "INPUT" || ["file", "search", "checkbox", "radio", "hidden"].includes(control.type) || control.readOnly) return "";
  const value = control.value.trim();
  if (!value) return "";
  const field = label.toLowerCase().replace(/\s*\(optional\)\s*/g, "").replace(/\s*\*$/, "").trim();
  const rule = control.dataset.validation;
  if (rule === "person" || personalLabels.has(field)) {
    if (!/\p{L}/u.test(value) || !/^[\p{L}\p{M} .'’-]+$/u.test(value)) return `${label} must contain letters, spaces, initials, apostrophes or hyphens only.`;
  }
  if (rule === "international-phone") {
    if (!/^\+?[0-9 ()-]+$/.test(value) || value.replace(/\D/g, "").length < 7 || value.replace(/\D/g, "").length > 15) return `${label} must contain 7 to 15 digits with an optional country code.`;
  } else if (rule === "phone" || /^(mobile( number| no\.?)?|contact( number| no\.?)|emergency contact( number)?|phone( number)?)$/.test(field)) {
    if (!/^[0-9]{10}$/.test(value)) return `${label} must contain exactly 10 digits.`;
  }
  if (control.type === "email" || /^(email|email id|email address)$/.test(field)) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `${label} must be a valid email address.`;
  }
  if (/^(pincode|pin code)$/.test(field) && !/^[0-9]{6}$/.test(value)) return `${label} must contain exactly 6 digits.`;
  if (/^pan( number| no\.?)?$/.test(field) && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(value)) return `${label} must contain 5 letters, 4 digits and 1 letter.`;
  if (/^(employee id|id no|id no\.|username)$/.test(field) && !/^[A-Za-z0-9@._/-]+$/.test(value)) return `${label} may contain letters, digits, @, dots, underscores, slashes and hyphens only.`;
  if (control.type === "number" && (!Number.isFinite(Number(value)) || (Number(value) < 0 && !(Number(control.min) < 0)))) return `${label} must be a non-negative number.`;
  return "";
}
