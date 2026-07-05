import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

export function CompliancePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadCompliance = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/hr/compliance/dashboard");
        if (active) setData(res.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to load compliance dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCompliance();
    return () => {
      active = false;
    };
  }, []);

  const downloadReport = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await apiClient.get("/hr/reports/employees", {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "employee_training_report.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.detail || "Download failed.");
    } finally {
      setDownloading(false);
    }
  };

  const stats = [
    { label: "Total Employees", value: data?.total_employees ?? 0, color: "#17324d" },
    { label: "Completed", value: data?.completed ?? 0, color: "#1f7a4d" },
    { label: "In Progress", value: data?.in_progress ?? 0, color: "#c77918" },
    { label: "Not Started", value: data?.not_started ?? 0, color: "#c0392b" },
  ];

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => navigate("/hr")}
            style={{
              background: "none",
              border: "none",
              color: "#17324d",
              cursor: "pointer",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            Back to HR Dashboard
          </button>
          <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
            Compliance Dashboard
          </h1>
        </div>
        <button
          type="button"
          onClick={downloadReport}
          disabled={downloading}
          style={{
            padding: "10px 20px",
            background: downloading ? "#93a4b7" : "#1f7a4d",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: downloading ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {downloading ? "Downloading..." : "Download Excel Report"}
        </button>
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
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              border: "1px solid #e7edf3",
              borderTop: `4px solid ${color}`,
            }}
          >
            <div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e7edf3",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            gap: "12px",
          }}
        >
          <h2 style={{ margin: 0, color: "#17324d", fontSize: "20px" }}>
            Overall Compliance Rate
          </h2>
          <span
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: (data?.compliance_rate ?? 0) >= 80 ? "#1f7a4d" : "#c0392b",
            }}
          >
            {data?.compliance_rate ?? 0}%
          </span>
        </div>
        <div
          style={{
            height: "12px",
            background: "#edf2f7",
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, data?.compliance_rate ?? 0)}%`,
              background: (data?.compliance_rate ?? 0) >= 80 ? "#1f7a4d" : "#c0392b",
            }}
          />
        </div>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e7edf3",
          marginBottom: "20px",
          overflowX: "auto",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#17324d", fontSize: "20px" }}>
          Department Compliance
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
          <thead>
            <tr style={{ background: "#f6f8fb" }}>
              {["Department", "Employees", "Completed", "Pending", "Compliance"].map(
                (h, index) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: index === 0 ? "left" : "right",
                      fontSize: "13px",
                      color: "#64748b",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data?.department_breakdown?.length ? (
              data.department_breakdown.map((dept) => (
                <tr key={dept.department} style={{ borderBottom: "1px solid #eef2f6" }}>
                  <td style={{ padding: "10px 16px", fontSize: "14px" }}>
                    {dept.department}
                  </td>
                  {[dept.total, dept.completed, dept.pending, `${dept.compliance_rate}%`].map(
                    (value, index) => (
                      <td
                        key={index}
                        style={{
                          padding: "10px 16px",
                          fontSize: "14px",
                          textAlign: "right",
                          fontWeight: 700,
                          color: "#17324d",
                        }}
                      >
                        {value}
                      </td>
                    ),
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: "16px", color: "#64748b" }}>
                  No department data available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.overdue_employees?.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: "8px",
            padding: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e7edf3",
            overflowX: "auto",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#c0392b", fontSize: "20px" }}>
            Overdue Employees ({data.overdue_employees.length})
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
            <thead>
              <tr style={{ background: "#fff7f6" }}>
                {["Name", "Email", "Due Date"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "13px",
                      color: "#c0392b",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.overdue_employees.map((emp, index) => (
                <tr key={`${emp.email}-${index}`} style={{ borderBottom: "1px solid #eef2f6" }}>
                  <td style={{ padding: "10px 16px", fontSize: "14px" }}>
                    {emp.name}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "14px", color: "#64748b" }}>
                    {emp.email}
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: "14px", color: "#c0392b" }}>
                    {emp.due_date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LoadingOverlay
        show={loading || downloading}
        title={downloading ? "Downloading report" : "Loading compliance"}
        message={
          downloading
            ? "Preparing the employee training report."
            : "Fetching training status and department compliance."
        }
      />
    </div>
  );
}
