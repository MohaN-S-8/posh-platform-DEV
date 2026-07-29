import BadgeIcon from "@mui/icons-material/Badge";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import GroupsIcon from "@mui/icons-material/Groups";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../utils/accessControl";

export function HRDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/hr/employees/summary");
        if (active) setData(res.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Employee dashboard metrics are unavailable.");
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

  const stats = useMemo(
    () => [
      { label: "Employees", value: data?.total_employees ?? 0 },
      { label: "Departments", value: data?.department_breakdown?.length ?? 0 },
      { label: "Active Records", value: data?.total_employees ?? 0 },
    ],
    [data],
  );

  const modules = [
    {
      title: "Employee Upload",
      description: "Import employee records with Excel or CSV validation.",
      path: "/hr/upload",
      icon: <CloudUploadIcon />,
      status: "Available",
      requiredPermission: "users.manage",
    },
    {
      title: "Employee Management",
      description:
        "Create, activate, deactivate, and reset employee accounts.",
      path: "/hr/users",
      icon: <GroupsIcon />,
      status: "Available",
      requiredPermission: "users.manage",
    },
    {
      title: "Reports",
      description: "Download employee reports for your company only.",
      path: "/hr/reports",
      icon: <DownloadIcon />,
      status: "Available",
      requiredPermission: "reports.view",
    },
    {
      title: "Employee Certificates",
      description:
        "Certificate activity remains visible through employee records only.",
      path: "/hr/users",
      icon: <BadgeIcon />,
      status: "Restricted",
      requiredPermission: "users.manage",
    },
  ];

  const visibleModules = modules.filter((module) => canAccess(user, module));

  return (
    <PortalShell title="HR Portal" subtitle="Employee records and upload controls for HR users.">

      {error && (
        <div
          className="portal-card"
          style={{
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
        <div className="portal-section-title">Employee Snapshot</div>
        <div className="portal-auto-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="portal-card">
              <div className="portal-kpi-value">{stat.value}</div>
              <div className="portal-kpi-label">{stat.label}</div>
              <div className="portal-kpi-trend">Current company</div>
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
        <div className="portal-card">
          <h2
            style={{ margin: "0 0 16px", fontSize: "14.5px" }}
          >
            Employee Departments
          </h2>
          {data?.department_breakdown?.length ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {data.department_breakdown.slice(0, 6).map((dept) => (
                <div key={dept.department}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "6px",
                      color: "#17324d",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    <span>{dept.department}</span>
                    <span>{dept.total}</span>
                  </div>
                  <div
                    className="portal-progress"
                  >
                    <div
                      className="portal-progress-bar"
                      style={{
                        width: `${Math.min(100, dept.total * 10)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#64748b", margin: 0 }}>
              Departments appear after employees are uploaded.
            </p>
          )}
        </div>

        <div className="portal-card">
          <h2
            style={{ margin: "0 0 16px", fontSize: "14.5px" }}
          >
            Access Scope
          </h2>
          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ color: "#64748b", fontSize: "14px" }}>
              HR access is restricted to the modules assigned to your role.
            </div>
            <button
              type="button"
              onClick={() => navigate("/hr/users")}
              style={{
                marginTop: "8px",
                padding: "9px 12px",
                background: "#4A2E83",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Manage Employees
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="portal-section-title">HR Workspace</div>
        <div className="portal-auto-grid">
          {visibleModules.map((module) => {
            const enabled = Boolean(module.path);
            return (
              <button
                key={module.title}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && navigate(module.path)}
                className="portal-card portal-tile"
                style={{ cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.75 }}
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
                  <span style={{ color: "#4A2E83", display: "flex" }}>
                    {module.icon}
                  </span>
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

      <LoadingOverlay
        show={loading}
        title="Loading HR dashboard"
        message="Fetching employee records and department status."
      />
    </PortalShell>
  );
}
