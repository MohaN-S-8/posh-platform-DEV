import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import BusinessIcon from "@mui/icons-material/Business";
import HistoryIcon from "@mui/icons-material/History";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import SettingsIcon from "@mui/icons-material/Settings";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { useAuthStore } from "../../store/authStore";

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

export function AdminDashboard() {
  const { clearAuth, user } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const logout = async () => {
    await clearAuth();
    navigate("/login");
  };

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoadingAnalytics(true);
      setAnalyticsError("");
      try {
        const endpoint =
          user?.role_id === 1
            ? "/analytics/overview"
            : `/analytics/company/${user?.company_id}`;
        const res = await apiClient.get(endpoint);
        setAnalytics(res.data);
      } catch (err) {
        setAnalyticsError(apiErrorMessage(err, "Analytics are not available for this account."));
      } finally {
        setLoadingAnalytics(false);
      }
    };

    loadAnalytics();
  }, [user?.company_id, user?.role_id]);

  const stats = useMemo(() => {
    if (!analytics) return [];
    if (user?.role_id === 1) {
      return [
        { label: "Active Companies", value: analytics.total_companies ?? 0 },
        { label: "Active Users", value: analytics.total_users ?? 0 },
        {
          label: "Certificates",
          value: analytics.total_certificates_issued ?? 0,
        },
        {
          label: "Completions",
          value: analytics.total_course_completions ?? 0,
        },
      ];
    }
    return [
      { label: "Employees", value: analytics.total_employees ?? 0 },
      { label: "Completed", value: analytics.completed_training ?? 0 },
      { label: "Compliance", value: `${analytics.compliance_rate ?? 0}%` },
      { label: "Certificates", value: analytics.certificates_issued ?? 0 },
    ];
  }, [analytics, user?.role_id]);

  const modules = [
    {
      title: "Company Management",
      description: "Create companies, track status, and maintain employee strength.",
      path: "/admin/companies",
      icon: <BusinessIcon />,
      status: "Available",
      allowedRoles: [1],
    },
    {
      title: "User Management",
      description: "Create HR/IC users, activate or deactivate accounts, and review roles.",
      path: "/admin/users",
      icon: <PeopleIcon />,
      status: "Available",
      allowedRoles: [1, 2],
    },
    // {
    //   title: "Owner Admin Setup",
    //   description: "Direct-link company owner flow for creating Admin users.",
    //   path: "/owner/admin-setup",
    //   icon: <PeopleIcon />,
    //   status: "Owner",
    //   allowedRoles: [1],
    // },
    {
      title: "Video Management",
      description: "Upload, publish, and manage POSH training videos.",
      path: "/admin/videos",
      icon: <VideoLibraryIcon />,
      status: "Available",
      allowedRoles: [1, 2],
    },
    {
      title: "Certificate Module",
      description: "Create certificate templates and manage generated certificate setup.",
      path: "/admin/certificates",
      icon: <BadgeIcon />,
      status: "Available",
      allowedRoles: [1, 2],
    },
    {
      title: "Analytics",
      description: "Platform and company-level training metrics.",
      path: "/admin/analytics",
      icon: <AssessmentIcon />,
      status: "Available",
      allowedRoles: [1, 2],
    },
    {
      title: "Audit Logs",
      description: "Review recent successful and failed login attempts.",
      path: "/admin/audit-logs",
      icon: <HistoryIcon />,
      status: "Available",
      allowedRoles: [1, 2],
    },
    {
      title: "Reports",
      description: "Download available Excel reports for audits and management.",
      path: "/admin/reports",
      icon: <AssessmentIcon />,
      status: "Available",
      allowedRoles: [1, 2],
    },
    {
      title: "System Settings",
      description: "Review language setup and remaining system configuration work.",
      path: "/admin/settings",
      icon: <SettingsIcon />,
      status: "Available",
      allowedRoles: [1, 2],
    },
  ];

  const visibleModules = modules.filter((module) =>
    module.allowedRoles.includes(user?.role_id),
  );

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
            {user?.role_id === 2 ? "Company Admin Portal" : "Admin Portal"}
          </h1>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Manage companies, users, videos, certificates, analytics, and platform controls.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/change-password")}
            style={{
              padding: "10px 16px",
              background: "#eef4f8",
              color: "#17324d",
              border: "1px solid #cdd9e2",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Change Password
          </button>
          <button
            onClick={logout}
            style={{
              padding: "10px 16px",
              background: "#c0392b",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 700,
            }}
          >
            <LogoutIcon fontSize="small" />
            Logout
          </button>
        </div>
      </div>

      <section style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
          }}
        >
          {loadingAnalytics ? (
            <div style={{ ...cardStyle, color: "#64748b" }}>Loading analytics...</div>
          ) : analyticsError ? (
            <div
              style={{
                ...cardStyle,
                borderColor: "#f3b4ae",
                background: "#fff7f6",
                color: "#c0392b",
              }}
            >
              {analyticsError}
            </div>
          ) : (
            stats.map((stat) => (
              <div key={stat.label} style={cardStyle}>
                <div style={statLabelStyle}>{stat.label}</div>
                <div style={statValueStyle}>{stat.value}</div>
              </div>
            ))
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
          {visibleModules.map((module) => {
            const enabled = Boolean(module.path);
            return (
              <button
                key={module.title}
                type="button"
                onClick={() => enabled && navigate(module.path)}
                disabled={!enabled}
                style={{
                  ...cardStyle,
                  textAlign: "left",
                  cursor: enabled ? "pointer" : "not-allowed",
                  opacity: enabled ? 1 : 0.78,
                  minHeight: "156px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <div style={{ color: "#17324d", display: "flex" }}>{module.icon}</div>
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
    </div>
  );
}
