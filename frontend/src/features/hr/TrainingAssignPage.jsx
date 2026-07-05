import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

export function TrainingAssignPage() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    video_id: "",
    assign_type: "Company-Wide",
    assigned_to_user_id: "",
    assigned_to_department: "",
    due_days: 30,
    passing_score: 70,
  });

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoadingOptions(true);
      setError("");
      try {
        const [videoRes, employeeRes] = await Promise.all([
          apiClient.get("/videos/published"),
          apiClient.get("/hr/employees"),
        ]);
        setVideos(videoRes.data);
        setEmployees(employeeRes.data.employees || []);
        setDepartments(employeeRes.data.departments || []);
      } catch (err) {
        setError(err.response?.data?.detail || "Unable to load assignment options.");
      } finally {
        setLoadingOptions(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedVideo = useMemo(
    () => videos.find((video) => String(video.video_id) === String(form.video_id)),
    [videos, form.video_id],
  );

  const canSubmit =
    form.video_id &&
    (form.assign_type === "Company-Wide" ||
      (form.assign_type === "Individual" && form.assigned_to_user_id) ||
      (form.assign_type === "Department" && form.assigned_to_department));

  const updateAssignType = (assignType) => {
    setForm({
      ...form,
      assign_type: assignType,
      assigned_to_user_id: "",
      assigned_to_department: "",
    });
    setSuccess("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      setError("Please select a video and assignment target.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        video_id: Number(form.video_id),
        assign_type: form.assign_type,
        due_days: Number(form.due_days),
        passing_score: Number(form.passing_score),
      };
      if (form.assign_type === "Individual") {
        payload.assigned_to_user_id = Number(form.assigned_to_user_id);
      }
      if (form.assign_type === "Department") {
        payload.assigned_to_department = form.assigned_to_department;
      }

      const res = await apiClient.post("/hr/training/assign", payload);
      setSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.detail || "Assignment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button
        onClick={() => navigate("/hr")}
        style={{
          background: "none",
          border: "none",
          color: "#17324d",
          cursor: "pointer",
          marginBottom: "16px",
        }}
      >
        Back to HR Dashboard
      </button>
      <h1 style={{ color: "#17324d", margin: "0 0 24px", fontSize: "30px" }}>
        Assign Training
      </h1>

      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          maxWidth: "760px",
        }}
      >
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "18px" }}>
            <label style={labelStyle}>Training Video *</label>
            <select
              required
              value={form.video_id}
              onChange={(e) => {
                setForm({ ...form, video_id: e.target.value });
                setSuccess("");
                setError("");
              }}
              style={inputStyle}
            >
              <option value="">Select published video</option>
              {videos.map((video) => (
                <option key={video.video_id} value={video.video_id}>
                  {video.title}
                  {video.duration_minutes ? ` (${video.duration_minutes} min)` : ""}
                </option>
              ))}
            </select>
            {!loadingOptions && videos.length === 0 && (
              <p style={hintStyle}>
                No published videos available. Publish a video from Admin - Videos first.
              </p>
            )}
            {selectedVideo && (
              <p style={hintStyle}>Selected: {selectedVideo.title}</p>
            )}
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label style={labelStyle}>Assignment Type *</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {["Individual", "Department", "Company-Wide"].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => updateAssignType(type)}
                  style={{
                    padding: "9px 14px",
                    borderRadius: "6px",
                    border:
                      form.assign_type === type
                        ? "1px solid #17324d"
                        : "1px solid #cdd9e2",
                    background: form.assign_type === type ? "#17324d" : "#ffffff",
                    color: form.assign_type === type ? "white" : "#17324d",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {form.assign_type === "Individual" && (
            <div style={{ marginBottom: "18px" }}>
              <label style={labelStyle}>Select Employee *</label>
              <select
                required
                value={form.assigned_to_user_id}
                onChange={(e) =>
                  setForm({ ...form, assigned_to_user_id: e.target.value })
                }
                style={inputStyle}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.user_id} value={employee.user_id}>
                    {employee.first_name} {employee.last_name || ""} - {employee.email}
                    {employee.department ? ` (${employee.department})` : ""}
                  </option>
                ))}
              </select>
              {!loadingOptions && employees.length === 0 && (
                <p style={hintStyle}>No active employees found for this company.</p>
              )}
            </div>
          )}

          {form.assign_type === "Department" && (
            <div style={{ marginBottom: "18px" }}>
              <label style={labelStyle}>Department *</label>
              <select
                required
                value={form.assigned_to_department}
                onChange={(e) =>
                  setForm({ ...form, assigned_to_department: e.target.value })
                }
                style={inputStyle}
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
              {!loadingOptions && departments.length === 0 && (
                <p style={hintStyle}>
                  No departments found. Add departments to employees first.
                </p>
              )}
            </div>
          )}

          {form.assign_type === "Company-Wide" && (
            <div
              style={{
                marginBottom: "18px",
                background: "#eef4f8",
                border: "1px solid #cdd9e2",
                borderRadius: "8px",
                padding: "14px",
                color: "#17324d",
                fontSize: "14px",
              }}
            >
              This will assign the selected video to every active employee in this company.
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <div>
              <label style={labelStyle}>Due in days</label>
              <input
                type="number"
                value={form.due_days}
                onChange={(e) => setForm({ ...form, due_days: e.target.value })}
                min={1}
                max={365}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Passing Score (%)</label>
              <input
                type="number"
                value={form.passing_score}
                onChange={(e) =>
                  setForm({ ...form, passing_score: e.target.value })
                }
                min={0}
                max={100}
                style={inputStyle}
              />
            </div>
          </div>

          {error && <div style={errorStyle}>{error}</div>}
          {success && <div style={successStyle}>{success}</div>}

          <button
            type="submit"
            disabled={submitting || loadingOptions || !canSubmit}
            style={{
              padding: "10px 28px",
              background:
                submitting || loadingOptions || !canSubmit ? "#93a4b7" : "#17324d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor:
                submitting || loadingOptions || !canSubmit ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "Assigning..." : "Assign Training"}
          </button>
        </form>
      </div>

      <LoadingOverlay
        show={loadingOptions || submitting}
        title={submitting ? "Assigning training" : "Loading assignment options"}
        message={
          submitting
            ? "Saving this assignment for the selected employees."
            : "Fetching published videos, employees, and departments."
        }
      />
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
  color: "#17324d",
  fontSize: "14px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cfd7df",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
  background: "white",
  color: "#111827",
};

const hintStyle = {
  margin: "8px 0 0",
  color: "#667085",
  fontSize: "13px",
};

const errorStyle = {
  background: "#fdf0f0",
  border: "1px solid #e74c3c",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#c0392b",
  fontSize: "14px",
  marginBottom: "16px",
};

const successStyle = {
  background: "#e8f5ee",
  border: "1px solid #1f7a4d",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "#1f7a4d",
  fontSize: "14px",
  marginBottom: "16px",
};
