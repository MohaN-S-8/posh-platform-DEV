import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import BusinessIcon from "@mui/icons-material/Business";
import GroupsIcon from "@mui/icons-material/Groups";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const serviceOptions = [
  {
    key: "posh",
    title: "PoSH",
    description: "Training, compliance, assessment, and certificate analytics.",
    status: "Available",
  },
];

const SERVICE_LABELS = {
  POSH: "PoSH",
};

function normalizeServiceCode(code) {
  return String(code || "POSH").trim().toUpperCase() || "POSH";
}

function serviceLabel(code) {
  const normalized = normalizeServiceCode(code);
  return SERVICE_LABELS[normalized] || normalized;
}

function sortServiceEntries([codeA], [codeB]) {
  const normalizedA = normalizeServiceCode(codeA);
  const normalizedB = normalizeServiceCode(codeB);
  if (normalizedA === "POSH") return -1;
  if (normalizedB === "POSH") return 1;
  return serviceLabel(normalizedA).localeCompare(serviceLabel(normalizedB));
}

function poshServiceEntries(services) {
  return Object.entries(services || {}).filter(
    ([code]) => normalizeServiceCode(code) === "POSH",
  );
}

function summarizeTraining(serviceTraining) {
  return Object.values(serviceTraining || {}).reduce(
    (totals, levels) => {
      Object.values(levels || {}).forEach((audiences) => {
        Object.values(audiences || {}).forEach((counts) => {
          totals.total += counts.total || 0;
          totals.published += counts.published || 0;
          totals.draft += counts.draft || 0;
          totals.archived += counts.archived || 0;
        });
      });
      return totals;
    },
    { total: 0, published: 0, draft: 0, archived: 0 },
  );
}

function buildServiceSections(analytics) {
  if (!analytics || analytics.scope !== "platform") return [];
  const serviceEntries = poshServiceEntries(analytics.services);
  if (!serviceEntries.some(([code]) => normalizeServiceCode(code) === "POSH")) {
    serviceEntries.push([
      "POSH",
      {
        companies: 0,
        active_companies: 0,
        approved_companies: 0,
        pending_companies: 0,
        employees: 0,
        certificates: 0,
      },
    ]);
  }

  return serviceEntries.sort(sortServiceEntries).map(([code, service]) => {
    const normalizedCode = normalizeServiceCode(code);
    const organizations = (analytics.organizations || []).filter((org) =>
      (org.services || []).some((orgService) => normalizeServiceCode(orgService) === normalizedCode),
    );

    return {
      code: normalizedCode,
      label: serviceLabel(normalizedCode),
      service,
      organizations,
      training: summarizeTraining(analytics.service_training?.[normalizedCode]),
    };
  });
}

function buildCompanyDetailMetrics(analytics) {
  if (!analytics || analytics.scope !== "company") return [];
  return [
    { label: "Total Users", value: analytics.total_users ?? 0 },
    { label: "Client / Management", value: analytics.client_management_users ?? 0 },
    { label: "IC Users", value: analytics.ic_users ?? 0 },
    { label: "Employees", value: analytics.total_employees ?? 0 },
    { label: "Assignments", value: analytics.assignments ?? 0 },
    { label: "Open Concerns", value: analytics.concerns?.open ?? 0 },
  ];
}

