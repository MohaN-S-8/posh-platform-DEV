import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SendIcon from "@mui/icons-material/Send";
import { useEffect, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const initialForm = {
  category: "Workplace concern",
  message: "",
};

export function EmployeeConcernsPage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState(initialForm);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadConcerns = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/concerns/my");
      setConcerns(res.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load your concerns."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadConcerns, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submitConcern = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/concerns/", {
        category: form.category,
        message: form.message.trim(),
      });
      setSuccess("Concern submitted successfully.");
      setForm(initialForm);
      await loadConcerns();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to submit concern."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell
      title="Raise Concern"
      subtitle={
        user?.role_id === 3
          ? "Submit your own workplace or PoSH concern as an IC member."
          : "Submit workplace or PoSH concerns to your company administrator."
      }
    >
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <form onSubmit={submitConcern} className="portal-card" style={{ marginBottom: "20px" }}>
        <div className="portal-section-title" style={{ marginTop: 0 }}>
          Concern Details
        </div>
        <div style={{ display: "grid", gap: "14px" }}>
          <label style={labelStyle}>
            Category
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              style={inputStyle}
            >
              <option>Workplace concern</option>
              <option>POSH complaint</option>
              <option>Training issue</option>
              <option>Certificate issue</option>
              <option>Technical support</option>
            </select>
          </label>
          <label style={labelStyle}>
            Details
            <textarea
              required
              rows={6}
              minLength={5}
              maxLength={2000}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              placeholder="Write your concern clearly"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting || !form.message.trim()}
          className="portal-primary-btn"
          style={{ marginTop: "16px" }}
        >
          <SendIcon fontSize="small" />
          {submitting ? "Submitting..." : "Submit Concern"}
        </button>
      </form>

      <div className="portal-section-title">My Concerns</div>
      {!loading && concerns.length === 0 ? (
        <div className="portal-card" style={{ textAlign: "center", padding: "34px" }}>
          <ReportProblemIcon style={{ color: "var(--portal-pink)", fontSize: 42 }} />
          <h2 style={{ margin: "10px 0 6px", fontSize: "18px" }}>No concerns submitted</h2>
          <p style={{ color: "var(--portal-muted)", margin: 0 }}>
            Submitted concerns and their status will appear here.
          </p>
        </div>
      ) : (
        <section className="portal-grid">
          {concerns.map((concern) => (
            <article key={concern.id} className="portal-card">
              <div style={cardHeadStyle}>
                <div>
                  <div className="portal-section-title" style={{ marginBottom: "4px" }}>
                    {concern.category}
                  </div>
                  {concern.created_date && (
                    <div style={{ color: "var(--portal-muted)", fontSize: "12px" }}>
                      Submitted {new Date(concern.created_date).toLocaleString()}
                    </div>
                  )}
                </div>
                <span style={statusBadgeStyle(concern.status)}>{concern.status}</span>
              </div>
              <p style={{ color: "var(--portal-text)", lineHeight: 1.55, margin: 0 }}>
                {concern.message}
              </p>
            </article>
          ))}
        </section>
      )}

      <LoadingOverlay
        show={loading || submitting}
        title={submitting ? "Submitting concern" : "Loading concerns"}
        message={submitting ? "Sending your concern to admin." : "Fetching your submissions."}
      />
    </PortalShell>
  );
}

const labelStyle = {
  color: "var(--portal-purple)",
  fontWeight: 700,
  fontSize: "13px",
  display: "grid",
  gap: "6px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const cardHeadStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "12px",
};

const statusBadgeStyle = (status) => {
  const palette = {
    Open: { background: "#fff8e8", color: "#704600", border: "#f0d7a8" },
    Reviewed: { background: "#f1eafb", color: "var(--portal-purple)", border: "#ddcbf3" },
    Closed: { background: "#e8f5ee", color: "#1f7a4d", border: "#b9dfca" },
  };
  const colors = palette[status] || palette.Open;
  return {
    display: "inline-flex",
    alignItems: "center",
    height: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.color,
    fontWeight: 700,
    fontSize: "12px",
  };
};

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};

const successStyle = {
  background: "#e8f5ee",
  border: "1px solid #1f7a4d",
  borderRadius: "8px",
  color: "#1f7a4d",
  padding: "12px 14px",
  marginBottom: "18px",
};
