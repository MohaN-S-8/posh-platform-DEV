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
    subtitle: "XYZ Portal overview across services, organizations, users, certificates, and approvals.",
    scope: "All companies",
    checklist: ["Companies configured", "Services assigned", "Certificates issued", "Reports available"],
  },
  2: {
    title: "Admin Home",
    subtitle: "Company-level PoSH operations, training governance, certificates, and received concerns.",
    scope: "Your company",
    checklist: ["Client / Management users created", "Training videos published", "Certificates configured", "Concerns reviewed"],
  },
  5: {
    title: "Client / Management Home",
    subtitle: "Management view for IC setup and company user readiness.",
    scope: "Your company",
    checklist: ["IC users ready", "Employee data monitored", "Training availability tracked", "Compliance reviewed"],
  },
  3: {
    title: "IC Home",
    subtitle: "Employee records, direct IC training, IC readiness, and reports.",
    scope: "Your company",
    checklist: ["Employees uploaded", "Training available", "Pending users followed up", "Reports downloaded"],
  },
  4: {
    title: "Employee Home",
    subtitle: "Your PoSH training, assessment, certificates, and confidential concern access.",
    scope: "My training",
    checklist: ["Training started", "Video watched", "Assessment completed", "Certificate downloaded"],
  },
};

function metricSet(user, data) {
  if (user?.role_id === 1) {
    return [
      { label: "Active Companies", value: data?.total_companies ?? 0, trend: "Platform live data" },
      { label: "Active Users", value: data?.total_users ?? 0, trend: "Across all companies" },
      { label: "Certificates", value: data?.total_certificates_issued ?? 0, trend: "Issued certificates" },
      { label: "Completions", value: data?.total_course_completions ?? 0, trend: "Training completions" },
      { label: "Compliance", value: `${data?.compliance_rate ?? 0}%`, trend: "Completed employees" },
      { label: "Pending Approvals", value: totalPendingApprovals(data), trend: "Needs Super Admin action" },
    ];
  }
  if (user?.role_id === 2) {
    return [
      { label: "Client Users", value: data?.client_users ?? 0, trend: "Client / Mgmt accounts" },
      { label: "Active", value: data?.active_client_users ?? 0, trend: "Ready to log in" },
      { label: "Inactive", value: data?.inactive_client_users ?? 0, trend: "Disabled accounts" },
      { label: "Company Scope", value: data?.company_scope ?? 0, trend: "Visible companies" },
    ];
  }
  if (user?.role_id === 3 || user?.role_id === 5) {
    return [
      { label: "Employees", value: data?.total_employees ?? 0, trend: "Company records" },
      { label: "Departments", value: data?.department_breakdown?.length ?? 0, trend: "Active groups" },
      { label: "Active Records", value: data?.total_employees ?? 0, trend: "Employee master" },
      { label: "Pending Follow-Up", value: data?.pending_followup ?? 0, trend: "Needs action" },
    ];
  }
  return [
    { label: "Available Courses", value: data?.total_courses ?? 0, trend: "My courses" },
    { label: "Completed", value: data?.completed ?? 0, trend: "Training done" },
    { label: "Pending", value: (data?.in_progress ?? 0) + (data?.not_started ?? 0), trend: "Still open" },
    { label: "Certificates", value: data?.certificates ?? 0, trend: `${data?.completion_rate ?? 0}% complete` },
  ];
}

function totalPendingApprovals(data) {
  const approvals = data?.approvals || {};
  return (
    (approvals.companies_pending || 0) +
    (approvals.videos_pending || 0) +
    (approvals.certificate_templates_pending || 0) +
    (approvals.open_concerns || 0)
  );
}

function loadEndpoint(user) {
  if (user?.role_id === 1) return "/analytics/overview";
  if (user?.role_id === 2) return "/users/";
  if (user?.role_id === 3 || user?.role_id === 5) return "/hr/employees/summary";
  return "/employee/summary";
}

function normalizeSummary(user, summary) {
  if (user?.role_id !== 2 || !Array.isArray(summary)) return summary;
  const clientUsers = summary.filter((row) => row.role_id === 5);
  return {
    client_users: clientUsers.length,
    active_client_users: clientUsers.filter((row) => row.status === "Active").length,
    inactive_client_users: clientUsers.filter((row) => row.status !== "Active").length,
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
  return rows.length ? rows : [["PoSH / Basic / Employee", "0 published / 0 draft"]];
}

export function StatsHomePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
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
            setError(apiErrorMessage(summaryRes.reason, "Home metrics are unavailable."));
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
              .filter(([service]) => String(service || "").toUpperCase() === "POSH")
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
          ["Average Pass Score", `${data?.assessments?.average_pass_score ?? 0}%`],
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
          ["Certificate Template", data?.approvals?.certificate_templates_pending ?? 0],
          ["Open Concerns", data?.approvals?.open_concerns ?? 0],
        ],
      },
    ];
  }, [data, user?.role_id]);

  return (
    <PortalShell title={content.title} subtitle={content.subtitle}>
      {error && (
        <div className="portal-card portal-home-error">
          {error}
        </div>
      )}

      {user?.role_id !== 1 && (
        <section className="portal-home-hero">
          <div>
            <div className="portal-home-eyebrow">Welcome back</div>
            <h2>{displayName}</h2>
            <p>
              {companyName} is happy to see your ownership and responsibility in taking
              the time to learn about the Prevention of Sexual Harassment (PoSH) policy.
            </p>
            <p>
              Every module you complete and every question you ask helps us build a
              workplace where everyone feels safe, respected and heard. Thank you for
              being part of that effort.
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
            <div className="portal-kpi-value">{loading ? "-" : metric.value}</div>
            <div className="portal-kpi-label">{metric.label}</div>
            <div className="portal-kpi-trend">{metric.trend}</div>
          </div>
        ))}
      </section>

      {user?.role_id === 1 && (
        <section style={sectionStyle}>
          <div className="portal-section-title">XYZ Hierarchy, Services & Organizations</div>
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
