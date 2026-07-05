import AssessmentIcon from "@mui/icons-material/Assessment";
import BadgeIcon from "@mui/icons-material/Badge";
import DownloadIcon from "@mui/icons-material/Download";
import GroupsIcon from "@mui/icons-material/Groups";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

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
  const navigate = useNavigate();
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
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button
        type="button"
        onClick={() => navigate("/hr")}
        style={{
          background: "none",
          border: "none",
          color: "#17324d",
          cursor: "pointer",
          marginBottom: "16px",
          fontWeight: 700,
        }}
      >
        Back to HR Dashboard
      </button>

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
          HR Reports
        </h1>
        <p style={{ color: "#64748b", margin: "6px 0 0" }}>
          Download audit-ready reports for employees, departments, and certificates.
        </p>
      </div>

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
        }}
      >
        {reports.map((report) => {
          const available = Boolean(report.endpoint);
          return (
            <button
              key={report.title}
              type="button"
              disabled={!available || downloading === report.title}
              onClick={() => downloadReport(report)}
              style={{
                background: "white",
                borderRadius: "8px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e7edf3",
                minHeight: "170px",
                textAlign: "left",
                cursor: available ? "pointer" : "not-allowed",
                opacity: available ? 1 : 0.76,
              }}
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
                <span style={{ color: "#17324d", display: "flex" }}>{report.icon}</span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: available ? "#1f7a4d" : "#64748b",
                    background: available ? "#e8f5e9" : "#eef2f6",
                    borderRadius: "999px",
                    padding: "4px 9px",
                  }}
                >
                  {report.status}
                </span>
              </div>
              <h2 style={{ color: "#17324d", margin: "0 0 8px", fontSize: "17px" }}>
                {report.title}
              </h2>
              <p style={{ color: "#64748b", margin: "0 0 16px", fontSize: "13px", lineHeight: 1.5 }}>
                {report.description}
              </p>
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
    </div>
  );
}
