import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { authInputStyle } from "../../styles/formStyles";
import { useAuthStore } from "../../store/authStore";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(25, "Email must be at most 25 characters"),
  password: z
    .string()
    .min(8, "Minimum 8 characters")
    .max(15, "Maximum 15 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain special character"),
});

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 500,
};

const errorStyle = {
  color: "#e74c3c",
  fontSize: "12px",
  marginTop: "4px",
};

const passwordToggleStyle = {
  position: "absolute",
  right: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: "#5f6f7f",
  cursor: "pointer",
  width: "32px",
  height: "32px",
  display: "grid",
  placeItems: "center",
  padding: 0,
};

const showDevCredentials =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_CREDENTIALS === "true";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(data);
      const { access_token, user_id, role_id, company_id } = res.data;
      setAuth({ user_id, role_id, company_id }, access_token);

      if (role_id === 1 || role_id === 2) navigate("/admin");
      else if (role_id === 3) navigate("/hr");
      else if (role_id === 4) navigate("/employee");
      else navigate("/unauthorized");
    } catch (err) {
      if (err.response?.status === 423) {
        setError(apiErrorMessage(err, "Account locked. Try again later."));
      } else if (err.response?.status === 403) {
        setError(
          apiErrorMessage(err, "Your account is inactive. Contact your administrator."),
        );
      } else {
        setError(apiErrorMessage(err, "Invalid email or password."));
      }
    } finally {
      setLoading(false);
    }
  };

  // const startEntraLogin = async () => {
  //   setLoading(true);
  //   setError("");
  //   try {
  //     const res = await authApi.entraStart();
  //     window.location.href = res.data.auth_url;
  //   } catch (err) {
  //     setError(apiErrorMessage(err, "Microsoft Entra SSO is not configured."));
  //     setLoading(false);
  //   }
  // };

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
          maxWidth: "420px",
        }}
      >
        <h1
          style={{ color: "#1a3c5e", marginBottom: "8px", textAlign: "center" }}
        >
          POSH Training Platform
        </h1>
        <p style={{ color: "#666", textAlign: "center", marginBottom: "16px" }}>
          Sign in to your account
        </p>

        {showDevCredentials && (
          <div
            style={{
              background: "#eef4f8",
              border: "1px solid #cdd9e2",
              borderRadius: "8px",
              padding: "12px 14px",
              marginBottom: "24px",
              fontSize: "13px",
              color: "#17324d",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>
              Default development logins
            </div>
            <div>Admin: admin@posh.com / Admin@1234</div>
            <div>HR: hr@posh.com / Admin@1234</div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="email" style={labelStyle}>
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email_error" : undefined}
              {...register("email")}
              style={{
                ...authInputStyle(!!errors.email),
                width: "100%",
                height: "44px",
                display: "block",
                backgroundColor: "#ffffff",
                border: `1.5px solid ${errors.email ? "#e74c3c" : "#cfd7df"}`,
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
            />
            {errors.email && (
              <p id="email_error" role="alert" style={errorStyle}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="password" style={labelStyle}>
              Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password_error" : undefined
                }
                {...register("password")}
                style={{
                  ...authInputStyle(!!errors.password),
                  paddingRight: "46px",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                style={passwordToggleStyle}
              >
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </button>
            </div>
            {errors.password && (
              <p id="password_error" role="alert" style={errorStyle}>
                {errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: "#fdf0f0",
                border: "1px solid #e74c3c",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#e74c3c",
                fontSize: "14px",
                marginBottom: "16px",
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
              background: !isValid || loading ? "#93b8d4" : "#1a3c5e",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: 600,
              cursor: !isValid || loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* <button
          type="button"
          onClick={startEntraLogin}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: "12px",
            padding: "12px",
            background: "#ffffff",
            color: "#1a3c5e",
            border: "1px solid #cfd7df",
            borderRadius: "6px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Sign in with Microsoft Entra
        </button> */}

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <Link
            to="/forgot-password"
            style={{ color: "#1a3c5e", fontSize: "14px" }}
          >
            Forgot password?
          </Link>
        </div>
        <div style={{ textAlign: "center", marginTop: "12px" }}>
          <span style={{ fontSize: "14px", color: "#666" }}>
            Don&apos;t have an account?{" "}
            <Link to="/signup" style={{ color: "#1a3c5e", fontWeight: 600 }}>
              Sign up
            </Link>
          </span>
        </div>
        <LoadingOverlay
          show={loading}
          title="Signing in"
          message="Checking your account and opening your dashboard."
        />
      </div>
    </div>
  );
}
