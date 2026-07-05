export const authInputStyle = (hasError = false) => ({
  display: "block",
  width: "100%",
  height: "44px",
  padding: "10px 14px",
  border: `1.5px solid ${hasError ? "#e74c3c" : "#cfd7df"}`,
  borderRadius: "6px",
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: "14px",
  lineHeight: "20px",
  boxSizing: "border-box",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
  boxShadow: hasError
    ? "0 0 0 3px rgba(231, 76, 60, 0.12)"
    : "0 1px 2px rgba(16, 24, 40, 0.06)",
});
