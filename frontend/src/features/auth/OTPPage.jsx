import { useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { authApi } from "../../api/auth";

export function OTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // one digit per box
    setOtp(newOtp);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authApi.verifyOtp(email, code);
      navigate("/login", {
        state: { message: "Registration completed successfully." },
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7fa",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#1a3c5e", marginBottom: "8px" }}>
          Verify Your Email
        </h1>
        <p style={{ color: "#666", marginBottom: "8px" }}>
          Enter the 6-digit code sent to
        </p>
        <p style={{ color: "#1a3c5e", fontWeight: 600, marginBottom: "32px" }}>
          {email}
        </p>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              marginBottom: "24px",
            }}
          >
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                aria-label={`OTP digit ${i + 1}`}
                style={{
                  width: "48px",
                  height: "56px",
                  textAlign: "center",
                  fontSize: "24px",
                  fontWeight: 700,
                  border: "2px solid #ddd",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            ))}
          </div>

          {error && (
            <p style={{ color: "#e74c3c", marginBottom: "16px" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={otp.join("").length !== 6 || loading}
            style={{
              width: "100%",
              padding: "12px",
              background:
                otp.join("").length !== 6 || loading ? "#93b8d4" : "#1a3c5e",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: 600,
              cursor:
                otp.join("").length !== 6 || loading
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <p style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
          Didn`&#39;t receive the code?{" "}
          <Link to="/signup" style={{ color: "#1a3c5e" }}>
            Go back to signup
          </Link>
        </p>
      </div>
    </div>
  );
}
