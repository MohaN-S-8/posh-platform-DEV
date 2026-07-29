import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../../api/auth";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { authInputStyle } from "../../styles/formStyles";

const lettersOnly = /^[a-zA-Z\s]+$/;

const signupSchema = z
  .object({
    first_name: z
      .string()
      .trim()
      .min(2, "Minimum 2 characters")
      .max(50, "Maximum 50 characters")
      .regex(lettersOnly, "Only letters allowed"),
    last_name: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(50, "Maximum 50 characters")
      .regex(lettersOnly, "Only letters allowed"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Email is required")
      .email("Invalid email format")
      .max(25, "Maximum 25 characters"),
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .max(15, "Maximum 15 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "Must contain special character"),
    confirm_password: z.string().min(1, "Please confirm password"),
    mobile: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Must be exactly 10 digits"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
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

export function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      await authApi.signup(data);
      navigate("/verify-otp", { state: { email: data.email } });
    } catch (err) {
      setError(err.response?.data?.detail || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand" aria-label="POSH platform home">
        <span className="auth-brand-mark">P</span>
        <span>
          <strong>POSH</strong>
          <small>Training Platform</small>
        </span>
      </Link>

      <section className="auth-card auth-card-lg">
        <div className="auth-card-header">
          <p className="auth-eyebrow">Client onboarding</p>
          <h1>Create account</h1>
          <p>Join the POSH Training Platform and verify your account with OTP.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="auth-form-grid">
            <div>
              <label htmlFor="first_name" style={labelStyle}>
                First Name *
              </label>
              <input
                id="first_name"
                autoComplete="given-name"
                aria-invalid={!!errors.first_name}
                aria-describedby={errors.first_name ? "first_name_error" : undefined}
                {...register("first_name")}
                style={{ ...authInputStyle(!!errors.first_name), borderRadius: "8px" }}
              />
              {errors.first_name && (
                <p id="first_name_error" style={errorStyle}>
                  {errors.first_name.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="last_name" style={labelStyle}>
                Last Name *
              </label>
              <input
                id="last_name"
                autoComplete="family-name"
                aria-invalid={!!errors.last_name}
                aria-describedby={errors.last_name ? "last_name_error" : undefined}
                {...register("last_name")}
                style={{ ...authInputStyle(!!errors.last_name), borderRadius: "8px" }}
              />
              {errors.last_name && (
                <p id="last_name_error" style={errorStyle}>
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label htmlFor="email" style={labelStyle}>
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email_error" : undefined}
              {...register("email")}
              style={{ ...authInputStyle(!!errors.email), borderRadius: "8px" }}
            />
            {errors.email && (
              <p id="email_error" style={errorStyle}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div style={{ marginTop: "16px" }}>
            <label htmlFor="mobile" style={labelStyle}>
              Mobile Number *
            </label>
            <input
              id="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              aria-invalid={!!errors.mobile}
              aria-describedby={errors.mobile ? "mobile_error" : undefined}
              {...register("mobile")}
              placeholder="10 digit number"
              style={{ ...authInputStyle(!!errors.mobile), borderRadius: "8px" }}
            />
            {errors.mobile && (
              <p id="mobile_error" style={errorStyle}>
                {errors.mobile.message}
              </p>
            )}
          </div>

          <div style={{ marginTop: "16px" }}>
            <label htmlFor="password" style={labelStyle}>
              Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password_error password_help" : "password_help"
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
                style={passwordToggleStyle}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </button>
            </div>
            {errors.password && (
              <p id="password_error" style={errorStyle}>
                {errors.password.message}
              </p>
            )}
            <p
              id="password_help"
              className="auth-help-text"
            >
              8-15 characters, uppercase, lowercase, number, special character
            </p>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label htmlFor="confirm_password" style={labelStyle}>
              Confirm Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={!!errors.confirm_password}
                aria-describedby={
                  errors.confirm_password ? "confirm_password_error" : undefined
                }
                {...register("confirm_password")}
                style={{
                  ...authInputStyle(!!errors.confirm_password),
                  paddingRight: "46px",
                  borderRadius: "8px",
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                style={passwordToggleStyle}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                title={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </button>
            </div>
            {errors.confirm_password && (
              <p id="confirm_password_error" style={errorStyle}>
                {errors.confirm_password.message}
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className="auth-error auth-error-spaced">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="auth-submit-btn"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-footer-links">
          <span>
            Already have an account?{" "}
            <Link to="/login">Sign in</Link>
          </span>
        </div>
        <LoadingOverlay
          show={loading}
          title="Creating account"
          message="Saving your account and sending the OTP email."
        />
      </section>
    </div>
  );
}
