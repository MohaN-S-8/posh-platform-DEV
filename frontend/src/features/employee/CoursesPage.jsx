import AssessmentIcon from "@mui/icons-material/Assessment";
import LockIcon from "@mui/icons-material/Lock";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

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
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button
        type="button"
        onClick={() => navigate("/employee")}
        style={{
          background: "none",
          border: "none",
          color: "#17324d",
          cursor: "pointer",
          marginBottom: "16px",
          fontWeight: 700,
        }}
      >
        Back to Dashboard
      </button>

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
          Video Courses
        </h1>
        <p style={{ color: "#64748b", margin: "6px 0 0" }}>
          Watch assigned training videos, resume progress, and unlock assessments.
        </p>
      </div>

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
        <div
          style={{
            background: "white",
            borderRadius: "8px",
            padding: "40px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e7edf3",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#17324d" }}>No courses assigned yet</h2>
          <p style={{ color: "#64748b" }}>
            Your HR team will assign training courses to you.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {courses.map((course) => {
            const complete = Math.round(course.completion_percent || 0);
            return (
              <div
                key={course.assignment_id}
                style={{
                  background: "white",
                  borderRadius: "8px",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  border: "1px solid #e7edf3",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "18px",
                  alignItems: "center",
                }}
              >
                <div>
                  <h2 style={{ color: "#17324d", margin: "0 0 6px", fontSize: "18px" }}>
                    {course.title}
                  </h2>
                  <p style={{ color: "#64748b", margin: "0 0 10px", fontSize: "13px" }}>
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
                    <span style={{ color: "#17324d", fontWeight: 700, fontSize: "13px" }}>
                      {complete}%
                    </span>
                    <div
                      style={{
                        height: "8px",
                        background: "#edf2f7",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, complete)}%`,
                          background: complete >= 95 ? "#1f7a4d" : "#2d6a8e",
                        }}
                      />
                    </div>
                    <span style={{ color: "#64748b", fontSize: "13px" }}>
                      {course.status}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      flexWrap: "wrap",
                      marginTop: "10px",
                      color: "#64748b",
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
                      background: "#17324d",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
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
                    disabled={!course.assessment_unlocked}
                    onClick={() => navigate(`/employee/assessment/${course.video_id}`)}
                    style={{
                      padding: "9px 14px",
                      background: course.assessment_unlocked ? "#1f7a4d" : "#edf2f7",
                      color: course.assessment_unlocked ? "white" : "#64748b",
                      border: "none",
                      borderRadius: "6px",
                      cursor: course.assessment_unlocked ? "pointer" : "not-allowed",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {course.assessment_unlocked ? (
                      <AssessmentIcon fontSize="small" />
                    ) : (
                      <LockIcon fontSize="small" />
                    )}
                    Assessment
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LoadingOverlay
        show={loading}
        title="Loading courses"
        message="Fetching assigned training videos and progress."
      />
    </div>
  );
}
