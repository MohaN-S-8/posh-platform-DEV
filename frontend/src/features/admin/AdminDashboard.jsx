import { useEffect, useMemo, useState } from "react";
import { PortalNameSettings } from "../../components/PortalNameSettings";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const dashboardItems = [
  {
    title: "Home",
    description: "Role-based programme summary.",
    path: "/dashboard",
    accessItem: "Home",
  },
  {
    title: "PoSH Policy",
    description: "Company policy and IC details.",
    path: "/posh-policy",
    accessItem: "PoSH Policy",
  },
  {
    title: "Company Setup",
    description: "Create companies, work orders, and registration details.",
    path: "/admin/companies",
    accessItem: "Company Setup",
  },
  {
    title: "Create Admin",
    description: "Create Administrator accounts.",
    path: "/super-admin/create-admin",
    accessItem: "Create Admin",
  },
  {
    title: "Create IC",
    description: "Upgrade existing employees to IC users.",
    path: "/admin/create-ic",
    accessItem: "Create IC",
  },
  {
    title: "User Master",
    description: "Manage role-based company users.",
    path: "/admin/users",
    accessItem: "User Master",
  },
  {
    title: "Training",
    description:
      "Upload videos and choose Employee, IC Member Training, or PoSH Training for IC Member.",
    path: "/admin/videos",
    accessItem: "PoSH Training",
  },
  {
    title: "Certificates",
    description: "Certificate templates and verification setup.",
    path: "/admin/certificates",
    accessItem: "Assessment & Certificate",
  },
  {
    title: "Compliance",
    description: "Training completion and compliance dashboard.",
    path: "/admin/compliance",
    accessItem: "POSH Compliance",
  },
  {
    title: "Complaints",
    description: "Review PoSH concerns and cases.",
    path: "/admin/concerns",
    accessItem: "POSH Complaints",
  },
  {
    title: "Audit",
    description: "Login and action audit history.",
    path: "/super-admin/audit-logs",
    accessItem: "Audit",
  },
  {
    title: "Analytics",
    description: "Platform and service-level metrics.",
    path: "/admin/analytics",
    accessItem: "Analytics & Reports",
  },
  {
    title: "Reports",
    description: "Download platform and service reports.",
    path: "/admin/reports",
    accessItem: "Analytics & Reports",
  },
  {
    title: "Client Status",
    description: "Master-company compliance status and employee report.",
    path: "/super-admin/client-status",
    accessItem: "Client Status",
  },
  {
    title: "Masters",
    description: "Country, state, city, and office masters.",
    path: "/super-admin/masters",
    accessItem: "Masters",
  },
  {
    title: "Role & Access Matrix",
    description: "Control exactly what each role can see.",
    path: "/super-admin/role-access",
    accessItem: "Role & Access Matrix",
  },
];

const roleLabels = {
  1: "Super Admin",
  2: "Admin",
  5: "Client Admin (Mgmt)",
  3: "IC",
  4: "Employee",
};

const accessItemAliases = {
  "POSH Audit": "Audit",
  "PoSH Audit": "Audit",
  "Company Registration - PoSH": "Company Setup",
  "Company Registration": "Company Setup",
  "Create Company & Work Order": "Company Setup",
  "Employee Master": "User Master",
  "Employee Master - PoSH": "User Master",
  "Masters (State/City/Scope)": "Masters",
  "PoSH Office Master": "Masters",
  "POSH Awareness Training": "PoSH Training",
  "My IC Training": "IC Member Training",
  "IC Training": "IC Member Training",
};

const normalizeAccessItem = (accessItem) =>
  accessItemAliases[accessItem] || accessItem;

const defaultAllowed = {
  "Super Admin": new Set([
    "Home",
    "PoSH Policy",
    "PoSH Training",
    "IC Member Training",
    "Advance Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "Audit",
    "Analytics & Reports",
    "Client Status",
    "Create Admin",
    "Create IC",
    "Masters",
    "Company Setup",
    "User Master",
    "Role & Access Matrix",
  ]),
  Admin: new Set([
    "Home",
    "PoSH Policy",
    "Company Setup",
    "User Master",
    "Create IC",
    "Masters",
    "PoSH Training",
    "IC Member Training",
  ]),
  "Client Admin (Mgmt)": new Set([
    "Home",
    "PoSH Policy",
    "PoSH Training",
    "IC Member Training",
    "Assessment & Certificate",
    "POSH Compliance",
    "POSH Complaints",
    "Audit",
    "Analytics & Reports",
    "User Master",
    "Create IC",
  ]),
};