export function AdminAnalyticsPage() {
  const { user } = useAuthStore();
  const [selectedService, setSelectedService] = useState("posh");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/analytics/current");
        setAnalytics(res.data);
      } catch (err) {
        setError(apiErrorMessage(err, "Unable to load analytics."));
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, []);

  const metrics = useMemo(() => {
    if (!analytics) return [];
    if (analytics.scope === "platform") {
      return [
        {
          label: "Active Companies",
          value: analytics.total_companies ?? 0,
          icon: <BusinessIcon />,
        },
        {
          label: "Active Users",
          value: analytics.total_users ?? 0,
          icon: <GroupsIcon />,
        },
        {
          label: "Course Completions",
          value: analytics.total_course_completions ?? 0,
          icon: <AssessmentIcon />,
        },
        {
          label: "Certificates Issued",
          value: analytics.total_certificates_issued ?? 0,
          icon: <BadgeIcon />,
        },
        {
          label: "Average Pass Score",
          value: `${analytics.average_pass_score ?? 0}%`,
          icon: <TrendingUpIcon />,
        },
      ];
    }
    return [
      {
        label: "Employees",
        value: analytics.total_employees ?? 0,
        icon: <GroupsIcon />,
      },
      {
        label: "Completed Training",
        value: analytics.completed_training ?? 0,
        icon: <AssessmentIcon />,
      },
      {
        label: "In Progress",
        value: analytics.in_progress_training ?? 0,
        icon: <TrendingUpIcon />,
      },
      {
        label: "Not Started",
        value: analytics.not_started_training ?? 0,
        icon: <BusinessIcon />,
      },
      {
        label: "Certificates Issued",
        value: analytics.certificates_issued ?? 0,
        icon: <BadgeIcon />,
      },
      {
        label: "Average Pass Score",
        value: `${analytics.average_pass_score ?? 0}%`,
        icon: <TrendingUpIcon />,
      },
    ];
  }, [analytics]);

  const complianceRate = analytics?.compliance_rate ?? 0;
  const serviceSections = useMemo(() => buildServiceSections(analytics), [analytics]);
  const companyDetailMetrics = useMemo(
    () => buildCompanyDetailMetrics(analytics),
    [analytics],
  );

  return (
    <PortalShell
      title="Analytics"
      subtitle={
        user?.role_id === 1
          ? "Platform-level analytics across organizations, services, training, and certificates."
          : "Choose a service to view company analytics."
      }
    >

      {error && <div style={errorStyle}>{error}</div>}

      {user?.role_id !== 1 && (
        <>
          <div className="portal-section-title">Services</div>
          <section style={serviceGridStyle}>
            {serviceOptions.map((service) => {
              const isAvailable = service.key === "posh";
              const isSelected = selectedService === service.key;
              return (
                <button
                  key={service.key}
                  type="button"
                  onClick={() => isAvailable && setSelectedService(service.key)}
                  disabled={!isAvailable}
                  style={{
                    ...serviceCardStyle,
                    ...(isSelected ? selectedServiceCardStyle : {}),
                    cursor: isAvailable ? "pointer" : "not-allowed",
                    opacity: isAvailable ? 1 : 0.72,
                  }}
                >
                  <span
                    className={`portal-badge ${
                      isAvailable ? "portal-badge-green" : "portal-badge-purple"
                    }`}
                  >
                    {service.status}
                  </span>
                  <h2 style={serviceTitleStyle}>{service.title}</h2>
                  <p style={serviceDescriptionStyle}>{service.description}</p>
                </button>
              );
            })}
          </section>
        </>
      )}

      {(user?.role_id === 1 || selectedService === "posh") && analytics?.scope === "company" && (
        <section style={panelStyle}>
          <div style={complianceHeaderStyle}>
            <div>
              <div style={labelStyle}>Compliance Rate</div>
              <div style={heroValueStyle}>{complianceRate}%</div>
            </div>
            <div style={meterOuterStyle}>
              <div
                style={{
                  ...meterInnerStyle,
                  width: `${Math.min(100, Math.max(0, complianceRate))}%`,
                }}
              />
            </div>
          </div>
        </section>
      )}

      {(user?.role_id === 1 || selectedService === "posh") && (
        <>
          <div className="portal-section-title">
            {user?.role_id === 1 ? "Platform Overview" : "PoSH Analytics"}
          </div>
          <section style={gridStyle}>
            {metrics.map((metric) => (
              <div key={metric.label} style={cardStyle}>
                <div style={iconStyle}>{metric.icon}</div>
                <div style={labelStyle}>{metric.label}</div>
                <div style={valueStyle}>{metric.value}</div>
              </div>
            ))}
          </section>
        </>
      )}

      {user?.role_id === 1 && (
        <section style={sectionStackStyle}>
          <div className="portal-section-title">Service Analytics</div>
          {serviceSections.map((section) => (
            <article key={section.code} style={servicePanelStyle}>
              <div style={serviceHeaderStyle}>
                <div>
                  <div style={serviceEyebrowStyle}>Service</div>
                  <h2 style={serviceHeadingStyle}>{section.label}</h2>
                </div>
                <span className="portal-badge portal-badge-green">Active view</span>
              </div>

              <section style={gridStyle}>
                <div style={cardStyle}>
                  <div style={iconStyle}><BusinessIcon /></div>
                  <div style={labelStyle}>Active Companies</div>
                  <div style={valueStyle}>{section.service.active_companies ?? 0}</div>
                </div>
                <div style={cardStyle}>
                  <div style={iconStyle}><BusinessIcon /></div>
                  <div style={labelStyle}>Approved Companies</div>
                  <div style={valueStyle}>{section.service.approved_companies ?? 0}</div>
                </div>
                <div style={cardStyle}>
                  <div style={iconStyle}><GroupsIcon /></div>
                  <div style={labelStyle}>Employees</div>
                  <div style={valueStyle}>{section.service.employees ?? 0}</div>
                </div>
                <div style={cardStyle}>
                  <div style={iconStyle}><BadgeIcon /></div>
                  <div style={labelStyle}>Certificates</div>
                  <div style={valueStyle}>{section.service.certificates ?? 0}</div>
                </div>
                <div style={cardStyle}>
                  <div style={iconStyle}><AssessmentIcon /></div>
                  <div style={labelStyle}>Published Videos</div>
                  <div style={valueStyle}>{section.training.published}</div>
                </div>
                <div style={cardStyle}>
                  <div style={iconStyle}><TrendingUpIcon /></div>
                  <div style={labelStyle}>Pending Approval</div>
                  <div style={valueStyle}>
                    {(section.service.pending_companies ?? 0) + section.training.draft}
                  </div>
                </div>
              </section>

              <div style={tablePanelStyle}>
                <div style={tableTitleStyle}>Organizations</div>
                <div style={tableStyle}>
                  <div style={{ ...tableRowStyle, ...tableHeaderRowStyle }}>
                    <span>Company</span>
                    <span>Status</span>
                    <span>Approval</span>
                    <span>Employees</span>
                    <span>Certificates</span>
                  </div>
                  {section.organizations.slice(0, 8).map((org) => (
                    <div key={org.company_id} style={tableRowStyle}>
                      <strong>{org.company_name}</strong>
                      <span>{org.status}</span>
                      <span>{org.approval_status}</span>
                      <span>{org.employees ?? 0}</span>
                      <span>{org.certificates ?? 0}</span>
                    </div>
                  ))}
                  {!section.organizations.length && (
                    <div style={emptyRowStyle}>No organizations assigned yet.</div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {user?.role_id !== 1 && analytics?.scope === "company" && selectedService === "posh" && (
        <section style={sectionStackStyle}>
          <div style={sectionHeaderStyle}>
            <div className="portal-section-title" style={{ margin: 0 }}>
              Users & Compliance
            </div>
            <Link to="/admin/reports" style={reportLinkStyle}>
              View Reports
            </Link>
          </div>

          <section style={gridStyle}>
            {companyDetailMetrics.map((metric) => (
              <div key={metric.label} style={cardStyle}>
                <div style={labelStyle}>{metric.label}</div>
                <div style={valueStyle}>{metric.value}</div>
              </div>
            ))}
          </section>

          <div style={tablePanelStyle}>
            <div style={tableTitleStyle}>Department Compliance</div>
            <div style={tableStyle}>
              <div style={{ ...departmentRowStyle, ...tableHeaderRowStyle }}>
                <span>Department</span>
                <span>Total</span>
                <span>Completed</span>
                <span>Pending</span>
                <span>Compliance</span>
              </div>
              {(analytics.department_breakdown || []).map((department) => (
                <div key={department.department} style={departmentRowStyle}>
                  <strong>{department.department}</strong>
                  <span>{department.total ?? 0}</span>
                  <span>{department.completed ?? 0}</span>
                  <span>{department.pending ?? 0}</span>
                  <span>{department.compliance_rate ?? 0}%</span>
                </div>
              ))}
              {!analytics.department_breakdown?.length && (
                <div style={emptyRowStyle}>No employee departments available yet.</div>
              )}
            </div>
          </div>

          <section style={gridStyle}>
            <div style={cardStyle}>
              <div style={labelStyle}>Concerns Open</div>
              <div style={valueStyle}>{analytics.concerns?.open ?? 0}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Concerns Reviewed</div>
              <div style={valueStyle}>{analytics.concerns?.reviewed ?? 0}</div>
            </div>
            <div style={cardStyle}>
              <div style={labelStyle}>Concerns Closed</div>
              <div style={valueStyle}>{analytics.concerns?.closed ?? 0}</div>
            </div>
          </section>
        </section>
      )}

      {!loading && !error && metrics.length === 0 && (
        <div style={panelStyle}>No analytics available yet.</div>
      )}

      <LoadingOverlay
        show={loading}
        title="Loading analytics"
        message="Fetching current training metrics."
      />
    </PortalShell>
  );
}

// const backButtonStyle = {
//   background: "none",
//   border: "none",
//   color: "#17324d",
//   cursor: "pointer",
//   marginBottom: "16px",
//   padding: 0,
//   fontWeight: 700,
// };

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "16px",
};

const serviceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const panelStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  marginBottom: "18px",
};

const cardStyle = {
  ...panelStyle,
  marginBottom: 0,
};

const serviceCardStyle = {
  ...cardStyle,
  textAlign: "left",
  minHeight: "150px",
};

const selectedServiceCardStyle = {
  borderColor: "#17324d",
  boxShadow: "0 0 0 2px rgba(23,50,77,0.12)",
};

const complianceHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "center",
};

const reportLinkStyle = {
  background: "#17324d",
  borderRadius: "8px",
  color: "white",
  fontSize: "13px",
  fontWeight: 800,
  padding: "10px 14px",
  textDecoration: "none",
};

const sectionStackStyle = {
  display: "grid",
  gap: "18px",
  marginTop: "22px",
};

const servicePanelStyle = {
  ...panelStyle,
  display: "grid",
  gap: "18px",
};

const serviceHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
};

const serviceEyebrowStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
};

const serviceHeadingStyle = {
  color: "#17324d",
  fontSize: "22px",
  margin: "4px 0 0",
};

const tablePanelStyle = {
  border: "1px solid #e7edf3",
  borderRadius: "8px",
  overflow: "hidden",
};

const tableTitleStyle = {
  background: "#f8fafc",
  borderBottom: "1px solid #e7edf3",
  color: "#17324d",
  fontSize: "13px",
  fontWeight: 800,
  padding: "12px 14px",
};

const tableStyle = {
  display: "grid",
};

const tableRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(160px, 1.5fr) repeat(4, minmax(90px, 1fr))",
  gap: "12px",
  alignItems: "center",
  borderBottom: "1px solid #eef2f6",
  color: "#52677a",
  fontSize: "13px",
  padding: "12px 14px",
};

