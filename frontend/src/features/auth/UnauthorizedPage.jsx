import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const signInAgain = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f6f8fb",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          background: "white",
          borderRadius: "8px",
          padding: "32px",
          boxShadow: "0 8px 28px rgba(15, 23, 42, 0.1)",
          border: "1px solid #e2e8f0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 18px",
            background: "#fff5df",
            color: "#9a6400",
            fontSize: "26px",
            fontWeight: 800,
          }}
        >
          !
        </div>
        <h1 style={{ color: "#17324d", margin: "0 0 8px", fontSize: "28px" }}>
          Access Denied
        </h1>
        <p style={{ color: "#667085", margin: "0 0 24px", lineHeight: 1.6 }}>
          You do not have permission to open this page. Sign in with an account
          that has the right role, or return to your dashboard.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: "10px 18px",
              background: "#eef4f8",
              color: "#17324d",
              border: "1px solid #cdd9e2",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={signInAgain}
            style={{
              padding: "10px 18px",
              background: "#17324d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Sign In Again
          </button>
        </div>
      </div>
    </div>
  );
}
