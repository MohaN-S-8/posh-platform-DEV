import DownloadIcon from "@mui/icons-material/Download";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const complianceContextForRole = (roleId) => {
  if (roleId === 1) {
    return {
      path: "/super-admin/compliance",
      backTarget: "/dashboard",
      backLabel: "Back to Super Admin Dashboard",
      title: "Super Admin Compliance",
      subtitle: "Platform-wide training status, department compliance, and overdue employees.",
    };
  }

  if (roleId === 2 || roleId === 5) {
    return {
      path: "/admin/compliance",
      backTarget: "/admin",
      backLabel: "Back to Admin Dashboard",
      title: "Admin Compliance",
      subtitle: "Company training compliance, department progress, and pending actions.",
    };
  }

  return {
    path: "/hr/compliance",
    backTarget: "/hr",
    backLabel: "Back to HR Dashboard",
    title: "HR Compliance",
    subtitle: "Employee training compliance and department progress for your company.",
  };
};

export function CompliancePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const complianceContext = complianceContextForRole(user?.role_id);

  useEffect(() => {
    if (user?.role_id && location.pathname !== complianceContext.path) {
      navigate(complianceContext.path, { replace: true });
    }
  }, [complianceContext.path, location.pathname, navigate, user?.role_id]);

  useEffect(() => {
    let active = true;
    const loadCompliance = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/hr/compliance/dashboard");
        if (active) setData(res.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to load compliance dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCompliance();
    return () => {
      active = false;
    };
  }, []);

  const downloadReport = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await apiClient.get("/hr/reports/employees", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "employee_training_report.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.detail || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const stats = [
    { label: "Total Employees", value: data?.total_employees ?? 0, trend: "Assigned users" },
    { label: "Completed", value: data?.completed ?? 0, trend: "Finished training" },
    { label: "In Progress", value: data?.in_progress ?? 0, trend: "Currently active" },
    { label: "Not Started", value: data?.not_started ?? 0, trend: "Awaiting start" },
  ];
  const complianceRate = data?.compliance_rate ?? 0;
  const complianceBadge =
    complianceRate >= 80 ? "portal-badge-green" : complianceRate >= 50 ? "portal-badge-amber" : "portal-badge-purple";

  return (
    <PortalShell title={complianceContext.title} subtitle={complianceContext.subtitle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(complianceContext.backTarget)}
          className="portal-outline-btn"
        >
          {complianceContext.backLabel}
        </button>
        <button
          type="button"
          onClick={downloadReport}
          disabled={downloading}
          className="portal-primary-btn"
          style={{ opacity: downloading ? 0.72 : 1 }}
        >
          <DownloadIcon fontSize="small" />
          {downloading ? "Downloading..." : "Download Excel Report"}
        </button>
      </div>

      {error && (
        <div
          className="portal-card"
          style={{
            border: "1px solid #f3b4ae",
            background: "#fff7f6",
            color: "#c0392b",
            marginBottom: "18px",
          }}
        >
          {error}
        </div>
      )}

      <section style={{ marginBottom: "28px" }}>
        <div className="portal-section-title">Compliance Snapshot</div>
        <div className="portal-auto-grid">
          {stats.map(({ label, value, trend }) => (
            <div key={label} className="portal-card">
              <div className="portal-kpi-value">{value}</div>
              <div className="portal-kpi-label">{label}</div>
              <div className="portal-kpi-trend">{trend}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "28px" }}>
        <div className="portal-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <div>
              <div className="portal-section-title" style={{ margin: 0 }}>
                Overall Compliance Rate
              </div>
              <p style={{ margin: "6px 0 0", color: "var(--portal-muted)" }}>
                Completion percentage across assigned training.
              </p>
            </div>
            <span className={`portal-badge ${complianceBadge}`} style={{ fontSize: "14px" }}>
              {complianceRate}%
            </span>
          </div>
          <div className="portal-progress" style={{ height: "14px" }}>
            <div
              className="portal-progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, complianceRate))}%` }}
            />
          </div>
        </div>
      </section>

      <section className="portal-card" style={{ marginBottom: "28px", overflowX: "auto" }}>
        <div className="portal-section-title" style={{ marginTop: 0 }}>
          Department Compliance
        </div>
        <table className="portal-table" style={{ minWidth: "640px" }}>
          <thead>
            <tr>
              {["Department", "Employees", "Completed", "Pending", "Compliance"].map(
                (h, index) => (
                  <th
                    key={h}
                    style={{
                      textAlign: index === 0 ? "left" : "right",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data?.department_breakdown?.length ? (
              data.department_breakdown.map((dept) => (
                <tr key={dept.department}>
                  <td>{dept.department}</td>
                  {[dept.total, dept.completed, dept.pending, `${dept.compliance_rate}%`].map(
                    (value, index) => (
                      <td
                        key={index}
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          color: "var(--portal-purple)",
                        }}
                      >
                        {value}
                      </td>
                    ),
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ color: "var(--portal-muted)" }}>
                  No department data available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {data?.overdue_employees?.length > 0 && (
        <section className="portal-card" style={{ overflowX: "auto" }}>
          <div className="portal-section-title" style={{ marginTop: 0, color: "#c0392b" }}>
            Overdue Employees ({data.overdue_employees.length})
          </div>
          <table className="portal-table" style={{ minWidth: "520px" }}>
            <thead>
              <tr>
                {["Name", "Email", "Due Date"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      color: "#c0392b",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.overdue_employees.map((emp, index) => (
                <tr key={`${emp.email}-${index}`}>
                  <td>{emp.name}</td>
                  <td style={{ color: "var(--portal-muted)" }}>{emp.email}</td>
                  <td style={{ color: "#c0392b", fontWeight: 700 }}>
                    {emp.due_date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <LoadingOverlay
        show={loading || downloading}
        title={downloading ? "Downloading report" : "Loading compliance"}
        message={
          downloading
            ? "Preparing the employee training report."
            : "Fetching training status and department compliance."
        }
      />
    </PortalShell>
  );
}
