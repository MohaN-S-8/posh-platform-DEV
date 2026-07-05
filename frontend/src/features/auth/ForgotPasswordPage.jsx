import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";

const schema = z.object({
  email: z.string().email("Invalid email format"),
});

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({ resolver: zodResolver(schema), mode: "onChange" });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authApi.forgotPassword(data.email);
      setSubmitted(true);
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
          maxWidth: "420px",
        }}
      >
        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ color: "#27ae60" }}>✓ Email Sent</h2>
            <p style={{ color: "#666", marginTop: "12px" }}>
              If your email is registered, you will receive password reset
              instructions.
            </p>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                marginTop: "24px",
                color: "#1a3c5e",
                fontWeight: 600,
              }}
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ color: "#1a3c5e", marginBottom: "8px" }}>
              Forgot Password
            </h1>
            <p style={{ color: "#666", marginBottom: "32px" }}>
              Enter your email and we`&#39;ll send you reset instructions.
            </p>
            <form onSubmit={handleSubmit(onSubmit)}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 500,
                }}
              >
                Email Address *
              </label>
              <input
                type="email"
                {...register("email")}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: `1px solid ${errors.email ? "#e74c3c" : "#ddd"}`,
                  borderRadius: "6px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              {errors.email && (
                <p
                  style={{
                    color: "#e74c3c",
                    fontSize: "12px",
                    marginTop: "4px",
                  }}
                >
                  {errors.email.message}
                </p>
              )}
              <button
                type="submit"
                disabled={!isValid || loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  marginTop: "24px",
                  background: !isValid || loading ? "#93b8d4" : "#1a3c5e",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: !isValid || loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Sending..." : "Send Reset Instructions"}
              </button>
            </form>
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <Link to="/login" style={{ color: "#1a3c5e", fontSize: "14px" }}>
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
