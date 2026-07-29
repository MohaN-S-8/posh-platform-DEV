import AssessmentIcon from "@mui/icons-material/Assessment";
import LockIcon from "@mui/icons-material/Lock";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";

export function CoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadCourses = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/employee/courses");
        if (active) setCourses(res.data || []);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to load your assigned courses.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCourses();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PortalShell
      title="POSH Awareness Training"
      subtitle="Watch assigned training videos, resume progress, and unlock assessments."
    >

      {error && (
        <div
          style={{
            background: "#fff7f6",
            border: "1px solid #f3b4ae",
            borderRadius: "8px",
            color: "#c0392b",
            padding: "12px 14px",
            marginBottom: "18px",
          }}
        >
          {error}
        </div>
      )}

      {!loading && courses.length === 0 ? (
        <div className="portal-card" style={{ padding: "40px", textAlign: "center" }}>
          <h2>No courses assigned yet</h2>
          <p>
            Your HR team will assign training courses to you.
          </p>
        </div>
      ) : (
        <>
          <div className="portal-section-title">Assigned Courses</div>
          <div style={{ display: "grid", gap: "16px" }}>
          {courses.map((course) => {
            const complete = Math.round(course.completion_percent || 0);
            const assessmentTaken = Boolean(course.assessment_attempted);
            const assessmentFailed = course.assessment_result === "Fail";
            const canTakeAssessment = course.assessment_unlocked && !assessmentTaken;
            const canRetakeAssessment = course.assessment_unlocked && assessmentFailed;
            return (
              <div
                key={course.assignment_id}
                className="portal-card"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "18px",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>
                    {course.title}
                  </h2>
                  <p style={{ margin: "0 0 10px", fontSize: "13px" }}>
                    {course.description || "POSH training course"} | Passing score:{" "}
                    {course.passing_score}%
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: "10px",
                      alignItems: "center",
                      maxWidth: "520px",
                    }}
                  >
                    <span style={{ color: "var(--portal-purple)", fontWeight: 700, fontSize: "13px" }}>
                      {complete}%
                    </span>
                    <div className="portal-progress">
                      <div
                        className="portal-progress-bar"
                        style={{
                          width: `${Math.min(100, complete)}%`,
                        }}
                      />
                    </div>
                    <span style={{ color: "var(--portal-muted)", fontSize: "13px" }}>
                      {course.status}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                      color: "var(--portal-muted)",
                      fontSize: "13px",
                    }}
                  >
                    <span>
                      Due:{" "}
                      {course.due_date
                        ? new Date(course.due_date).toLocaleDateString()
                        : "-"}
                    </span>
                    <span>
                      Resume:{" "}
                      {course.resume_position
                        ? `${Math.floor(course.resume_position / 60)} min`
                        : "Start"}
                    </span>
                    <span>Language: English</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/employee/video/${course.video_id}`)}
                    style={{
                      padding: "9px 14px",
                      background: "var(--portal-pink)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <PlayCircleIcon fontSize="small" />
                    {course.resume_position ? "Resume" : "Watch"}
                  </button>
                  <button
                    type="button"
                    disabled={!canTakeAssessment && !canRetakeAssessment}
                    onClick={() => navigate(`/employee/assessment/${course.video_id}`)}
                    style={{
                      padding: "9px 14px",
                      background:
                        canTakeAssessment || canRetakeAssessment
                          ? "var(--portal-teal)"
                          : "var(--portal-bg)",
                      color:
                        canTakeAssessment || canRetakeAssessment
                          ? "white"
                          : "var(--portal-muted)",
                      border: "1px solid var(--portal-border)",
                      borderRadius: "8px",
                      cursor:
                        canTakeAssessment || canRetakeAssessment
                          ? "pointer"
                          : "not-allowed",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {canTakeAssessment || canRetakeAssessment ? (
                      <AssessmentIcon fontSize="small" />
                    ) : (
                      <LockIcon fontSize="small" />
                    )}
                    {canRetakeAssessment
                      ? "Retake Assessment"
                      : assessmentTaken
                      ? `Assessment ${course.assessment_result || "Submitted"}`
                      : "Assessment"}
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}

      <LoadingOverlay
        show={loading}
        title="Loading courses"
        message="Fetching assigned training videos and progress."
      />
    </PortalShell>
  );
}
