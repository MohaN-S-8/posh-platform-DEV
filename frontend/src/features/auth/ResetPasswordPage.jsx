import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
// import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";

const schema = z
  .object({
    new_password: z
      .string()
      .min(8)
      .max(15)
      .regex(/[A-Z]/, "Needs uppercase")
      .regex(/[a-z]/, "Needs lowercase")
      .regex(/[0-9]/, "Needs number")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "Needs special character"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({ resolver: zodResolver(schema), mode: "onChange" });

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      await authApi.resetPassword(
        token,
        data.new_password,
        data.confirm_password,
      );
      navigate("/login", {
        state: { message: "Password reset successfully. Please log in." },
      });
    } catch (err) {
      setError(
        err.response?.data?.detail || "Reset failed. Token may have expired.",
      );
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
        <h1 style={{ color: "#1a3c5e", marginBottom: "8px" }}>
          Reset Password
        </h1>
        <p style={{ color: "#666", marginBottom: "32px" }}>
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}
            >
              New Password *
            </label>
            <input
              type="password"
              {...register("new_password")}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: `1px solid ${errors.new_password ? "#e74c3c" : "#ddd"}`,
                borderRadius: "6px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            {errors.new_password && (
              <p
                style={{ color: "#e74c3c", fontSize: "12px", marginTop: "4px" }}
              >
                {errors.new_password.message}
              </p>
            )}
          </div>

          <div>
            <label
              style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}
            >
              Confirm Password *
            </label>
            <input
              type="password"
              {...register("confirm_password")}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: `1px solid ${errors.confirm_password ? "#e74c3c" : "#ddd"}`,
                borderRadius: "6px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            {errors.confirm_password && (
              <p
                style={{ color: "#e74c3c", fontSize: "12px", marginTop: "4px" }}
              >
                {errors.confirm_password.message}
              </p>
            )}
          </div>

          {error && (
            <div
              style={{
                background: "#fdf0f0",
                border: "1px solid #e74c3c",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#e74c3c",
                fontSize: "14px",
                marginTop: "16px",
              }}
            >
              {error}
            </div>
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
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
