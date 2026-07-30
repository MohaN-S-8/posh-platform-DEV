import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
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
const loginErrorStorageKey = "posh_login_error";
const loginErrorVisibleMs = 60 * 1000;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState(() => sessionStorage.getItem(loginErrorStorageKey) || "");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => {
      setError("");
      sessionStorage.removeItem(loginErrorStorageKey);
    }, loginErrorVisibleMs);
    return () => window.clearTimeout(timer);
  }, [error]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    sessionStorage.removeItem(loginErrorStorageKey);
    try {
      const res = await authApi.login(data);
      const { access_token, user_id, role_id, company_id, permissions } = res.data;
      sessionStorage.removeItem(loginErrorStorageKey);
      setAuth({ user_id, role_id, company_id, permissions: permissions || [] }, access_token);

      if ([1, 2, 3, 4, 5].includes(role_id)) {
        navigate("/dashboard");
      } else {
        navigate("/unauthorized");
      }
    } catch (err) {
      let nextError = "Invalid email or password.";
      if (err.response?.status === 423) {
        nextError = apiErrorMessage(err, "Account locked. Try again later.");
      } else if (err.response?.status === 403) {
        nextError = apiErrorMessage(err, "Your account is inactive. Contact your administrator.");
      }
      sessionStorage.setItem(loginErrorStorageKey, nextError);
      setError(nextError);
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
    <div className="auth-page">
      <Link to="/" className="auth-brand" aria-label="POSH platform home">
        <span className="auth-brand-mark">P</span>
        <span>
          <strong>POSH</strong>
          <small>Training Platform</small>
        </span>
      </Link>

      <section className="auth-card auth-card-sm">
        <div className="auth-card-header">
          <p className="auth-eyebrow">Secure access</p>
          <h1>Welcome back</h1>
          <p>Sign in to manage POSH training, compliance, and certificates.</p>
        </div>

        {showDevCredentials && (
          <div className="auth-dev-box">
            <div>Default development logins</div>
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
                borderRadius: "8px",
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
                  borderRadius: "8px",
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
            <div role="alert" className="auth-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
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

        <div className="auth-footer-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span>
            New here? <Link to="/signup">Create account</Link>
          </span>
        </div>
        <LoadingOverlay
          show={loading && !error}
          title="Signing in"
          message="Checking your account and opening your dashboard."
        />
      </section>
    </div>
  );
}
