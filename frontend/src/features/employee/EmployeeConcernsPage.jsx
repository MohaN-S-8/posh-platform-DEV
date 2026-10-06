import { ValidatedForm } from "../../components/ValidatedForm";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SendIcon from "@mui/icons-material/Send";
import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";

const workflowStages = [
  "Received",
  "Notice",
  "Enquiry",
  "Enq. Completed",
  "Recommendation",
  "Executed",
  "Closed",
];

const initialForm = {
  category: "POSH complaint",
  message: "",
  incident_date: "",
  evidence_note: "",
};

export function EmployeeConcernsPage() {
  const [form, setForm] = useState(initialForm);
  const [concerns, setConcerns] = useState([]);
  const [selectedConcernId, setSelectedConcernId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedConcern = useMemo(
    () =>
      concerns.find((concern) => concern.id === selectedConcernId) ||
      concerns[0] ||
      null,
    [concerns, selectedConcernId],
  );

  const loadConcerns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/concerns/my");
      const rows = res.data || [];
      setConcerns(rows);
      if (!selectedConcernId && rows.length > 0) {
        setSelectedConcernId(rows[0].id);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load your complaints."));
    } finally {
      setLoading(false);
    }
  }, [selectedConcernId]);

  useEffect(() => {
    const timer = window.setTimeout(loadConcerns, 0);
    return () => window.clearTimeout(timer);
  }, [loadConcerns]);

  const submitConcern = async (event, categoryOverride) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/concerns/", {
        category: categoryOverride || form.category,
        message: form.message.trim(),
        incident_date: form.incident_date,
        evidence_note: form.evidence_note.trim(),
      });
      setSuccess("Complaint submitted successfully.");
      setForm(initialForm);
      await loadConcerns();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to submit complaint."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell
      title="POSH Complaints"
      subtitle="File in confidence. Track without exposure. Resolve on time."
    >
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <div style={topGridStyle}>
        <ValidatedForm
          error={error}
          onSubmit={submitConcern}
          className="portal-card"
          style={{ display: "grid", gap: "12px" }}
        >
          <div className="portal-section-title" style={{ marginTop: 0 }}>
            File a Complaint
          </div>
          <label style={labelStyle}>
            Nature of Incident
            <textarea
              required
              rows={5}
              minLength={5}
              maxLength={2000}
              value={form.message}
              onChange={(event) =>
                setForm({ ...form, message: event.target.value })
              }
              placeholder="Describe what happened"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>
          <label style={labelStyle}>
            Date(s) of Incident
            <input
              type="text"
              value={form.incident_date}
              onChange={(event) =>
                setForm({ ...form, incident_date: event.target.value })
              }
              placeholder="dd/mm/yyyy"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Upload Evidence
            <input
              value={form.evidence_note}
              onChange={(event) =>
                setForm({ ...form, evidence_note: event.target.value })
              }
              placeholder="Attach documents / screenshots"
              style={inputStyle}
            />
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={submitting}
              className="portal-primary-btn"
            >
              <SendIcon fontSize="small" />
              {submitting ? "Submitting..." : "Submit Complaint"}
            </button>
            <button
              type="button"
              className="portal-outline-btn"
              disabled={submitting || !form.message.trim()}
              onClick={(event) => submitConcern(event, "Informal concern")}
            >
              Raise an Informal Concern
            </button>
          </div>
        </ValidatedForm>

        <section
          className="portal-card"
          style={{ display: "grid", gap: "14px" }}
        >
          <div className="portal-section-title" style={{ margin: 0 }}>
            My Complaint Status{" "}
            {selectedConcern ? `- Case ${caseNumber(selectedConcern)}` : ""}
          </div>
          {selectedConcern ? (
            <>
              <StageTimeline stage={selectedConcern.stage || 1} />
              <p
                style={{
                  margin: 0,
                  color: "var(--portal-muted)",
                  lineHeight: 1.55,
                }}
              >
                Filed {formatDate(selectedConcern.created_date)}.{" "}
                {selectedConcern.status === "Closed"
                  ? "This case is closed."
                  : `${selectedConcern.days_left ?? "-"} enquiry days remaining.`}{" "}
                Currently:{" "}
                <strong>
                  {selectedConcern.stage_label || selectedConcern.status}
                </strong>
                . No further detail is shown here to protect confidentiality.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: "var(--portal-muted)" }}>
              Your complaint status will appear after submission.
            </p>
          )}
        </section>
      </div>

      <div style={workspaceNoticeStyle}>
        IC Workspace - visible only to Internal Committee members.
      </div>

      <div className="portal-section-title">My Complaints</div>
      {!loading && concerns.length === 0 ? (
        <div
          className="portal-card"
          style={{ textAlign: "center", padding: "34px" }}
        >
          <ReportProblemIcon
            style={{ color: "var(--portal-pink)", fontSize: 42 }}
          />
          <h2 style={{ margin: "10px 0 6px", fontSize: "18px" }}>
            No complaints submitted
          </h2>
          <p style={{ color: "var(--portal-muted)", margin: 0 }}>
            Submitted complaints and their status will appear here.
          </p>
        </div>
      ) : (
        <div className="portal-card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th>Case #</th>
                <th>Filed</th>
                <th>Days Left (90)</th>
                <th>Stage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {concerns.map((concern) => (
                <tr key={concern.id}>
                  <td>{caseNumber(concern)}</td>
                  <td>{formatDate(concern.created_date)}</td>
                  <td>
                    {concern.status === "Closed"
                      ? "-"
                      : (concern.days_left ?? "-")}
                  </td>
                  <td>
                    <span style={stageBadgeStyle(concern.stage)}>
                      {concern.stage_label || concern.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="portal-link-btn"
                      onClick={() => setSelectedConcernId(concern.id)}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LoadingOverlay
        show={loading || submitting}
        title={submitting ? "Submitting complaint" : "Loading complaints"}
        message={
          submitting
            ? "Sending your complaint securely."
            : "Fetching your submissions."
        }
      />
    </PortalShell>
  );
}

function StageTimeline({ stage }) {
  return (
    <div style={timelineStyle}>
      {workflowStages.map((label, index) => {
        const step = index + 1;
        const complete = step < stage;
        const active = step === stage;
        return (
          <div key={label} style={timelineStepStyle}>
            <div
              style={timelineLineStyle(step, workflowStages.length, complete)}
            />
            <div style={timelineDotStyle(complete, active)}>
              {complete ? "✓" : step}
            </div>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

StageTimeline.propTypes = {
  stage: PropTypes.number.isRequired,
};

const caseNumber = (concern) =>
  `#SC-${new Date(concern.created_date || Date.now()).getFullYear()}-${String(concern.id).padStart(3, "0")}`;

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
};

const topGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr)",
  gap: "18px",
  marginBottom: "18px",
};

const labelStyle = {
  color: "var(--portal-purple)",
  fontWeight: 700,
  fontSize: "13px",
  display: "grid",
  gap: "6px",
};

const inputStyle = {
  width: "100%",
  minHeight: "38px",
  padding: "9px 11px",
  border: "1px solid var(--portal-border)",
  borderRadius: "6px",
  fontSize: "13px",
  boxSizing: "border-box",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const workspaceNoticeStyle = {
  background: "#fff0f3",
  border: "1px solid #ffb3c2",
  borderRadius: "8px",
  color: "#9f1239",
  fontWeight: 700,
  padding: "12px 14px",
  fontSize: "13px",
  marginBottom: "18px",
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

const timelineStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(68px, 1fr))",
  gap: "4px",
  overflowX: "auto",
  padding: "8px 0",
};

const timelineStepStyle = {
  position: "relative",
  display: "grid",
  justifyItems: "center",
  gap: "6px",
  color: "var(--portal-muted)",
  fontSize: "11px",
  minWidth: "68px",
};

const timelineLineStyle = (step, total, complete) => ({
  position: "absolute",
  top: "12px",
  left: step === 1 ? "50%" : 0,
  right: step === total ? "50%" : 0,
  height: "2px",
  background: complete ? "#2eaa6f" : "#d9deea",
  zIndex: 0,
});

const timelineDotStyle = (complete, active) => ({
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: complete ? "#2eaa6f" : active ? "var(--portal-pink)" : "#e2e8f0",
  color: complete || active ? "#fff" : "#64748b",
  fontWeight: 800,
  position: "relative",
  zIndex: 1,
});

const stageBadgeStyle = (stage) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "24px",
  padding: "0 9px",
  borderRadius: "999px",
  background: stage >= 7 ? "#e8f5ee" : stage >= 5 ? "#e6f7f0" : "#fff6dc",
  color: stage >= 7 ? "#1f7a4d" : stage >= 5 ? "#10724d" : "#8a5a00",
  fontWeight: 800,
  fontSize: "11px",
});
