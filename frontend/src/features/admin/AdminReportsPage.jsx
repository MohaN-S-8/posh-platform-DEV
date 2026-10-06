import DownloadIcon from "@mui/icons-material/Download";
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const serviceOptions = [
  {
    key: "posh",
    title: "PoSH",
    description:
      "Employee training, department compliance, and certificate reports.",
    status: "Available",
  },
];

const reports = [
  {
    title: "Employee Training Report",
    endpoint: "/hr/reports/employees",
    fileName: "employee_training_report.xlsx",
    description: "Employee-wise training status and completion percentage.",
    status: "Excel",
  },
  {
    title: "Employee Training Report CSV",
    endpoint: "/hr/reports/employees.csv",
    fileName: "employee_training_report.csv",
    description: "Employee-wise training data in CSV format.",
    status: "CSV",
  },
  {
    title: "Employee Training Report PDF",
    endpoint: "/hr/reports/employees.pdf",
    fileName: "employee_training_report.pdf",
    description: "Printable employee-wise training report.",
    status: "PDF",
  },
  {
    title: "Department Compliance Report",
    endpoint: "/hr/reports/departments",
    fileName: "department_compliance_report.xlsx",
    description: "Department-wise completed, pending, and compliance rate.",
    status: "Excel",
  },
  {
    title: "Department Compliance Report CSV",
    endpoint: "/hr/reports/departments.csv",
    fileName: "department_compliance_report.csv",
    description: "Department compliance data in CSV format.",
    status: "CSV",
  },
  {
    title: "Department Compliance Report PDF",
    endpoint: "/hr/reports/departments.pdf",
    fileName: "department_compliance_report.pdf",
    description: "Printable department compliance report.",
    status: "PDF",
  },
  {
    title: "Certificate Report",
    endpoint: "/hr/reports/certificates",
    fileName: "certificate_report.xlsx",
    description:
      "Issued certificates with employee, course, and issue details.",
    status: "Excel",
  },
  {
    title: "Certificate Report CSV",
    endpoint: "/hr/reports/certificates.csv",
    fileName: "certificate_report.csv",
    description: "Issued certificate data in CSV format.",
    status: "CSV",
  },
  {
    title: "Certificate Report PDF",
    endpoint: "/hr/reports/certificates.pdf",
    fileName: "certificate_report.pdf",
    description: "Printable certificate report.",
    status: "PDF",
  },
];

const SERVICE_LABELS = {
  POSH: "PoSH",
};

