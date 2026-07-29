import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import { useEffect, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

export function AdminConcernsPage() {
  const { user } = useAuthStore();
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let active = true;
    const loadConcerns = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/concerns/received");
        if (active) setConcerns(res.data || []);
      } catch (err) {
        if (active) {
          setError(apiErrorMessage(err, "Unable to load received concerns."));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadConcerns();
    return () => {
      active = false;
    };
  }, []);

  const updateConcernStatus = async (concernId, nextStatus) => {
    setUpdatingId(concernId);
    setError("");
    try {
      const res = await apiClient.patch(`/concerns/${concernId}/status`, {
        status: nextStatus,
      });
      setConcerns((current) =>
        current.map((concern) =>
          concern.id === concernId
            ? { ...concern, status: res.data?.status || nextStatus }
            : concern,
        ),
      );
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to update concern status."));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <PortalShell
      title="Concerns Received"
      subtitle={
        user?.role_id === 1
          ? "Review concerns submitted across all companies."
          : "Review concerns submitted by users in your company."
      }
    >
      {error && (
        <div
          className="portal-card"
          style={{ borderColor: "#f3b4ae", background: "#fff7f6", color: "#c0392b" }}
        >
          {error}
        </div>
      )}

      {!loading && concerns.length === 0 ? (
        <div className="portal-card" style={{ textAlign: "center", padding: "34px" }}>
          <ReportProblemIcon style={{ color: "var(--portal-pink)", fontSize: 42 }} />
          <h2 style={{ margin: "10px 0 6px", fontSize: "18px" }}>No concerns received</h2>
          <p style={{ color: "var(--portal-muted)", margin: 0 }}>
            Submitted concerns from company users will appear here.
          </p>
        </div>
      ) : (
        <section className="portal-grid">
          {concerns.map((concern) => (
            <article key={concern.id} className="portal-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <div className="portal-section-title" style={{ marginBottom: "4px" }}>
                    {concern.category}
                  </div>
                  <div style={{ color: "var(--portal-muted)", fontSize: "13px" }}>
                    {concern.reporter_name || "User"} - {concern.reporter_email || "-"}
                  </div>
                  {user?.role_id === 1 && (
                    <div style={{ color: "var(--portal-muted)", fontSize: "13px", marginTop: "4px" }}>
                      Company ID: {concern.company_id}
                    </div>
                  )}
                </div>
                <span className="portal-badge portal-badge-purple">{concern.status}</span>
              </div>
              <p style={{ color: "var(--portal-text)", lineHeight: 1.55, margin: 0 }}>
                {concern.message}
              </p>
              {concern.created_date && (
                <div style={{ color: "var(--portal-muted)", fontSize: "12px", marginTop: "12px" }}>
                  Submitted {new Date(concern.created_date).toLocaleString()}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                {concern.status !== "Reviewed" && concern.status !== "Closed" && (
                  <button
                    type="button"
                    className="portal-outline-btn"
                    disabled={updatingId === concern.id}
                    onClick={() => updateConcernStatus(concern.id, "Reviewed")}
                  >
                    Mark Reviewed
                  </button>
                )}
                {concern.status !== "Closed" && (
                  <button
                    type="button"
                    className="portal-primary-btn"
                    disabled={updatingId === concern.id}
                    onClick={() => updateConcernStatus(concern.id, "Closed")}
                  >
                    Close
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      <LoadingOverlay
        show={loading}
        title="Loading concerns"
        message="Fetching received concern submissions."
      />
    </PortalShell>
  );
}
