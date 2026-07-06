export function apiErrorMessage(error, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const path = Array.isArray(item?.loc) ? item.loc.join(".") : "";
        const message = item?.msg || "Invalid value";
        return path ? `${path}: ${message}` : message;
      })
      .join(" ");
  }
  return fallback;
}