function normalizeServiceCode(code) {
  return (
    String(code || "POSH")
      .trim()
      .toUpperCase() || "POSH"
  );
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

function buildServiceSections(analytics, organizationRows) {
  const serviceEntries = poshServiceEntries(analytics?.services);
  if (!serviceEntries.some(([code]) => normalizeServiceCode(code) === "POSH")) {
    serviceEntries.push([
      "POSH",
      { companies: 0, employees: 0, certificates: 0 },
    ]);
  }
  return serviceEntries.sort(sortServiceEntries).map(([code, service]) => {
    const normalizedCode = normalizeServiceCode(code);
    const organizations = organizationRows.filter((org) =>
      (org.services || []).some(
        (orgService) => normalizeServiceCode(orgService) === normalizedCode,
      ),
    );
    return {
      code: normalizedCode,
      label: serviceLabel(code),
      service,
      organizations,
    };
  });
}

function buildReportSummary(analytics) {
  if (!analytics || analytics.scope !== "company") return [];
  return [
    { label: "Total Users", value: analytics.total_users ?? 0 },
    { label: "Employees", value: analytics.total_employees ?? 0 },
    { label: "Completed", value: analytics.completed_training ?? 0 },
    { label: "Compliance", value: `${analytics.compliance_rate ?? 0}%` },
    { label: "Certificates", value: analytics.certificates_issued ?? 0 },
    { label: "Open Concerns", value: analytics.concerns?.open ?? 0 },
  ];
}

function downloadNameFromResponse(res, fallback) {
  const disposition = res.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || fallback;
}

function organizationSearchText(org) {
  return [
    org.company_name,
    org.company_code,
    org.client_id,
    org.status,
    org.approval_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function AdminReportsPage() {
  const { user } = useAuthStore();
  const [selectedService, setSelectedService] = useState("posh");
  const [analytics, setAnalytics] = useState(null);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const [organizationId, setOrganizationId] = useState("all");
  const [organizationSearch, setOrganizationSearch] = useState("");

  useEffect(() => {
    let active = true;
    const loadServices = async () => {
      setError("");
      try {
        const endpoint =
          user?.role_id === 1 ? "/analytics/overview" : "/analytics/current";
        const res = await apiClient.get(endpoint);
        if (active) setAnalytics(res.data);
      } catch (err) {
        if (active)
          setError(apiErrorMessage(err, "Unable to load report services."));
      }
    };
    loadServices();
    return () => {
      active = false;
    };
  }, [user?.role_id]);

  const organizationOptions = useMemo(
    () => analytics?.organizations || [],
    [analytics],
  );
  const filteredOrganizations = useMemo(() => {
    const query = organizationSearch.trim().toLowerCase();
    return organizationOptions.filter((org) => {
      const matchesOrganization =
        organizationId === "all" || String(org.company_id) === organizationId;
      const matchesSearch =
        !query || organizationSearchText(org).includes(query);
      return matchesOrganization && matchesSearch;
    });
  }, [organizationId, organizationOptions, organizationSearch]);
  const serviceSections = useMemo(
    () => buildServiceSections(analytics, filteredOrganizations),
    [analytics, filteredOrganizations],
  );
  const reportSummary = useMemo(
    () => buildReportSummary(analytics),
    [analytics],
  );

  const downloadReport = async (report) => {
    if (!report.endpoint) return;
    setDownloading(report.title);
    setError("");
    try {
      const res = await apiClient.get(report.endpoint, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadNameFromResponse(res, report.fileName);
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to download report."));
    } finally {
      setDownloading("");
    }
  };

  return (
    <PortalShell
      title="Reports"
      subtitle={
        user?.role_id === 1
          ? "Download reports for your assigned companies and services."
          : "Choose a service to download its reports."
      }
    >
      {error && <div style={errorStyle}>{error}</div>}

      {user?.role_id !== 1 && reportSummary.length > 0 && (
        <>
          <div className="portal-section-title">Users & Compliance</div>
          <section style={summaryGridStyle}>
            {reportSummary.map((metric) => (
              <div key={metric.label} style={summaryCardStyle}>
                <div style={summaryLabelStyle}>{metric.label}</div>
                <div style={summaryValueStyle}>{metric.value}</div>
              </div>
            ))}
          </section>
        </>
      )}

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

      {(user?.role_id === 1 || selectedService === "posh") && (
        <>
          {user?.role_id === 1 ? (
            <section style={sectionStackStyle}>
              <div className="portal-section-title">Service Reports</div>
              <section style={filterPanelStyle}>
                <label style={filterFieldStyle}>
                  <span style={filterLabelStyle}>Organization</span>
                  <select
                    value={organizationId}
                    onChange={(event) => setOrganizationId(event.target.value)}
                    style={filterControlStyle}
                  >
                    <option value="all">All Organizations</option>
                    {organizationOptions.map((org) => (
                      <option
                        key={org.company_id}
                        value={String(org.company_id)}
                      >
                        {org.company_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={filterFieldStyle}>
                  <span style={filterLabelStyle}>
                    Search Organization / Code
                  </span>
                  <input
                    type="search"
                    value={organizationSearch}
                    onChange={(event) =>
                      setOrganizationSearch(event.target.value)
                    }
                    placeholder="Type company, code, client ID, status..."
                    style={filterControlStyle}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOrganizationId("all");
                    setOrganizationSearch("");
                  }}
                  style={clearButtonStyle}
                >
                  Clear Filters
                </button>
              </section>
              {serviceSections.map((section) => {
                const sectionReports = reports;
                return (
                  <article key={section.code} style={servicePanelStyle}>
                    <div style={serviceHeaderStyle}>
                      <div>
                        <div style={serviceEyebrowStyle}>Service</div>
                        <h2 style={serviceHeadingStyle}>{section.label}</h2>
                      </div>
                      <span className="portal-badge portal-badge-green">
                        {section.organizations.length} Companies
                      </span>
                    </div>
                    <div style={organizationTableStyle}>
                      <div
                        style={{
                          ...organizationRowStyle,
                          ...organizationHeaderRowStyle,
                        }}
                      >
                        <span>Company</span>
                        <span>Status</span>
                        <span>Approval</span>
                        <span>Employees</span>
                        <span>Certificates</span>
                      </div>
                      {section.organizations.slice(0, 6).map((org) => (
                        <div key={org.company_id} style={organizationRowStyle}>
                          <strong>{org.company_name}</strong>
                          <span>{org.status}</span>
                          <span>{org.approval_status}</span>
                          <span>{org.employees ?? 0}</span>
                          <span>{org.certificates ?? 0}</span>
                        </div>
                      ))}
                      {!section.organizations.length && (
                        <div style={emptyRowStyle}>
                          No organizations match these filters.
                        </div>
                      )}
                    </div>
                    <div className="portal-auto-grid">
                      {sectionReports.map((report) => {
                        const available = Boolean(report.endpoint);
                        return (
                          <button
                            key={report.title}
                            type="button"
                            disabled={
                              !available || downloading === report.title
                            }
                            onClick={() => downloadReport(report)}
                            className="portal-card portal-tile"
                            style={{
                              cursor: available ? "pointer" : "not-allowed",
                              opacity: available ? 1 : 0.76,
                            }}
                          >
                            <span
                              className={`portal-badge ${
                                available
                                  ? "portal-badge-green"
                                  : "portal-badge-purple"
                              }`}
                            >
                              {report.status}
                            </span>
                            <h2
                              style={{ fontSize: "14.5px", marginTop: "16px" }}
                            >
                              {report.title}
                            </h2>
                            <p style={{ marginBottom: "14px" }}>
                              {report.description}
                            </p>
                            {available && (
                              <span style={downloadLabelStyle}>
                                <DownloadIcon fontSize="small" />
                                {downloading === report.title
                                  ? "Downloading..."
                                  : "Download"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <>
              <div className="portal-section-title">PoSH Report Downloads</div>
              <div className="portal-auto-grid">
                {reports.map((report) => {
                  const available = Boolean(report.endpoint);
                  return (
                    <button
                      key={report.title}
                      type="button"
                      disabled={!available || downloading === report.title}
                      onClick={() => downloadReport(report)}
                      className="portal-card portal-tile"
                      style={{
                        cursor: available ? "pointer" : "not-allowed",
                        opacity: available ? 1 : 0.76,
                      }}
                    >
                      <span
                        className={`portal-badge ${
                          available
                            ? "portal-badge-green"
                            : "portal-badge-purple"
                        }`}
                      >
                        {report.status}
                      </span>
                      <h2 style={{ fontSize: "14.5px", marginTop: "16px" }}>
                        {report.title}
                      </h2>
                      <p style={{ marginBottom: "14px" }}>
                        {report.description}
                      </p>
                      {available && (
                        <span style={downloadLabelStyle}>
                          <DownloadIcon fontSize="small" />
                          {downloading === report.title
                            ? "Downloading..."
                            : "Download"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <LoadingOverlay
        show={Boolean(downloading)}
        title="Preparing report"
        message={downloading ? `Downloading ${downloading}.` : ""}
      />
    </PortalShell>
  );
}

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};

const serviceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const serviceCardStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  textAlign: "left",
  minHeight: "150px",
};

const selectedServiceCardStyle = {
  borderColor: "#17324d",
  boxShadow: "0 0 0 2px rgba(23,50,77,0.12)",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const summaryCardStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
};

const summaryLabelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
};

const summaryValueStyle = {
  color: "#17324d",
  fontSize: "28px",
  fontWeight: 800,
  marginTop: "8px",
};

const sectionStackStyle = {
  display: "grid",
  gap: "18px",
};

const filterPanelStyle = {
  alignItems: "end",
  background: "white",
  border: "1px solid #e7edf3",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 1.4fr) auto",
  padding: "18px",
};

const filterFieldStyle = {
  display: "grid",
  gap: "7px",
};

const filterLabelStyle = {
  color: "#17324d",
  fontSize: "12px",
  fontWeight: 800,
};

const filterControlStyle = {
  background: "white",
  border: "1px solid #d9e2ec",
  borderRadius: "8px",
  color: "#17324d",
  fontSize: "13px",
  minHeight: "40px",
  padding: "9px 10px",
  width: "100%",
};

const clearButtonStyle = {
  background: "white",
  border: "1px solid #d9e2ec",
  borderRadius: "8px",
  color: "#17324d",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: 800,
  minHeight: "40px",
  padding: "9px 14px",
};

const servicePanelStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
};

const serviceHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  marginBottom: "16px",
};

const organizationTableStyle = {
  border: "1px solid #e7edf3",
  borderRadius: "8px",
  display: "grid",
  marginBottom: "18px",
  overflow: "hidden",
};

const organizationRowStyle = {
  alignItems: "center",
  borderBottom: "1px solid #eef2f6",
  color: "#52677a",
  display: "grid",
  fontSize: "13px",
  gap: "12px",
  gridTemplateColumns: "minmax(160px, 1.5fr) repeat(4, minmax(90px, 1fr))",
  padding: "12px 14px",
};

const organizationHeaderRowStyle = {
  background: "#f8fafc",
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

const downloadLabelStyle = {
  color: "#17324d",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
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
