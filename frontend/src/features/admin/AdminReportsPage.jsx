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
    description: "Employee training, department compliance, and certificate reports.",
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
    description: "Issued certificates with employee, course, and issue details.",
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

function buildServiceSections(analytics) {
  const serviceEntries = poshServiceEntries(analytics?.services);
  if (!serviceEntries.some(([code]) => normalizeServiceCode(code) === "POSH")) {
    serviceEntries.push(["POSH", { companies: 0, employees: 0, certificates: 0 }]);
  }
  return serviceEntries.sort(sortServiceEntries).map(([code, service]) => ({
    code: normalizeServiceCode(code),
    label: serviceLabel(code),
    service,
  }));
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

export function AdminReportsPage() {
  const { user } = useAuthStore();
  const [selectedService, setSelectedService] = useState("posh");
  const [analytics, setAnalytics] = useState(null);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadServices = async () => {
      setError("");
      try {
        const endpoint = user?.role_id === 1 ? "/analytics/overview" : "/analytics/current";
        const res = await apiClient.get(endpoint);
        if (active) setAnalytics(res.data);
      } catch (err) {
        if (active) setError(apiErrorMessage(err, "Unable to load report services."));
      }
    };
    loadServices();
    return () => {
      active = false;
    };
  }, [user?.role_id]);

  const serviceSections = useMemo(() => buildServiceSections(analytics), [analytics]);
  const reportSummary = useMemo(() => buildReportSummary(analytics), [analytics]);

  const downloadReport = async (report) => {
    if (!report.endpoint) return;
    setDownloading(report.title);
    setError("");
    try {
      const res = await apiClient.get(report.endpoint, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.fileName;
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
          ? "Download platform and service reports."
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
                        {section.service?.companies ?? 0} Companies
                      </span>
                    </div>
                    <div className="portal-auto-grid">
                      {sectionReports.map((report) => {
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
                                available ? "portal-badge-green" : "portal-badge-purple"
                              }`}
                            >
                              {report.status}
                            </span>
                            <h2 style={{ fontSize: "14.5px", marginTop: "16px" }}>
                              {report.title}
                            </h2>
                            <p style={{ marginBottom: "14px" }}>{report.description}</p>
                            {available && (
                              <span style={downloadLabelStyle}>
                                <DownloadIcon fontSize="small" />
                                {downloading === report.title ? "Downloading..." : "Download"}
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
                          available ? "portal-badge-green" : "portal-badge-purple"
                        }`}
                      >
                        {report.status}
                      </span>
                      <h2 style={{ fontSize: "14.5px", marginTop: "16px" }}>
                        {report.title}
                      </h2>
                      <p style={{ marginBottom: "14px" }}>{report.description}</p>
                      {available && (
                        <span style={downloadLabelStyle}>
                          <DownloadIcon fontSize="small" />
                          {downloading === report.title ? "Downloading..." : "Download"}
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
