import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import BusinessIcon from "@mui/icons-material/Business";
import HistoryIcon from "@mui/icons-material/History";
import PeopleIcon from "@mui/icons-material/People";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../utils/accessControl";

export function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (user?.role_id === 5) {
        setAnalytics(null);
        setAnalyticsError("");
        setLoadingAnalytics(false);
        return;
      }
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
      description: "Create the next role in the management flow and maintain user access.",
      path: "/admin/users",
      icon: <PeopleIcon />,
      status: "Available",
      allowedRoles: [1, 2, 5],
      requiredPermission: "users.manage",
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
      requiredPermission: "videos.manage",
    },
    {
      title: "Certificate Module",
      description: "Create certificate templates and manage generated certificate setup.",
      path: "/admin/certificates",
      icon: <BadgeIcon />,
      status: "Available",
      allowedRoles: [1, 2],
      requiredPermission: "certificates.manage",
    },
    {
      title: "Analytics",
      description: "Platform and company-level training metrics.",
      path: "/admin/analytics",
      icon: <AssessmentIcon />,
      status: "Available",
      allowedRoles: [1, 2],
      requiredPermission: "reports.view",
    },
    {
      title: "Audit Logs",
      description: "Review recent successful and failed login attempts.",
      path: "/admin/audit-logs",
      icon: <HistoryIcon />,
      status: "Available",
      allowedRoles: [1, 2],
      requiredPermission: "reports.view",
    },
    {
      title: "Reports",
      description: "Download available Excel reports for audits and management.",
      path: "/admin/reports",
      icon: <AssessmentIcon />,
      status: "Available",
      allowedRoles: [1, 2],
      requiredPermission: "reports.view",
    },
  ];

  const visibleModules = modules.filter((module) => canAccess(user, module));

  return (
    <PortalShell
      title={
        user?.role_id === 5
          ? "Client / Management Portal"
          : user?.role_id === 2
            ? "Admin Portal"
            : "Super Admin Portal"
      }
      subtitle="Manage the workflows available to your role."
    >

      <section style={{ marginBottom: "28px" }}>
        <div className="portal-section-title">Programme Snapshot</div>
        <div className="portal-auto-grid">
          {user?.role_id === 5 ? (
            <div className="portal-card">
              Create and manage HR / IC users for your company.
            </div>
          ) : loadingAnalytics ? (
            <div className="portal-card">Loading analytics...</div>
          ) : analyticsError ? (
            <div
              className="portal-card"
              style={{
                borderColor: "#f3b4ae",
                background: "#fff7f6",
                color: "#c0392b",
              }}
            >
              {analyticsError}
            </div>
          ) : (
            stats.map((stat) => (
              <div key={stat.label} className="portal-card">
                <div className="portal-kpi-value">{stat.value}</div>
                <div className="portal-kpi-label">{stat.label}</div>
                <div className="portal-kpi-trend">Live platform data</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="portal-section-title">Admin Workspace</div>
        <div className="portal-auto-grid">
          {visibleModules.map((module) => {
            const enabled = Boolean(module.path);
            return (
              <button
                key={module.title}
                type="button"
                onClick={() => enabled && navigate(module.path)}
                disabled={!enabled}
                className="portal-card portal-tile"
                style={{ cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.78 }}
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
                  <div style={{ color: "#4A2E83", display: "flex" }}>{module.icon}</div>
                  <span
                    className={`portal-badge ${
                      module.status === "Available" ? "portal-badge-green" : "portal-badge-purple"
                    }`}
                  >
                    {module.status}
                  </span>
                </div>
                <h3 style={{ fontSize: "14.5px" }}>{module.title}</h3>
                <p>{module.description}</p>
              </button>
            );
          })}
        </div>
      </section>
    </PortalShell>
  );
}
