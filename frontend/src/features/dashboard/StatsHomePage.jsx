import ShieldIcon from "@mui/icons-material/Shield";
import PropTypes from "prop-types";
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
  if (user?.role_id === 3) {
    return [
      {
        label: "IC Courses",
        value: data?.total_courses ?? 0,
        trend: "Assigned IC training",
      },
      {
        label: "Completed",
        value: data?.completed ?? 0,
        trend: "Training done",
      },
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
  if (user?.role_id === 5) {
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
        trend: "User Master",
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
  if (user?.role_id === 3) return "/employee/summary?training_type=ic";
  if (user?.role_id === 5) return "/hr/employees/summary";
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

function Badge({ tone = "amber", children }) {
  return (
    <span style={{ ...badgeStyle, ...badgeToneStyle[tone] }}>{children}</span>
  );
}

Badge.propTypes = {
  tone: PropTypes.oneOf(["green", "amber", "red"]),
  children: PropTypes.node.isRequired,
};

function OrganizationStatusPanel({ org, trainingRows, onClose }) {
  const icMembers = trainingRows.filter((row) =>
    String(row.role || "")
      .toLowerCase()
      .includes("ic"),
  );
  const annualFiled = org.annual_return_status === "Filed" ? "Yes" : "No";
  const deliverables = [
    "IC Policy Creation",
    "Constitution of Committee",
    "Employee Awareness Training",
    "IC Training",
    "Advance Training",
    "Display of Posters & Notices",
    "Complaint Process",
    "Enquiry Process",
    "POSH Compliance",
    "Annual Returns",
    "Audit & Reviews",
    "Assessment & Certificates",
  ];

  const exportReport = () => {
    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>${org.company_name} PoSH Status</title>
          <style>
            body { font-family: Arial, sans-serif; color: #172033; padding: 32px; }
            h1 { color: #3f247a; font-size: 22px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            td, th { border: 1px solid #d9ddea; padding: 9px; text-align: left; }
            th { background: #f5f1ff; }
            .ok { color: #047857; font-weight: 700; }
          </style>
        </head>
        <body>
          <button onclick="window.print()">Print</button>
          <h1>${org.company_name} - Full PoSH Status</h1>
          <table>
            <tbody>
              <tr><th>Client ID</th><td>${org.client_id || "-"}</td><th>Frequency</th><td>${org.frequency || "-"}</td></tr>
              <tr><th>Access Mode</th><td>Portal Access</td><th>Billing</th><td>${org.billing || "-"}</td></tr>
              <tr><th>Start / Stop</th><td>${[org.start_date, org.stop_date].filter(Boolean).join(" / ") || "-"}</td><th>Assigned To</th><td>${org.assigned_to_name || "-"}</td></tr>
              <tr><th>Employees</th><td>${org.employees ?? 0}</td><th>Annual Return Filed</th><td>${annualFiled}</td></tr>
              <tr><th>Open Complaints</th><td>${org.open_complaints ?? 0}</td><th>Training</th><td>${org.training_rate ?? 0}%</td></tr>
            </tbody>
          </table>
          <h2>Deliverables</h2>
          <ul>${deliverables.map((item) => `<li class="ok">✓ ${item}</li>`).join("")}</ul>
          <h2>IC Members</h2>
          <ul>${icMembers.length ? icMembers.map((row) => `<li>${row.name} - ${row.role}</li>`).join("") : "<li>None on record</li>"}</ul>
        </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <section style={detailPanelStyle}>
      <h3 style={detailTitleStyle}>{org.company_name} - Full PoSH Status</h3>
      <div style={detailGridStyle}>
        <Detail label="Client ID" value={org.client_id || "-"} />
        <Detail label="Access Mode" value="Portal Access" />
        <Detail
          label="Start / Stop"
          value={
            [org.start_date, org.stop_date].filter(Boolean).join(" / ") || "-"
          }
        />
        <Detail label="Frequency" value={org.frequency || "-"} />
        <Detail label="Billing" value={org.billing || "-"} />
        <Detail label="Assigned To" value={org.assigned_to_name || "-"} />
        <Detail label="Employees on record" value={org.employees ?? 0} />
        <Detail label="Annual Return Due" value="31 January" />
        <Detail label="Annual Return Filed" value={annualFiled} />
        <Detail label="Open Complaints" value={org.open_complaints ?? 0} />
      </div>
      <div style={detailColumnsStyle}>
        <div>
          <h4 style={detailSectionTitleStyle}>Deliverables</h4>
          <div style={deliverableListStyle}>
            {deliverables.map((item) => (
              <span key={item}>✓ {item}</span>
            ))}
          </div>
        </div>
        <div>
          <h4 style={detailSectionTitleStyle}>IC Members</h4>
          {icMembers.length ? (
            <ul style={memberListStyle}>
              {icMembers.map((row) => (
                <li key={row.user_id}>
                  {row.name} - {row.role}
                </li>
              ))}
            </ul>
          ) : (
            <ul style={memberListStyle}>
              <li>None on record</li>
            </ul>
          )}
        </div>
      </div>
      <div style={detailActionsStyle}>
        <button type="button" onClick={exportReport} style={primaryActionStyle}>
          Export Full Report
        </button>
        <button type="button" onClick={onClose} style={clearButtonStyle}>
          Close
        </button>
      </div>
    </section>
  );
}

OrganizationStatusPanel.propTypes = {
  org: PropTypes.object.isRequired,
  trainingRows: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
};

function Detail({ label, value }) {
  return (
    <div style={detailItemStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

Detail.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
};

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatsHomePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [annualFilter, setAnnualFilter] = useState("All");
  const [activeFilter, setActiveFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
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
        if (annualFilter !== "All" && org.annual_return_status !== annualFilter)
          return false;
        if (activeFilter !== "All" && org.status !== activeFilter) return false;
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
  }, [annualFilter, activeFilter, data?.organizations, searchQuery]);
  const trainingRows = useMemo(() => {
    const query = userSearchQuery.trim().toLowerCase();
    return (data?.user_training_rows || []).filter((row) => {
      if (departmentFilter !== "All" && row.department !== departmentFilter)
        return false;
      if (!query) return true;
      return [
        row.name,
        row.employee_id,
        row.company_name,
        row.department,
        row.role,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [data?.user_training_rows, departmentFilter, userSearchQuery]);
  const employeeTrainingRows = useMemo(
    () =>
      trainingRows.filter(
        (row) => Number(row.role_id) === 4 || row.role === "Employee",
      ),
    [trainingRows],
  );
  const departments = useMemo(() => {
    const values = new Set(
      (data?.user_training_rows || [])
        .filter((row) => Number(row.role_id) === 4 || row.role === "Employee")
        .map((row) => row.department || "Unassigned"),
    );
    return ["All", ...Array.from(values).sort()];
  }, [data?.user_training_rows]);
  const portfolioStats = useMemo(() => {
    const clients = organizationRows.length;
    const activeContracts = organizationRows.filter(
      (row) => row.contract === "Active",
    ).length;
    const overdueReturns = organizationRows.filter(
      (row) => row.annual_return_status === "Overdue",
    ).length;
    const openComplaints = organizationRows.reduce(
      (sum, row) => sum + Number(row.open_complaints || 0),
      0,
    );
    const employees = organizationRows.reduce(
      (sum, row) => sum + Number(row.employees || 0),
      0,
    );
    const completedTraining = organizationRows.reduce(
      (sum, row) => sum + Number(row.completed_training || 0),
      0,
    );
    const averageTraining = clients
      ? Math.round(
          organizationRows.reduce(
            (sum, row) => sum + Number(row.training_rate || 0),
            0,
          ) / clients,
        )
      : 0;
    return [
      ["Clients", clients],
      ["Contracts currently active", activeContracts],
      ["Annual Returns overdue", overdueReturns],
      ["Open complaints", openComplaints],
      ["Total employees", employees],
      ["Completed training", completedTraining],
      ["Average training completion", `${averageTraining}%`],
    ];
  }, [organizationRows]);
  const selectedOrganization = useMemo(() => {
    if (!organizationRows.length) return null;
    return (
      organizationRows.find((org) => org.company_id === selectedCompanyId) ||
      null
    );
  }, [organizationRows, selectedCompanyId]);
  const displayName = profile?.full_name || profile?.first_name || "there";
  const companyName = profile?.company_name || "Your company";
  const superAdminSections = useMemo(() => {
    if (user?.role_id !== 1) return [];
    return [
      {
        title: "Hierarchy",
        rows: [
          ["Super Admin", data?.hierarchy?.super_admins ?? 0],
          ["Admin", data?.hierarchy?.company_admins ?? 0],
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

      {[1, 2, 5].includes(user?.role_id) && (
        <section style={sectionStyle}>
          <div style={portfolioHeaderStyle}>
            <h2>PoSH Compliance - Client Portfolio</h2>
            <p>
              Live status across{" "}
              {user?.role_id === 5 ? "your organization" : "managed clients"}:
              compliance health, annual returns, training, and open complaints.
            </p>
          </div>
          <div style={filterGridStyle}>
            <label style={filterLabelStyle}>
              Company Name
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Type to search or select..."
                style={searchInputStyle}
              />
            </label>
            <label style={filterLabelStyle}>
              Annual Return Status
              <select
                value={annualFilter}
                onChange={(event) => setAnnualFilter(event.target.value)}
                style={searchInputStyle}
              >
                {["All", "Filed", "Pending", "Overdue"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label style={filterLabelStyle}>
              Active Status
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value)}
                style={searchInputStyle}
              >
                {["All", "Active", "Inactive"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setAnnualFilter("All");
                setActiveFilter("All");
              }}
              style={clearButtonStyle}
            >
              Clear Filters
            </button>
          </div>
          <div className="portal-auto-grid" style={{ marginBottom: "18px" }}>
            {portfolioStats.map(([label, value]) => (
              <div key={label} className="portal-card">
                <div className="portal-kpi-value">{loading ? "-" : value}</div>
                <div className="portal-kpi-label">{label}</div>
              </div>
            ))}
          </div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {[
                    "Company",
                    "IC Constituted",
                    "Deliverables",
                    "Annual Return",
                    "Training",
                    "Open Complaints",
                    "Contract",
                    "Health",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {organizationRows.map((org) => (
                  <tr key={org.company_id} style={trStyle}>
                    <td style={tdStyle}>{org.company_name}</td>
                    <td style={tdStyle}>
                      <Badge tone={org.ic_users ? "green" : "red"}>
                        {org.ic_users ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td style={tdStyle}>
                      {org.services?.length ? "100%" : "0%"}
                    </td>
                    <td style={tdStyle}>
                      <Badge
                        tone={
                          org.annual_return_status === "Filed"
                            ? "green"
                            : org.annual_return_status === "Overdue"
                              ? "red"
                              : "amber"
                        }
                      >
                        {org.annual_return_status}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{org.training_rate ?? 0}%</td>
                    <td style={tdStyle}>{org.open_complaints ?? 0}</td>
                    <td style={tdStyle}>
                      <Badge
                        tone={org.contract === "Active" ? "green" : "amber"}
                      >
                        {org.contract || org.status || "-"}
                      </Badge>
                    </td>
                    <td style={tdStyle}>
                      <Badge
                        tone={
                          org.health === "Green"
                            ? "green"
                            : org.health === "Red"
                              ? "red"
                              : "amber"
                        }
                      >
                        {org.health || "Amber"}
                      </Badge>
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => setSelectedCompanyId(org.company_id)}
                        style={viewButtonStyle}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && organizationRows.length === 0 && (
                  <tr style={trStyle}>
                    <td
                      colSpan={9}
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
          {selectedOrganization && (
            <OrganizationStatusPanel
              org={selectedOrganization}
              trainingRows={trainingRows.filter(
                (row) => row.company_id === selectedOrganization.company_id,
              )}
              onClose={() => setSelectedCompanyId(null)}
            />
          )}
        </section>
      )}

      {[1, 2, 5].includes(user?.role_id) && (
        <section style={sectionStyle}>
          <div className="portal-section-title">Employee Training Status</div>
          <div className="portal-auto-grid" style={{ marginBottom: "12px" }}>
            {["Completed", "Started", "Pending"].map((status) => (
              <div key={status} className="portal-card">
                <div className="portal-kpi-value">
                  {loading
                    ? "-"
                    : employeeTrainingRows.filter(
                        (row) => row.completion_status === status,
                      ).length}
                </div>
                <div className="portal-kpi-label">{status}</div>
              </div>
            ))}
          </div>
          <div style={filterGridStyle}>
            <label style={filterLabelStyle}>
              Filter by Department
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                style={searchInputStyle}
              >
                {departments.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </select>
            </label>
            <label style={filterLabelStyle}>
              Search by Name or Employee ID
              <input
                type="search"
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
                placeholder="e.g. Ananya or AAA-1042"
                style={searchInputStyle}
              />
            </label>
          </div>
          <div style={tableWrapStyle}>
            <table style={{ ...tableStyle, minWidth: "900px" }}>
              <thead>
                <tr>
                  {[
                    "Name",
                    "ID",
                    "Company",
                    "Department",
                    "Role",
                    "Training Name",
                    "Completion Status",
                    "Last Access",
                    "Certificate Status",
                  ].map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeTrainingRows.map((row) => (
                  <tr key={row.user_id} style={trStyle}>
                    <td style={tdStyle}>{row.name}</td>
                    <td style={tdStyle}>{row.employee_id}</td>
                    <td style={tdStyle}>{row.company_name}</td>
                    <td style={tdStyle}>{row.department}</td>
                    <td style={tdStyle}>{row.role}</td>
                    <td style={tdStyle}>{row.training_name}</td>
                    <td style={tdStyle}>
                      <Badge
                        tone={
                          row.completion_status === "Completed"
                            ? "green"
                            : row.completion_status === "Started"
                              ? "amber"
                              : "red"
                        }
                      >
                        {row.completion_status}
                      </Badge>
                    </td>
                    <td style={tdStyle}>{formatDateTime(row.last_access)}</td>
                    <td style={tdStyle}>
                      <Badge
                        tone={
                          row.certificate_status === "Valid" ? "green" : "red"
                        }
                      >
                        {row.certificate_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!loading && employeeTrainingRows.length === 0 && (
                  <tr style={trStyle}>
                    <td
                      colSpan={9}
                      style={{
                        ...tdStyle,
                        color: "var(--portal-muted)",
                        textAlign: "center",
                      }}
                    >
                      No employees with video training match this filter.
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

const portfolioHeaderStyle = {
  background: "linear-gradient(135deg, var(--portal-purple), #7c4dcc)",
  color: "white",
  borderRadius: "8px",
  padding: "22px",
  marginBottom: "16px",
};

const filterGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "12px",
  marginBottom: "14px",
};

const filterLabelStyle = {
  display: "grid",
  gap: "6px",
  color: "var(--portal-text)",
  fontSize: "12px",
  fontWeight: 800,
};

const searchInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--portal-border)",
  borderRadius: "7px",
  padding: "10px 12px",
  fontSize: "14px",
};

const clearButtonStyle = {
  width: "fit-content",
  alignSelf: "end",
  border: "1px solid var(--portal-border)",
  background: "white",
  color: "var(--portal-purple)",
  borderRadius: "7px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const viewButtonStyle = {
  border: "1px solid var(--portal-border)",
  background: "white",
  color: "var(--portal-purple)",
  borderRadius: "7px",
  padding: "7px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const detailPanelStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "18px",
  marginTop: "14px",
};

const detailTitleStyle = {
  margin: "0 0 14px",
  color: "var(--portal-purple)",
  fontSize: "16px",
};

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px 34px",
};

const detailItemStyle = {
  display: "grid",
  gap: "5px",
  color: "var(--portal-muted)",
  fontSize: "12px",
};

const detailColumnsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "22px",
  marginTop: "18px",
};

const detailSectionTitleStyle = {
  margin: "0 0 10px",
  color: "var(--portal-purple)",
  fontSize: "13px",
  textTransform: "uppercase",
};

const deliverableListStyle = {
  display: "grid",
  gap: "6px",
  color: "#047857",
  fontSize: "13px",
};

const memberListStyle = {
  margin: 0,
  paddingLeft: "18px",
  color: "var(--portal-text)",
  lineHeight: 1.8,
};

const detailActionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "20px",
};

const primaryActionStyle = {
  background: "var(--portal-purple)",
  color: "white",
  border: "none",
  borderRadius: "7px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "58px",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "11px",
  fontWeight: 800,
};

const badgeToneStyle = {
  green: {
    background: "#dcfce7",
    color: "#047857",
  },
  amber: {
    background: "#fef3c7",
    color: "#a16207",
  },
  red: {
    background: "#ffe4e6",
    color: "#be123c",
  },
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
