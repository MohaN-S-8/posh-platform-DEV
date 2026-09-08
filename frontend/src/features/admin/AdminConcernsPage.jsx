import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import PrintIcon from "@mui/icons-material/Print";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const workflowStages = [
  "Received",
  "Notice",
  "Enquiry",
  "Enq. Completed",
  "Recommendation",
  "Executed",
  "Closed",
];

const emptyManageForm = {
  stage: 1,
  status: "Open",
  notice_date: "",
  enquiry_sessions: [],
  recommendation_text: "",
  recommendation_date: "",
  recommendation_file: "",
  execution_text: "",
  execution_date: "",
  closure_note: "",
  closure_date: "",
};

export function AdminConcernsPage() {
  const { user } = useAuthStore();
  const [concerns, setConcerns] = useState([]);
  const [selectedConcernId, setSelectedConcernId] = useState(null);
  const [form, setForm] = useState(emptyManageForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canManage = [1, 3, 5].includes(user?.role_id);
  const selectedConcern =
    concerns.find((concern) => concern.id === selectedConcernId) || null;

  const groupedConcernSections = useMemo(() => {
    if (![1, 2].includes(user?.role_id)) {
      return [{ title: "", concerns }];
    }
    const groups = new Map();
    concerns.forEach((concern) => {
      const title =
        concern.company_name ||
        (concern.company_id
          ? `Company ID ${concern.company_id}`
          : "Unassigned Organization");
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(concern);
    });
    return Array.from(groups.entries()).map(([title, rows]) => ({
      title,
      concerns: rows,
    }));
  }, [concerns, user?.role_id]);

  const selectConcern = useCallback((concern) => {
    setSelectedConcernId(concern.id);
    setForm({
      stage: concern.stage || 1,
      status: concern.status || "Open",
      notice_date: concern.notice_date || "",
      enquiry_sessions: concern.enquiry_sessions?.length
        ? concern.enquiry_sessions
        : [{ date: "", present: "", notes: "" }],
      recommendation_text: concern.recommendation_text || "",
      recommendation_date: concern.recommendation_date || "",
      recommendation_file: concern.recommendation_file || "",
      execution_text: concern.execution_text || "",
      execution_date: concern.execution_date || "",
      closure_note: concern.closure_note || "",
      closure_date: concern.closure_date || "",
    });
  }, []);

  const loadConcerns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/concerns/received");
      const rows = res.data || [];
      setConcerns(rows);
      if (!selectedConcernId && rows.length > 0) {
        selectConcern(rows[0]);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load received complaints."));
    } finally {
      setLoading(false);
    }
  }, [selectConcern, selectedConcernId]);

  useEffect(() => {
    const timer = window.setTimeout(loadConcerns, 0);
    return () => window.clearTimeout(timer);
  }, [loadConcerns]);

  const saveCase = async (nextStage = form.stage) => {
    if (!selectedConcern) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        stage: nextStage,
        status:
          nextStage >= 7 ? "Closed" : nextStage >= 2 ? "Reviewed" : "Open",
        enquiry_sessions: (form.enquiry_sessions || []).filter(
          (session) => session.date || session.present || session.notes,
        ),
      };
      const res = await apiClient.patch(
        `/concerns/${selectedConcern.id}/manage`,
        payload,
      );
      setConcerns((current) =>
        current.map((concern) =>
          concern.id === selectedConcern.id ? res.data : concern,
        ),
      );
      selectConcern(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to update complaint case."));
    } finally {
      setSaving(false);
    }
  };

  const updateSession = (index, key, value) => {
    setForm((current) => ({
      ...current,
      enquiry_sessions: current.enquiry_sessions.map((session, sessionIndex) =>
        sessionIndex === index ? { ...session, [key]: value } : session,
      ),
    }));
  };

  const deleteSession = (index) => {
    setForm((current) => ({
      ...current,
      enquiry_sessions: current.enquiry_sessions.filter(
        (_, sessionIndex) => sessionIndex !== index,
      ),
    }));
  };

  const addSession = () => {
    setForm((current) => ({
      ...current,
      enquiry_sessions: [
        ...current.enquiry_sessions,
        { date: "", present: "", notes: "" },
      ],
    }));
  };

  const printCaseReport = () => {
    if (!selectedConcern) return;
    const reportWindow = window.open("", "_blank", "width=900,height=700");
    if (!reportWindow) return;
    reportWindow.document.write(`
      <html><head><title>Complaint ${caseNumber(selectedConcern)}</title></head>
      <body style="font-family:Arial,sans-serif;padding:28px;color:#101828">
        <h2>Full Case Report - ${caseNumber(selectedConcern)}</h2>
        <p><strong>Company:</strong> ${selectedConcern.company_name || "-"}</p>
        <p><strong>Filed:</strong> ${formatDate(selectedConcern.created_date)} | <strong>Stage:</strong> ${selectedConcern.stage_label || "-"}</p>
        <p><strong>Reporter:</strong> ${selectedConcern.reporter_name || "-"} (${selectedConcern.reporter_email || "-"})</p>
        <h3>Complaint</h3><p>${selectedConcern.message || "-"}</p>
        <h3>Notice</h3><p>${form.notice_date || "-"}</p>
        <h3>Recommendation</h3><p>${form.recommendation_text || "-"}</p>
        <h3>Execution</h3><p>${form.execution_text || "-"}</p>
        <h3>Closure</h3><p>${form.closure_note || "-"}</p>
      </body></html>
    `);
    reportWindow.document.close();
    reportWindow.print();
  };

  return (
    <PortalShell
      title="POSH Complaints"
      subtitle="File in confidence. Track without exposure. Resolve on time."
    >
      {error && <div style={errorStyle}>{error}</div>}

      {!loading && concerns.length === 0 ? (
        <div
          className="portal-card"
          style={{ textAlign: "center", padding: "34px" }}
        >
          <ReportProblemIcon
            style={{ color: "var(--portal-pink)", fontSize: 42 }}
          />
          <h2 style={{ margin: "10px 0 6px", fontSize: "18px" }}>
            No complaints received
          </h2>
          <p style={{ color: "var(--portal-muted)", margin: 0 }}>
            Submitted POSH complaints from company users will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "18px" }}>
          <div style={workspaceNoticeStyle}>
            IC Workspace - visible only to authorized reviewers.
          </div>

          {groupedConcernSections.map((section) => (
            <section
              key={section.title || "complaints"}
              style={{ display: "grid", gap: "10px" }}
            >
              {section.title && (
                <div className="portal-section-title">{section.title}</div>
              )}
              <div
                className="portal-card"
                style={{ padding: 0, overflowX: "auto" }}
              >
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th>Case #</th>
                      <th>Filed</th>
                      <th>Days Left (90)</th>
                      <th>Stage</th>
                      <th>Reporter</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.concerns.map((concern) => (
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
                            {concern.stage_label}
                          </span>
                        </td>
                        <td>
                          {concern.reporter_name ||
                            concern.reporter_email ||
                            "-"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="portal-link-btn"
                            onClick={() => selectConcern(concern)}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {selectedConcern && (
            <section
              className="portal-card"
              style={{ display: "grid", gap: "18px" }}
            >
              <div style={detailHeadStyle}>
                <div>
                  <div className="portal-section-title" style={{ margin: 0 }}>
                    Case {caseNumber(selectedConcern)}
                  </div>
                  <div
                    style={{ color: "var(--portal-muted)", fontSize: "13px" }}
                  >
                    Filed {formatDate(selectedConcern.created_date)}
                    {selectedConcern.company_name
                      ? ` - ${selectedConcern.company_name}`
                      : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="portal-primary-btn"
                    onClick={printCaseReport}
                  >
                    <PrintIcon fontSize="small" /> Generate Full Case Report
                  </button>
                  <button
                    type="button"
                    className="portal-outline-btn"
                    onClick={() => setSelectedConcernId(null)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <StageTimeline stage={form.stage} />

              <label style={labelStyle}>
                Current Stage
                <select
                  value={form.stage}
                  onChange={(event) =>
                    setForm({ ...form, stage: Number(event.target.value) })
                  }
                  style={inputStyle}
                  disabled={!canManage}
                >
                  {workflowStages.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {index + 1}. {label}
                    </option>
                  ))}
                </select>
              </label>

              <section style={caseSectionStyle}>
                <strong>Notice Given to Respondent - Date</strong>
                <input
                  type="date"
                  value={form.notice_date}
                  onChange={(event) =>
                    setForm({ ...form, notice_date: event.target.value })
                  }
                  style={inputStyle}
                  disabled={!canManage}
                />
              </section>

              <section>
                <div style={sectionHeadStyle}>
                  <strong>Enquiry Sessions</strong>
                  {canManage && (
                    <button
                      type="button"
                      className="portal-outline-btn"
                      onClick={addSession}
                    >
                      Add Session
                    </button>
                  )}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Present</th>
                        <th>Notes</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.enquiry_sessions.map((session, index) => (
                        <tr key={`${index}-${session.date}`}>
                          <td>{index + 1}</td>
                          <td>
                            <input
                              type="date"
                              value={session.date}
                              onChange={(event) =>
                                updateSession(index, "date", event.target.value)
                              }
                              style={inputStyle}
                              disabled={!canManage}
                            />
                          </td>
                          <td>
                            <input
                              value={session.present}
                              onChange={(event) =>
                                updateSession(
                                  index,
                                  "present",
                                  event.target.value,
                                )
                              }
                              style={inputStyle}
                              disabled={!canManage}
                            />
                          </td>
                          <td>
                            <input
                              value={session.notes}
                              onChange={(event) =>
                                updateSession(
                                  index,
                                  "notes",
                                  event.target.value,
                                )
                              }
                              style={inputStyle}
                              disabled={!canManage}
                            />
                          </td>
                          <td>
                            {canManage && (
                              <button
                                type="button"
                                className="portal-link-btn"
                                onClick={() => deleteSession(index)}
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <TextAreaBlock
                title="Recommendation"
                dateValue={form.recommendation_date}
                textValue={form.recommendation_text}
                fileValue={form.recommendation_file}
                disabled={!canManage}
                onDateChange={(value) =>
                  setForm({ ...form, recommendation_date: value })
                }
                onTextChange={(value) =>
                  setForm({ ...form, recommendation_text: value })
                }
                onFileChange={(value) =>
                  setForm({ ...form, recommendation_file: value })
                }
              />
              <TextAreaBlock
                title="Recommendation Execution"
                dateValue={form.execution_date}
                textValue={form.execution_text}
                disabled={!canManage}
                onDateChange={(value) =>
                  setForm({ ...form, execution_date: value })
                }
                onTextChange={(value) =>
                  setForm({ ...form, execution_text: value })
                }
              />
              <section style={caseSectionStyle}>
                <strong>Case Closure</strong>
                <textarea
                  rows={3}
                  value={form.closure_note}
                  onChange={(event) =>
                    setForm({ ...form, closure_note: event.target.value })
                  }
                  style={{ ...inputStyle, resize: "vertical" }}
                  disabled={!canManage}
                />
                <input
                  type="date"
                  value={form.closure_date}
                  onChange={(event) =>
                    setForm({ ...form, closure_date: event.target.value })
                  }
                  style={inputStyle}
                  disabled={!canManage}
                />
                {canManage && (
                  <button
                    type="button"
                    className="portal-primary-btn"
                    disabled={saving}
                    onClick={() => saveCase(7)}
                    style={{ width: "fit-content" }}
                  >
                    <AssignmentTurnedInIcon fontSize="small" /> Mark Case
                    Completed / Closed
                  </button>
                )}
              </section>

              {canManage && (
                <button
                  type="button"
                  className="portal-primary-btn"
                  disabled={saving}
                  onClick={() => saveCase()}
                  style={{ width: "fit-content" }}
                >
                  {saving ? "Saving..." : "Save Case Update"}
                </button>
              )}
            </section>
          )}
        </div>
      )}

      <LoadingOverlay
        show={loading || saving}
        title={saving ? "Saving complaint" : "Loading complaints"}
        message={
          saving
            ? "Updating the case workspace."
            : "Fetching received complaint cases."
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

function TextAreaBlock({
  title,
  dateValue,
  textValue,
  fileValue,
  disabled,
  onDateChange,
  onTextChange,
  onFileChange,
}) {
  return (
    <section style={caseSectionStyle}>
      <strong>{title}</strong>
      <input
        type="date"
        value={dateValue || ""}
        onChange={(event) => onDateChange(event.target.value)}
        style={inputStyle}
        disabled={disabled}
      />
      <textarea
        rows={3}
        value={textValue || ""}
        onChange={(event) => onTextChange(event.target.value)}
        style={{ ...inputStyle, resize: "vertical" }}
        disabled={disabled}
      />
      {onFileChange && (
        <input
          value={fileValue || ""}
          onChange={(event) => onFileChange(event.target.value)}
          placeholder="Report / attachment reference"
          style={inputStyle}
          disabled={disabled}
        />
      )}
    </section>
  );
}

TextAreaBlock.propTypes = {
  title: PropTypes.string.isRequired,
  dateValue: PropTypes.string,
  textValue: PropTypes.string,
  fileValue: PropTypes.string,
  disabled: PropTypes.bool.isRequired,
  onDateChange: PropTypes.func.isRequired,
  onTextChange: PropTypes.func.isRequired,
  onFileChange: PropTypes.func,
};

TextAreaBlock.defaultProps = {
  dateValue: "",
  textValue: "",
  fileValue: "",
  onFileChange: null,
};

const caseNumber = (concern) =>
  `#SC-${new Date(concern.created_date || Date.now()).getFullYear()}-${String(concern.id).padStart(3, "0")}`;

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const detailHeadStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
  alignItems: "flex-start",
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

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};

const workspaceNoticeStyle = {
  background: "#fff0f3",
  border: "1px solid #ffb3c2",
  borderRadius: "8px",
  color: "#9f1239",
  fontWeight: 700,
  padding: "12px 14px",
  fontSize: "13px",
};

const caseSectionStyle = {
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "14px",
  display: "grid",
  gap: "10px",
};

const sectionHeadStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "center",
  marginBottom: "10px",
};

const timelineStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(74px, 1fr))",
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
  minWidth: "74px",
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
