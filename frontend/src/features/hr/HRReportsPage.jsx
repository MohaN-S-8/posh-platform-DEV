import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import DownloadIcon from "@mui/icons-material/Download";
import GroupsIcon from "@mui/icons-material/Groups";
import { useState } from "react";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";

const reports = [
  {
    title: "Employee Report",
    description: "Employee-wise status, completion percentage, and completion date.",
    endpoint: "/hr/reports/employees",
    fileName: "employee_training_report.xlsx",
    icon: <GroupsIcon />,
    status: "Available",
    format: "Excel",
  },
  {
    title: "Employee Report CSV",
    description: "Employee-wise status and completion data in CSV format.",
    endpoint: "/hr/reports/employees.csv",
    fileName: "employee_training_report.csv",
    icon: <GroupsIcon />,
    status: "Available",
    format: "CSV",
  },
  {
    title: "Employee Report PDF",
    description: "Printable employee-wise training status report.",
    endpoint: "/hr/reports/employees.pdf",
    fileName: "employee_training_report.pdf",
    icon: <GroupsIcon />,
    status: "Available",
    format: "PDF",
  },
  {
    title: "Department Report",
    description: "Department-wise total employees, completed, pending, and compliance rate.",
    endpoint: "/hr/reports/departments",
    fileName: "department_compliance_report.xlsx",
    icon: <AssessmentIcon />,
    status: "Available",
    format: "Excel",
  },
  {
    title: "Department Report CSV",
    description: "Department compliance data in CSV format.",
    endpoint: "/hr/reports/departments.csv",
    fileName: "department_compliance_report.csv",
    icon: <AssessmentIcon />,
    status: "Available",
    format: "CSV",
  },
  {
    title: "Department Report PDF",
    description: "Printable department compliance report.",
    endpoint: "/hr/reports/departments.pdf",
    fileName: "department_compliance_report.pdf",
    icon: <AssessmentIcon />,
    status: "Available",
    format: "PDF",
  },
  {
    title: "Certificate Report",
    description: "Issued certificates with employee, course, issue date, and status.",
    endpoint: "/hr/reports/certificates",
    fileName: "certificate_report.xlsx",
    icon: <BadgeIcon />,
    status: "Available",
    format: "Excel",
  },
  {
    title: "Certificate Report CSV",
    description: "Issued certificate records in CSV format.",
    endpoint: "/hr/reports/certificates.csv",
    fileName: "certificate_report.csv",
    icon: <BadgeIcon />,
    status: "Available",
    format: "CSV",
  },
  {
    title: "Certificate Report PDF",
    description: "Printable certificate issue report.",
    endpoint: "/hr/reports/certificates.pdf",
    fileName: "certificate_report.pdf",
    icon: <BadgeIcon />,
    status: "Available",
    format: "PDF",
  },
];

export function HRReportsPage() {
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
      setError(err.response?.data?.detail || "Unable to download report.");
    } finally {
      setDownloading("");
    }
  };

  return (
    <PortalShell
      title="HR Reports"
      subtitle="Download employee, department, and certificate reports for your company only."
    >

      {error && (
        <div
          style={{
            background: "#fff7f6",
            border: "1px solid #f3b4ae",
            borderRadius: "8px",
            color: "#c0392b",
            padding: "12px 14px",
            marginBottom: "18px",
          }}
        >
          {error}
        </div>
      )}

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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                  <span style={{ color: "#4A2E83", display: "flex" }}>{report.icon}</span>
                <span
                  className={`portal-badge ${available ? "portal-badge-green" : "portal-badge-purple"}`}
                >
                  {report.status}
                </span>
              </div>
              <h2 style={{ fontSize: "14.5px" }}>{report.title}</h2>
              <p style={{ marginBottom: "16px" }}>{report.description}</p>
              {available && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#17324d",
                    fontWeight: 800,
                    fontSize: "13px",
                  }}
                >
                  <DownloadIcon fontSize="small" />
                  {downloading === report.title ? "Downloading..." : `Download ${report.format}`}
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
