import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const dashboardItems = [
  { title: "Home", description: "Role-based programme summary.", path: "/dashboard", accessItem: "Home" },
  { title: "PoSH Policy", description: "Company policy and IC details.", path: "/posh-policy", accessItem: "PoSH Policy" },
  { title: "Create Company & Work Order", description: "Company setup and work order tracking.", path: "/admin/companies", accessItem: "Create Company & Work Order" },
  { title: "Company Registration", description: "PoSH registration details and admin setup.", path: "/admin/company-registration", accessItem: "Company Registration - PoSH" },
  { title: "Create Admin", description: "Create company administrator accounts.", path: "/super-admin/create-admin", accessItem: "Create Admin" },
  { title: "Employee Master", description: "Manage role-based company users.", path: "/admin/users", accessItem: "Employee Master - PoSH" },
  { title: "Training Videos", description: "Upload and manage training content.", path: "/admin/videos", accessItem: "POSH Awareness Training" },
  { title: "Certificates", description: "Certificate templates and verification setup.", path: "/admin/certificates", accessItem: "Assessment & Certificate" },
  { title: "Compliance", description: "Training completion and compliance dashboard.", path: "/admin/compliance", accessItem: "POSH Compliance" },
  { title: "Complaints", description: "Review PoSH concerns and cases.", path: "/admin/concerns", accessItem: "POSH Complaints" },
  { title: "Audit", description: "Login and action audit history.", path: "/super-admin/audit-logs", accessItem: "POSH Audit" },
  { title: "Analytics", description: "Training and certificate reports.", path: "/admin/analytics", accessItem: "Analytics & Reports" },
  { title: "Reports", description: "Download audit-ready reports.", path: "/admin/reports", accessItem: "Analytics & Reports" },
  { title: "Masters", description: "State, city, scope, and platform masters.", path: "/super-admin/masters", accessItem: "Masters (State/City/Scope)" },
  { title: "PoSH Office Master", description: "Configure PoSH office records.", path: "/super-admin/posh-office-master", accessItem: "PoSH Office Master" },
  { title: "Role & Access Matrix", description: "Control exactly what each role can see.", path: "/super-admin/role-access", accessItem: "Role & Access Matrix" },
];

const roleLabels = {
  1: "Super Admin",
  2: "Company Admin",
  5: "Client Admin (Mgmt)",
  3: "HR",
  4: "Employee",
};

const defaultAllowed = {
  "Super Admin": new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "IC Training",
    "Advance Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "POSH Audit",
    "Analytics & Reports",
    "Create Admin",
    "Masters (State/City/Scope)",
    "Create Company & Work Order",
    "Company Registration - PoSH",
    "Employee Master - PoSH",
    "PoSH Office Master",
    "Role & Access Matrix",
  ]),
  "Company Admin": new Set([
    "Home",
    "PoSH Policy",
    "Create Company & Work Order",
    "Company Registration - PoSH",
    "Employee Master - PoSH",
  ]),
  "Client Admin (Mgmt)": new Set([
    "Home",
    "PoSH Policy",
    "POSH Awareness Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "POSH Audit",
    "Analytics & Reports",
    "Employee Master - PoSH",
  ]),
};

export function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [roleAccess, setRoleAccess] = useState([]);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    const loadRoleAccess = async () => {
      setAccessError("");
      try {
        const res = await apiClient.get("/admin-config/my-role-access");
        setRoleAccess(res.data || []);
      } catch (err) {
        setAccessError(apiErrorMessage(err, "Unable to load role access."));
      }
    };

    loadRoleAccess();
  }, []);

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

  const allowedItems = useMemo(() => {
    const accessMap = new Map(
      roleAccess.map((record) => [record.access_item, Boolean(record.is_allowed)]),
    );
    const fallback = defaultAllowed[roleLabels[user?.role_id]] || new Set();

    return dashboardItems.filter((item) => {
      if (accessMap.has(item.accessItem)) return accessMap.get(item.accessItem);
      return fallback.has(item.accessItem);
    });
  }, [roleAccess, user?.role_id]);

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
              Your available modules are controlled by the Role & Access Matrix below.
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
        {accessError && (
          <div
            className="portal-card"
            style={{
              borderColor: "#f3b4ae",
              background: "#fff7f6",
              color: "#c0392b",
              marginBottom: "16px",
            }}
          >
            {accessError}
          </div>
        )}
        <div className="portal-auto-grid">
          {allowedItems.map((item) => (
            <button
              type="button"
              key={`${item.accessItem}-${item.path}`}
              className="portal-card"
              onClick={() => navigate(item.path)}
              style={{
                textAlign: "left",
                border: "1px solid var(--portal-border)",
                cursor: "pointer",
              }}
            >
              <h3 style={{ margin: "0 0 8px", color: "var(--portal-text)" }}>
                {item.title}
              </h3>
              <p style={{ margin: 0, color: "var(--portal-muted)", lineHeight: 1.5 }}>
                {item.description}
              </p>
            </button>
          ))}
          {allowedItems.length === 0 && (
            <div className="portal-card" style={{ color: "var(--portal-muted)" }}>
              No modules are assigned to this role yet.
            </div>
          )}
        </div>
      </section>
    </PortalShell>
  );
}
