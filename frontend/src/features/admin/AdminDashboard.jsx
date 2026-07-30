import { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

export function AdminDashboard() {
  const { user } = useAuthStore();
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

  return (
    <PortalShell
      title={
        user?.role_id === 5
          ? "Client / Management Portal"
          : user?.role_id === 2
            ? "Corp Admin Portal"
            : "Super Admin Portal"
      }
      subtitle="Manage the workflows available to your role."
    >

      <section style={{ marginBottom: "28px" }}>
        <div className="portal-section-title">Programme Snapshot</div>
        <div className="portal-auto-grid">
          {user?.role_id === 5 ? (
            <div className="portal-card">
              Admin modules are hidden until Super Admin aligns RBAC for this role.
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
          <div className="portal-card" style={{ color: "var(--portal-muted)" }}>
            Admin modules are hidden until RBAC is aligned.
          </div>
        </div>
      </section>
    </PortalShell>
  );
}
