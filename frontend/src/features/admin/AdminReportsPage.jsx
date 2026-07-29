import DownloadIcon from "@mui/icons-material/Download";
import { useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";

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

export function AdminReportsPage() {
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

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
      title="Admin Reports"
      subtitle="Super Admin downloads all employee records; Admin downloads employee records for the same company."
    >

      {error && <div style={errorStyle}>{error}</div>}

      <div className="portal-section-title">Available Downloads</div>
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
              style={{ cursor: available ? "pointer" : "not-allowed", opacity: available ? 1 : 0.76 }}
            >
              <span
                className={`portal-badge ${available ? "portal-badge-green" : "portal-badge-purple"}`}
              >
                {report.status}
              </span>
              <h2 style={{ fontSize: "14.5px", marginTop: "16px" }}>
                {report.title}
              </h2>
              <p style={{ marginBottom: "14px" }}>{report.description}</p>
              {available && (
                <span
                  style={{
                    color: "#17324d",
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <DownloadIcon fontSize="small" />
                  {downloading === report.title ? "Downloading..." : "Download"}
                </span>
              )}
            </button>
          );
        })}
      </div>

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
