import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import HistoryIcon from "@mui/icons-material/History";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";

const cardStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
};

const statLabelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
};

const statValueStyle = {
  color: "#17324d",
  fontSize: "30px",
  fontWeight: 800,
  marginTop: "8px",
};

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [courses, setCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const [summaryRes, coursesRes, historyRes] = await Promise.all([
          apiClient.get("/employee/summary"),
          apiClient.get("/employee/courses"),
          apiClient.get("/employee/history"),
        ]);
        if (active) {
          setSummary(summaryRes.data);
          setCourses(coursesRes.data || []);
          setHistory(historyRes.data || []);
        }
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to load employee dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: "Assigned Courses", value: summary?.total_courses ?? 0 },
    { label: "Completed", value: summary?.completed ?? 0 },
    {
      label: "Pending",
      value: (summary?.in_progress ?? 0) + (summary?.not_started ?? 0),
    },
    { label: "Completion Rate", value: `${summary?.completion_rate ?? 0}%` },
    { label: "Certificates", value: summary?.certificates ?? 0 },
  ];

  const currentCourses = useMemo(
    () =>
      courses
        .filter((course) => course.status !== "Completed")
        .slice(0, 3),
    [courses],
  );

  const recentActivity = useMemo(() => {
    const items = [];
    history
      .filter((row) => row.status === "Completed")
      .slice(0, 2)
      .forEach((row) => items.push(`Video completed: ${row.course_name}`));
    history
      .filter((row) => row.assessment_result === "Pass")
      .slice(0, 2)
      .forEach((row) => items.push(`Assessment passed: ${row.course_name}`));
    history
      .filter((row) => row.certificate_number)
      .slice(0, 2)
      .forEach((row) => items.push(`Certificate earned: ${row.course_name}`));
    return items.slice(0, 4);
  }, [history]);

  const modules = [
    {
      title: "Video Courses",
      description: "Watch assigned POSH training videos and resume from saved progress.",
      path: "/employee/courses",
      icon: <PlayCircleIcon />,
      status: "Available",
    },
    {
      title: "Assessments",
      description: "Unlocked after video completion with instant score and pass/fail result.",
      path: "/employee/courses",
      icon: <AssessmentIcon />,
      status: "Available",
    },
    {
      title: "Progress Tracking",
      description: "Review completion percentage, pending courses, and course status.",
      path: "/employee/history",
      icon: <TrendingUpIcon />,
      status: "Available",
    },
    {
      title: "Certificates",
      description: "Download valid PDF certificates and verify certificate numbers.",
      path: "/employee/certificates",
      icon: <BadgeIcon />,
      status: "Available",
    },
    {
      title: "Training History",
      description: "View completed, in-progress, and not-started training records.",
      path: "/employee/history",
      icon: <HistoryIcon />,
      status: "Available",
    },
  ];

  return (
    <PortalShell
      title="Home"
      subtitle="Your PoSH programme, assigned training, assessments, and certificates."
    >

      {error && (
        <div
          style={{
            ...cardStyle,
            borderColor: "#f3b4ae",
            background: "#fff7f6",
            color: "#c0392b",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      <section style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "16px",
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label} style={cardStyle}>
              <div style={statLabelStyle}>{stat.label}</div>
              <div style={statValueStyle}>{loading ? "-" : stat.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px",
          alignItems: "start",
          marginBottom: "28px",
        }}
      >
        <div style={cardStyle}>
          <h2 style={{ color: "#17324d", margin: "0 0 16px", fontSize: "20px" }}>
            Current Courses
          </h2>
          {currentCourses.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {currentCourses.map((course) => (
                <button
                  key={course.video_id}
                  type="button"
                  onClick={() => navigate(`/employee/video/${course.video_id}`)}
                  style={{
                    textAlign: "left",
                    border: "1px solid #e7edf3",
                    background: "#fbfcfe",
                    borderRadius: "8px",
                    padding: "12px",
                    cursor: "pointer",
                  }}
                >
                  <strong style={{ color: "#17324d" }}>{course.title}</strong>
                  <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                    {Math.round(course.completion_percent || 0)}% complete - {course.status}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: "#64748b", margin: 0 }}>
              No pending courses. Completed courses remain available in training history.
            </p>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ color: "#17324d", margin: "0 0 16px", fontSize: "20px" }}>
            Recent Activity
          </h2>
          {recentActivity.length ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {recentActivity.map((item) => (
                <div key={item} style={{ color: "#64748b", fontSize: "14px" }}>
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#64748b", margin: 0 }}>
              Activity appears after you watch videos, pass assessments, or earn certificates.
            </p>
          )}
        </div>
      </section>

      <section>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          {modules.map((module) => {
            const enabled = Boolean(module.path);
            return (
              <button
                key={module.title}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && navigate(module.path)}
                style={{
                  ...cardStyle,
                  textAlign: "left",
                  cursor: enabled ? "pointer" : "not-allowed",
                  opacity: enabled ? 1 : 0.76,
                  minHeight: "152px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <span style={{ color: "#17324d", display: "flex" }}>{module.icon}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      color: module.status === "Available" ? "#1f7a4d" : "#64748b",
                      background:
                        module.status === "Available" ? "#e8f5e9" : "#eef2f6",
                      borderRadius: "999px",
                      padding: "4px 9px",
                    }}
                  >
                    {module.status}
                  </span>
                </div>
                <h3 style={{ color: "#17324d", margin: "0 0 8px", fontSize: "17px" }}>
                  {module.title}
                </h3>
                <p style={{ color: "#64748b", margin: 0, fontSize: "13px", lineHeight: 1.5 }}>
                  {module.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <LoadingOverlay
        show={loading}
        title="Loading employee portal"
        message="Fetching assigned courses, progress, certificates, and training history."
      />
    </PortalShell>
  );
}