const departmentRowStyle = {
  ...tableRowStyle,
  gridTemplateColumns: "minmax(150px, 1.5fr) repeat(4, minmax(82px, 1fr))",
};

const tableHeaderRowStyle = {
  color: "#17324d",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
};

const emptyRowStyle = {
  color: "#64748b",
  fontSize: "13px",
  padding: "14px",
};

const serviceTitleStyle = {
  color: "#17324d",
  fontSize: "18px",
  margin: "16px 0 8px",
};

const serviceDescriptionStyle = {
  color: "#52677a",
  fontSize: "13px",
  lineHeight: 1.5,
  margin: 0,
};

const iconStyle = {
  color: "#17324d",
  display: "flex",
  marginBottom: "14px",
};

const labelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
};

const valueStyle = {
  color: "#17324d",
  fontSize: "30px",
  fontWeight: 800,
  marginTop: "8px",
};

const heroValueStyle = {
  ...valueStyle,
  fontSize: "38px",
};

const meterOuterStyle = {
  alignSelf: "center",
  flex: "1 1 260px",
  maxWidth: "520px",
  height: "12px",
  background: "#edf2f7",
  borderRadius: "999px",
  overflow: "hidden",
};

const meterInnerStyle = {
  height: "100%",
  background: "#1f7a4d",
};

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};
