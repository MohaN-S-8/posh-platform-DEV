import ShieldIcon from "@mui/icons-material/Shield";
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const roleContent = {
  1: {
    title: "Super Admin Home",
    subtitle:
      "XYZ Portal overview across services, organizations, users, certificates, and approvals.",
    scope: "All companies",
    checklist: [
      "Companies configured",
      "Services assigned",
      "Certificates issued",
      "Reports available",
    ],
  },
  2: {
    title: "Admin Home",
    subtitle:
      "Company-level PoSH operations, training governance, certificates, and received concerns.",
    scope: "Your company",
    checklist: [
      "Client / Management users created",
      "Training videos published",
      "Certificates configured",
      "Concerns reviewed",
    ],
  },
  5: {
    title: "Client / Management Home",
    subtitle: "Management view for IC setup and company user readiness.",
    scope: "Your company",
    checklist: [
      "IC users ready",
      "Employee data monitored",
      "Training availability tracked",
      "Compliance reviewed",
    ],
  },
  3: {
    title: "IC Home",
    subtitle:
      "Employee records, direct IC training, IC readiness, and reports.",
    scope: "Your company",
    checklist: [
      "Employees uploaded",
      "Training available",
      "Pending users followed up",
      "Reports downloaded",
    ],
  },
  4: {
    title: "Employee Home",
    subtitle:
      "Your PoSH training, assessment, certificates, and confidential concern access.",
    scope: "My training",
    checklist: [
      "Training started",
      "Video watched",
      "Assessment completed",
      "Certificate downloaded",
    ],
  },
};

function metricSet(user, data) {
  if (user?.role_id === 1) {
    return [
      {
        label: "Active Clients",
        value: data?.companies?.active ?? data?.total_companies ?? 0,
        trend: "Platform live data",
      },
      {
        label: "Active Employees",
        value: data?.hierarchy?.employees ?? 0,
        trend: "Across all companies",
      },
      {
        label: "Completed Training",
        value: data?.total_course_completions ?? 0,
        trend: "Training completions",
      },
      {
        label: "Completed Pending",
        value: Math.max(
          (data?.hierarchy?.employees ?? 0) -
            (data?.training?.completed_users ?? 0),
          0,
        ),
        trend: "Not completed yet",
      },
      {
        label: "Annual Returns Completed",
        value: data?.annual_returns?.completed ?? 0,
        trend: "Annual return module",
      },
      {
        label: "Annual Returns Pending",
        value: data?.annual_returns?.pending ?? 0,
        trend: "Annual return module",
      },
    ];
  }
  if (user?.role_id === 2) {
    return [
      {
        label: "Active Clients",
        value: data?.client_management_users ?? data?.total_users ?? 0,
        trend: "Client / Mgmt accounts",
      },
      {
        label: "Active Employees",
        value: data?.total_employees ?? 0,
        trend: "Company records",
      },
      {
        label: "Completed Training",
        value: data?.completed_training ?? 0,
        trend: "Training completions",
      },
      {
        label: "Completed Pending",
        value:
          (data?.in_progress_training ?? 0) + (data?.not_started_training ?? 0),
        trend: "Still open",
      },
      {
        label: "Annual Returns Completed",
        value: data?.annual_returns?.completed ?? 0,
        trend: "Annual return module",
      },
      {
        label: "Annual Returns Pending",
        value: data?.annual_returns?.pending ?? 0,
        trend: "Annual return module",
      },
    ];
  }
  if (user?.role_id === 3 || user?.role_id === 5) {
    return [
      {
        label: "Employees",
        value: data?.total_employees ?? 0,
        trend: "Company records",
      },
      {
        label: "Departments",
        value: data?.department_breakdown?.length ?? 0,
        trend: "Active groups",
      },
      {
        label: "Active Records",
        value: data?.total_employees ?? 0,
        trend: "Employee master",
      },
      {
        label: "Pending Follow-Up",
        value: data?.pending_followup ?? 0,
        trend: "Needs action",
      },
    ];
  }
  return [
    {
      label: "Available Courses",
      value: data?.total_courses ?? 0,
      trend: "My courses",
    },
    { label: "Completed", value: data?.completed ?? 0, trend: "Training done" },
    {
      label: "Pending",
      value: (data?.in_progress ?? 0) + (data?.not_started ?? 0),
      trend: "Still open",
    },
    {
      label: "Certificates",
      value: data?.certificates ?? 0,
      trend: `${data?.completion_rate ?? 0}% complete`,
    },
  ];
}

function loadEndpoint(user) {
  if (user?.role_id === 1) return "/analytics/overview";
  if (user?.role_id === 2) return "/analytics/current";
  if (user?.role_id === 3 || user?.role_id === 5)
    return "/hr/employees/summary";
  return "/employee/summary";
}

