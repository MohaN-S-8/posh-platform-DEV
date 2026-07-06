import DownloadIcon from "@mui/icons-material/Download";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";

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
      setError(apiErrorMessage(err, "Unable to download report."));
    } finally {
      setDownloading("");
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button type="button" onClick={() => navigate("/admin")} style={backButtonStyle}>
        Back to Dashboard
      </button>
      <h1 style={{ color: "#17324d", margin: "0 0 6px", fontSize: "30px" }}>
        Admin Reports
      </h1>
      <p style={{ color: "#64748b", margin: "0 0 24px" }}>
        Download audit and compliance reports currently backed by the HR report APIs.
      </p>

      {error && <div style={errorStyle}>{error}</div>}

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
                textAlign: "left",
                minHeight: "160px",
                cursor: available ? "pointer" : "not-allowed",
                opacity: available ? 1 : 0.76,
              }}
            >
              <span
                style={{
                  color: available ? "#1f7a4d" : "#64748b",
                  background: available ? "#e8f5e9" : "#eef2f6",
                  borderRadius: "999px",
                  padding: "4px 9px",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                {report.status}
              </span>
              <h2 style={{ color: "#17324d", fontSize: "17px", margin: "16px 0 8px" }}>
                {report.title}
              </h2>
              <p style={{ color: "#64748b", margin: "0 0 14px", fontSize: "13px" }}>
                {report.description}
              </p>
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
    </div>
  );
}

const backButtonStyle = {
  background: "none",
  border: "none",
  color: "#17324d",
  cursor: "pointer",
  marginBottom: "16px",
  fontWeight: 700,
};

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};
