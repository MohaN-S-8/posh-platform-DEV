import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { useAuthStore } from "../../store/authStore";

function dashboardForRole(roleId) {
  if (roleId === 1 || roleId === 2) return "/admin";
  if (roleId === 3) return "/hr";
  if (roleId === 4) return "/employee";
  return "/unauthorized";
}

export function EntraCallbackPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const rawParams = window.location.hash
    ? window.location.hash.slice(1)
    : window.location.search.slice(1);
  const params = new URLSearchParams(rawParams);
  const accessToken = params.get("access_token");
  const userId = Number(params.get("user_id"));
  const roleId = Number(params.get("role_id"));
  const companyId = Number(params.get("company_id"));
  const error =
    !accessToken || !userId || !roleId || !companyId
      ? "Microsoft Entra sign-in did not return a complete session."
      : "";

  useEffect(() => {
    if (error) {
      return;
    }

    setAuth(
      { user_id: userId, role_id: roleId, company_id: companyId },
      accessToken,
    );
    navigate(dashboardForRole(roleId), { replace: true });
  }, [accessToken, companyId, error, navigate, roleId, setAuth, userId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5f7fa",
        padding: "20px",
      }}
    >
      {error ? (
        <div
          role="alert"
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "#ffffff",
            border: "1px solid #e74c3c",
            borderRadius: "8px",
            padding: "20px",
            color: "#c0392b",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <strong>Sign-in failed</strong>
          <p style={{ margin: "8px 0 16px" }}>{error}</p>
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            style={{
              padding: "10px 18px",
              background: "#17324d",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Return to login
          </button>
        </div>
      ) : (
        <LoadingOverlay
          show
          title="Completing sign-in"
          message="Opening your dashboard."
        />
      )}
    </div>
  );
}
