import AssessmentIcon from "@mui/icons-material/Assessment";
import LockIcon from "@mui/icons-material/Lock";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

export function CoursesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const isIcPoshTraining =
    user?.role_id === 3 && location.pathname.includes("/ic/posh");
  const isIcMemberTraining = user?.role_id === 3 && !isIcPoshTraining;
  const trainingType = isIcMemberTraining ? "ic" : "posh";
  const rolePaths = isIcMemberTraining
    ? { video: "/ic/video", assessment: "/ic/assessment" }
    : user?.role_id === 3
      ? { video: "/ic/posh-video", assessment: "/ic/posh-assessment" }
      : { video: "/employee/video", assessment: "/employee/assessment" };
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requiresPolicyAck = error.toLowerCase().includes("acknowledge");
  const requiredVideoCount = courses[0]?.required_video_count ?? 5;
  const completedRequiredCount =
    courses[0]?.required_completed_count ??
    courses.filter((course) => course.status === "Completed").length;
  const requiredTrainingComplete =
    courses.length >= requiredVideoCount &&
    completedRequiredCount >= requiredVideoCount;
  const completedCourses = courses.filter(
    (course) => course.status === "Completed",
  );
  const availableAssessments = completedCourses.filter(
    (course) => course.assessment_result !== "Pass",
  );

  useEffect(() => {
    let active = true;
    const loadCourses = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get(
          `/employee/courses?training_type=${trainingType}`,
        );
        if (active) setCourses(res.data || []);
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.detail ||
              "Unable to load your available courses.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCourses();
    return () => {
      active = false;
    };
  }, [trainingType]);

  return (
    <PortalShell
      title={isIcMemberTraining ? "IC Member Training" : "PoSH Training"}
      subtitle={
        isIcMemberTraining
          ? "Published IC training appears here automatically."
          : "Published employee training appears here automatically, with progress and assessment unlocks."
      }
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
        <div
          className="portal-card"
          style={{ padding: "40px", textAlign: "center" }}
        >
          <h2>
            {requiresPolicyAck
              ? "Policy acknowledgement required"
              : "No courses available yet"}
          </h2>
          <p>
            {requiresPolicyAck
              ? "Please acknowledge the PoSH policy before starting employee training."
              : isIcMemberTraining
                ? "No published IC training is available for your company yet."
                : "No published employee training is available for your company yet."}
          </p>
          {requiresPolicyAck && (
            <button
              type="button"
              className="portal-primary-btn"
              onClick={() => navigate("/posh-policy")}
            >
              Go to PoSH Policy
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="portal-section-title">Available Training</div>
          <div
            className="portal-card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>
                Required videos
              </h2>
              <p style={{ margin: 0, color: "var(--portal-muted)" }}>
                Complete {requiredVideoCount} videos once to unlock assessment.
                Completed:{" "}
                {Math.min(completedRequiredCount, requiredVideoCount)}/
                {requiredVideoCount}
              </p>
            </div>
            <div
              style={{
                minWidth: "120px",
                textAlign: "right",
                color: requiredTrainingComplete
                  ? "var(--portal-teal)"
                  : "var(--portal-purple)",
                fontWeight: 800,
              }}
            >
              {requiredTrainingComplete
                ? "Assessment unlocked"
                : "Training pending"}
            </div>
          </div>
          <div style={{ display: "grid", gap: "16px" }}>
            {courses.map((course) => {
              const complete = Math.round(course.completion_percent || 0);
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
                      {course.description || "POSH training course"} | Passing
                      score: {course.passing_score}%
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
                      <span
                        style={{
                          color: "var(--portal-purple)",
                          fontWeight: 700,
                          fontSize: "13px",
                        }}
                      >
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
                      <span
                        style={{
                          color: "var(--portal-muted)",
                          fontSize: "13px",
                        }}
                      >
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

                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`${rolePaths.video}/${course.video_id}`)
                      }
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
                  </div>
                </div>
              );
            })}
          </div>

          <div className="portal-section-title" style={{ marginTop: "24px" }}>
            Assessment
          </div>
          <div className="portal-card">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>
                  Final assessment
                </h2>
                <p style={{ margin: 0, color: "var(--portal-muted)" }}>
                  {requiredTrainingComplete
                    ? "You can take or retake assessment from the completed training videos."
                    : `Complete all ${requiredVideoCount} required videos to unlock this section.`}
                </p>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: requiredTrainingComplete
                    ? "var(--portal-teal)"
                    : "var(--portal-muted)",
                  fontWeight: 800,
                }}
              >
                {requiredTrainingComplete ? (
                  <AssessmentIcon fontSize="small" />
                ) : (
                  <LockIcon fontSize="small" />
                )}
                {requiredTrainingComplete ? "Ready" : "Locked"}
              </div>
            </div>

            <div style={{ display: "grid", gap: "10px", marginTop: "18px" }}>
              {completedCourses.length === 0 ? (
                <p style={{ margin: 0, color: "var(--portal-muted)" }}>
                  Completed videos will appear here for assessment.
                </p>
              ) : (
                completedCourses.map((course) => {
                  const passed = course.assessment_result === "Pass";
                  const failed = course.assessment_result === "Fail";
                  const canOpen = requiredTrainingComplete && !passed;
                  return (
                    <div
                      key={`assessment-${course.video_id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: "12px",
                        alignItems: "center",
                        padding: "12px",
                        border: "1px solid var(--portal-border)",
                        borderRadius: "8px",
                      }}
                    >
                      <div>
                        <strong>{course.title}</strong>
                        <div
                          style={{
                            color: "var(--portal-muted)",
                            fontSize: "13px",
                          }}
                        >
                          {passed
                            ? `Passed${course.assessment_score ? ` - ${course.assessment_score}%` : ""}`
                            : failed
                              ? `Previous result: Fail${
                                  course.assessment_score
                                    ? ` - ${course.assessment_score}%`
                                    : ""
                                }`
                              : "Not attempted"}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canOpen}
                        onClick={() =>
                          navigate(`${rolePaths.assessment}/${course.video_id}`)
                        }
                        style={{
                          padding: "9px 14px",
                          background: canOpen
                            ? "var(--portal-teal)"
                            : "var(--portal-bg)",
                          color: canOpen ? "white" : "var(--portal-muted)",
                          border: "1px solid var(--portal-border)",
                          borderRadius: "8px",
                          cursor: canOpen ? "pointer" : "not-allowed",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {canOpen ? (
                          <AssessmentIcon fontSize="small" />
                        ) : (
                          <LockIcon fontSize="small" />
                        )}
                        {passed
                          ? "Assessment Pass"
                          : failed
                            ? "Retake"
                            : "Start"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {requiredTrainingComplete && availableAssessments.length === 0 && (
              <p style={{ margin: "16px 0 0", color: "var(--portal-muted)" }}>
                All available assessments are already passed.
              </p>
            )}
          </div>
        </>
      )}

      <LoadingOverlay
        show={loading}
        title="Loading courses"
        message="Fetching available training videos and progress."
      />
    </PortalShell>
  );
}