export function AdminDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
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
          user?.role_id === 1 ? "/analytics/overview" : "/analytics/current";
        const res = await apiClient.get(endpoint);
        setAnalytics(res.data);
      } catch (err) {
        setAnalyticsError(
          apiErrorMessage(err, "Analytics are not available for this account."),
        );
      } finally {
        setLoadingAnalytics(false);
      }
    };

    loadAnalytics();
  }, [user?.company_id, user?.role_id]);

  const stats = useMemo(() => {
    if (!analytics) return [];
    if ([1, 2].includes(user?.role_id)) {
      return [
        {
          label: "Active Clients",
          value: analytics.companies?.active ?? analytics.total_companies ?? 0,
        },
        {
          label: "Active Employees",
          value: analytics.hierarchy?.employees ?? 0,
        },
        {
          label: "Completed Training",
          value: analytics.total_course_completions ?? 0,
        },
        {
          label: "Completed Pending",
          value: Math.max(
            (analytics.hierarchy?.employees ?? 0) -
              (analytics.training?.completed_users ?? 0),
            0,
          ),
        },
        {
          label: "Annual Returns Completed",
          value: analytics.annual_returns?.completed ?? 0,
        },
        {
          label: "Annual Returns Pending",
          value: analytics.annual_returns?.pending ?? 0,
        },
      ];
    }
    if (user?.role_id === 2 || user?.role_id === 5) {
      return [
        {
          label: "Active Clients",
          value:
            analytics.client_management_users ?? analytics.total_users ?? 0,
        },
        { label: "Active Employees", value: analytics.total_employees ?? 0 },
        {
          label: "Completed Training",
          value: analytics.completed_training ?? 0,
        },
        {
          label: "Completed Pending",
          value:
            (analytics.in_progress_training ?? 0) +
            (analytics.not_started_training ?? 0),
        },
        {
          label: "Annual Returns Completed",
          value: analytics.annual_returns?.completed ?? 0,
        },
        {
          label: "Annual Returns Pending",
          value: analytics.annual_returns?.pending ?? 0,
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

  const organizationRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (analytics?.organizations || [])
      .map((org) => ({
        ...org,
        annual_return_status: org.annual_return_status || "Pending",
      }))
      .filter((org) => {
        if (!query) return true;
        return [
          org.company_name,
          org.annual_return_status,
          org.status,
          org.approval_status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [analytics?.organizations, searchQuery]);

  const allowedItems = useMemo(() => {
    const accessMap = new Map(
      roleAccess.map((record) => [
        normalizeAccessItem(record.access_item),
        Boolean(record.is_allowed),
      ]),
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
            ? "Admin Portal"
            : "Super Admin Portal"
      }
      subtitle="Manage the workflows available to your role."
    >
      <PortalNameSettings />
      <section style={{ marginBottom: "28px" }}>
        <div className="portal-section-title">Programme Snapshot</div>
        <div className="portal-auto-grid">
          {loadingAnalytics ? (
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

      {[1, 2].includes(user?.role_id) && (
        <section style={{ marginBottom: "28px" }}>
          <div className="portal-section-title">Company Status Search</div>
          <div style={searchPanelStyle}>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by company name, annual return status, or active status"
              style={searchInputStyle}
            />
          </div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["Co Name", "Annual Return Status", "Active Status"].map(
                    (heading) => (
                      <th key={heading} style={thStyle}>
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {organizationRows.map((org) => (
                  <tr key={org.company_id} style={trStyle}>
                    <td style={tdStyle}>{org.company_name}</td>
                    <td style={tdStyle}>{org.annual_return_status}</td>
                    <td style={tdStyle}>{org.status || "-"}</td>
                  </tr>
                ))}
                {!loadingAnalytics && organizationRows.length === 0 && (
                  <tr style={trStyle}>
                    <td
                      colSpan={3}
                      style={{
                        ...tdStyle,
                        color: "var(--portal-muted)",
                        textAlign: "center",
                      }}
                    >
                      No companies match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
              <p
                style={{
                  margin: 0,
                  color: "var(--portal-muted)",
                  lineHeight: 1.5,
                }}
              >
                {item.description}
              </p>
            </button>
          ))}
          {allowedItems.length === 0 && (
            <div
              className="portal-card"
              style={{ color: "var(--portal-muted)" }}
            >
              No modules are assigned to this role yet.
            </div>
          )}
        </div>
      </section>
    </PortalShell>
  );
}

const searchPanelStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "12px",
  marginBottom: "12px",
};

const searchInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--portal-border)",
  borderRadius: "7px",
  padding: "10px 12px",
  fontSize: "14px",
};

const tableWrapStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: "620px",
  borderCollapse: "collapse",
};

const thStyle = {
  padding: "12px",
  textAlign: "left",
  background: "#faf8ff",
  color: "var(--portal-muted)",
  fontSize: "12px",
  textTransform: "uppercase",
};

const trStyle = {
  borderTop: "1px solid var(--portal-border)",
};

const tdStyle = {
  padding: "11px 12px",
  color: "var(--portal-text)",
};
