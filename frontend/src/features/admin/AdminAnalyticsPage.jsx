import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import BusinessIcon from "@mui/icons-material/Business";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { useAuthStore } from "../../store/authStore";

export function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/analytics/current");
        setAnalytics(res.data);
      } catch (err) {
        setError(apiErrorMessage(err, "Unable to load analytics."));
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, []);

  const metrics = useMemo(() => {
    if (!analytics) return [];
    if (analytics.scope === "platform") {
      return [
        {
          label: "Active Companies",
          value: analytics.total_companies ?? 0,
          icon: <BusinessIcon />,
        },
        {
          label: "Active Users",
          value: analytics.total_users ?? 0,
          icon: <GroupsIcon />,
        },
        {
          label: "Course Completions",
          value: analytics.total_course_completions ?? 0,
          icon: <AssessmentIcon />,
        },
        {
          label: "Certificates Issued",
          value: analytics.total_certificates_issued ?? 0,
          icon: <BadgeIcon />,
        },
        {
          label: "Average Pass Score",
          value: `${analytics.average_pass_score ?? 0}%`,
          icon: <TrendingUpIcon />,
        },
      ];
    }
    return [
      {
        label: "Employees",
        value: analytics.total_employees ?? 0,
        icon: <GroupsIcon />,
      },
      {
        label: "Completed Training",
        value: analytics.completed_training ?? 0,
        icon: <AssessmentIcon />,
      },
      {
        label: "In Progress",
        value: analytics.in_progress_training ?? 0,
        icon: <TrendingUpIcon />,
      },
      {
        label: "Not Started",
        value: analytics.not_started_training ?? 0,
        icon: <BusinessIcon />,
      },
      {
        label: "Certificates Issued",
        value: analytics.certificates_issued ?? 0,
        icon: <BadgeIcon />,
      },
      {
        label: "Average Pass Score",
        value: `${analytics.average_pass_score ?? 0}%`,
        icon: <TrendingUpIcon />,
      },
    ];
  }, [analytics]);

  const complianceRate = analytics?.compliance_rate ?? 0;

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button type="button" onClick={() => navigate("/admin")} style={backButtonStyle}>
        Back to Dashboard
      </button>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
          Analytics
        </h1>
        <p style={{ color: "#64748b", margin: "6px 0 0" }}>
          {user?.role_id === 1
            ? "Platform-wide companies, users, completions, and certificate metrics."
            : "Company training completion, compliance, assessment, and certificate metrics."}
        </p>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {analytics?.scope === "company" && (
        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <div style={labelStyle}>Compliance Rate</div>
              <div style={heroValueStyle}>{complianceRate}%</div>
            </div>
            <div style={meterOuterStyle}>
              <div
                style={{
                  ...meterInnerStyle,
                  width: `${Math.min(100, Math.max(0, complianceRate))}%`,
                }}
              />
            </div>
          </div>
        </section>
      )}

      <section style={gridStyle}>
        {metrics.map((metric) => (
          <div key={metric.label} style={cardStyle}>
            <div style={iconStyle}>{metric.icon}</div>
            <div style={labelStyle}>{metric.label}</div>
            <div style={valueStyle}>{metric.value}</div>
          </div>
        ))}
      </section>

      {!loading && !error && metrics.length === 0 && (
        <div style={panelStyle}>No analytics available yet.</div>
      )}

      <LoadingOverlay
        show={loading}
        title="Loading analytics"
        message="Fetching current training metrics."
      />
    </div>
  );
}

const backButtonStyle = {
  background: "none",
  border: "none",
  color: "#17324d",
  cursor: "pointer",
  marginBottom: "16px",
  padding: 0,
  fontWeight: 700,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "16px",
};

const panelStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  marginBottom: "18px",
};

const cardStyle = {
  ...panelStyle,
  marginBottom: 0,
};

const iconStyle = {
  color: "#17324d",
  display: "flex",
  marginBottom: "14px",
};

const labelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
};

const valueStyle = {
  color: "#17324d",
  fontSize: "30px",
  fontWeight: 800,
  marginTop: "8px",
};

const heroValueStyle = {
  ...valueStyle,
  fontSize: "38px",
};

const meterOuterStyle = {
  alignSelf: "center",
  flex: "1 1 260px",
  maxWidth: "520px",
  height: "12px",
  background: "#edf2f7",
  borderRadius: "999px",
  overflow: "hidden",
};

const meterInnerStyle = {
  height: "100%",
  background: "#1f7a4d",
};

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};