function normalizeSummary(user, summary) {
  if (user?.role_id !== 2 || !Array.isArray(summary)) return summary;
  const clientUsers = summary.filter((row) => row.role_id === 5);
  return {
    client_users: clientUsers.length,
    active_client_users: clientUsers.filter((row) => row.status === "Active")
      .length,
    inactive_client_users: clientUsers.filter((row) => row.status !== "Active")
      .length,
    company_scope: new Set(clientUsers.map((row) => row.company_id)).size,
  };
}

function trainingLibraryRows(serviceTraining) {
  const rows = [];
  Object.entries(serviceTraining || {})
    .filter(([service]) => String(service || "").toUpperCase() === "POSH")
    .forEach(([service, levels]) => {
      Object.entries(levels || {}).forEach(([level, audiences]) => {
        Object.entries(audiences || {}).forEach(([audience, counts]) => {
          rows.push([
            `${service} / ${level} / ${audience}`,
            `${counts.published || 0} published / ${counts.draft || 0} draft`,
          ]);
        });
      });
    });
  return rows.length
    ? rows
    : [["PoSH / Basic / Employee", "0 published / 0 draft"]];
}

export function StatsHomePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const content = roleContent[user?.role_id] || roleContent[4];

  useEffect(() => {
    let active = true;
    const loadHome = async () => {
      setLoading(true);
      setError("");
      try {
        const [summaryRes, profileRes] = await Promise.allSettled([
          apiClient.get(loadEndpoint(user)),
          apiClient.get("/auth/me"),
        ]);
        if (active) {
          if (summaryRes.status === "fulfilled") {
            setData(normalizeSummary(user, summaryRes.value.data));
          } else {
            setData(null);
            setError(
              apiErrorMessage(
                summaryRes.reason,
                "Home metrics are unavailable.",
              ),
            );
          }
          if (profileRes.status === "fulfilled") {
            setProfile(profileRes.value.data);
          }
        }
      } catch {
        if (active) setError("Home metrics are unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadHome();
    return () => {
      active = false;
    };
  }, [user]);

  const metrics = useMemo(() => metricSet(user, data), [data, user]);
  const organizationRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (data?.organizations || [])
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
  }, [data?.organizations, searchQuery]);
  const displayName = profile?.full_name || profile?.first_name || "there";
  const companyName = profile?.company_name || "Your company";
  const superAdminSections = useMemo(() => {
    if (user?.role_id !== 1) return [];
    return [
      {
        title: "Hierarchy",
        rows: [
          ["Super Admin", data?.hierarchy?.super_admins ?? 0],
          ["Company Admin", data?.hierarchy?.company_admins ?? 0],
          ["Client / Management", data?.hierarchy?.client_management ?? 0],
          ["IC", data?.hierarchy?.hr_users ?? 0],
          ["Employees", data?.hierarchy?.employees ?? 0],
        ],
      },
      {
        title: "Organizations",
        rows: [
          ["Total Companies", data?.organizations?.length ?? 0],
          ["Approved Companies", data?.companies?.approved ?? 0],
          ["Pending Approval", data?.companies?.pending ?? 0],
          ["Active Companies", data?.companies?.active ?? 0],
        ],
      },
      {
        title: "Services Provided",
        rows: Object.entries(data?.services || {}).filter(
          ([service]) => String(service || "").toUpperCase() === "POSH",
        ).length
          ? Object.entries(data.services)
              .filter(
                ([service]) => String(service || "").toUpperCase() === "POSH",
              )
              .map(([service, value]) => [
                service,
                `${value.companies} org / ${value.employees} emp / ${value.certificates} cert`,
              ])
          : [["PoSH", "0 org / 0 emp / 0 cert"]],
      },
      {
        title: "Training & Videos",
        rows: [
          ["Published Videos", data?.videos?.published ?? 0],
          ["Draft / Approval Videos", data?.videos?.draft ?? 0],
          ["Archived Videos", data?.videos?.archived ?? 0],
          ["Assignments", data?.training?.assignments ?? 0],
          ["In Progress", data?.training?.in_progress ?? 0],
        ],
      },
      {
        title: "Training Library By Service",
        rows: trainingLibraryRows(data?.service_training),
      },
      {
        title: "Assessments & Certificates",
        rows: [
          ["Assessment Passed", data?.assessments?.passed ?? 0],
          ["Assessment Failed", data?.assessments?.failed ?? 0],
          [
            "Average Pass Score",
            `${data?.assessments?.average_pass_score ?? 0}%`,
          ],
          ["Certificates Issued", data?.certificates?.issued ?? 0],
          ["Templates Pending", data?.certificates?.templates_pending ?? 0],
        ],
      },
      {
        title: "Concerns",
        rows: [
          ["Open", data?.concerns?.open ?? 0],
          ["Reviewed", data?.concerns?.reviewed ?? 0],
          ["Closed", data?.concerns?.closed ?? 0],
          ["Total", data?.concerns?.total ?? 0],
        ],
      },
      {
        title: "Approval Queue",
        rows: [
          ["Company Approval", data?.approvals?.companies_pending ?? 0],
          ["Video Publish", data?.approvals?.videos_pending ?? 0],
          [
            "Certificate Template",
            data?.approvals?.certificate_templates_pending ?? 0,
          ],
          ["Open Concerns", data?.approvals?.open_concerns ?? 0],
        ],
      },
    ];
  }, [data, user?.role_id]);

  return (
    <PortalShell title={content.title} subtitle={content.subtitle}>
      {error && <div className="portal-card portal-home-error">{error}</div>}

      {user?.role_id !== 1 && (
        <section className="portal-home-hero">
          <div>
            <div className="portal-home-eyebrow">Welcome back</div>
            <h2>{displayName}</h2>
            <p>
              {companyName} is happy to see your ownership and responsibility in
              taking the time to learn about the Prevention of Sexual Harassment
              (PoSH) policy.
            </p>
            <p>
              Every module you complete and every question you ask helps us
              build a workplace where everyone feels safe, respected and heard.
              Thank you for being part of that effort.
            </p>
          </div>
          <div className="portal-home-shield">
            <ShieldIcon />
            <span>XYZ</span>
          </div>
        </section>
      )}

      <section className="portal-grid-4 portal-home-kpis">
        {metrics.map((metric) => (
          <div className="portal-card" key={metric.label}>
            <div className="portal-kpi-value">
              {loading ? "-" : metric.value}
            </div>
            <div className="portal-kpi-label">{metric.label}</div>
            <div className="portal-kpi-trend">{metric.trend}</div>
          </div>
        ))}
      </section>

      {[1, 2].includes(user?.role_id) && (
        <section style={sectionStyle}>
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
                {!loading && organizationRows.length === 0 && (
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

      {user?.role_id === 1 && (
        <section style={sectionStyle}>
          <div className="portal-section-title">
            XYZ Hierarchy, Services & Organizations
          </div>
          <div className="portal-auto-grid">
            {superAdminSections.map((section) => (
              <article key={section.title} className="portal-card">
                <h3 style={sectionTitleStyle}>{section.title}</h3>
                <div style={sectionRowsStyle}>
                  {section.rows.map(([label, value]) => (
                    <div key={label} style={sectionRowStyle}>
                      <span>{label}</span>
                      <strong>{loading ? "-" : value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {user?.role_id === 1 && (
        <section style={sectionStyle}>
          <div className="portal-section-title">Organizations By Service</div>
          <div className="portal-auto-grid">
            {(data?.organizations || []).slice(0, 12).map((org) => (
              <article key={org.company_id} className="portal-card">
                <h3 style={sectionTitleStyle}>{org.company_name}</h3>
                <div style={sectionRowsStyle}>
                  <div style={sectionRowStyle}>
                    <span>Services</span>
                    <strong>{org.services?.join(", ") || "-"}</strong>
                  </div>
                  <div style={sectionRowStyle}>
                    <span>Employees</span>
                    <strong>{loading ? "-" : org.employees}</strong>
                  </div>
                  <div style={sectionRowStyle}>
                    <span>Certificates</span>
                    <strong>{loading ? "-" : org.certificates}</strong>
                  </div>
                  <div style={sectionRowStyle}>
                    <span>Approval</span>
                    <strong>{org.approval_status}</strong>
                  </div>
                </div>
              </article>
            ))}
            {!loading && !data?.organizations?.length && (
              <div className="portal-card">No organizations created yet.</div>
            )}
          </div>
        </section>
      )}

      <LoadingOverlay
        show={loading}
        title="Loading home"
        message="Preparing your role-based XYZ Portal home page."
      />
    </PortalShell>
  );
}

export default StatsHomePage;

const sectionStyle = {
  marginTop: "26px",
};

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

const sectionTitleStyle = {
  margin: "0 0 12px",
  color: "var(--portal-purple)",
  fontSize: "16px",
};

const sectionRowsStyle = {
  display: "grid",
  gap: "10px",
};

const sectionRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "8px 0",
  borderBottom: "1px solid var(--portal-border)",
  color: "var(--portal-muted)",
  fontSize: "14px",
};
