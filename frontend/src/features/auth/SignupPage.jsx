import { Link } from "react-router-dom";

export function SignupPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fa",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: "460px",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#1a3c5e", marginBottom: "10px" }}>Account Creation</h1>
        <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: "24px" }}>
          Public signup is disabled. User accounts are created through the role-based User
          Management flow.
        </p>
        <Link
          to="/login"
          style={{
            display: "inline-block",
            padding: "12px 18px",
            background: "#1a3c5e",
            color: "white",
            borderRadius: "6px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}