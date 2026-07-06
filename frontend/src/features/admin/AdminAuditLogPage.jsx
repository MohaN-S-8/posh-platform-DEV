import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";

export function AdminAuditLogPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      setError("");
      try {
        const [actionRes, loginRes] = await Promise.all([
          apiClient.get("/admin/audit-logs"),
          apiClient.get("/admin/audit-logins"),
        ]);
        const actionLogs = (actionRes.data || []).map((log) => ({
          ...log,
          rowId: `action-${log.id}`,
          type: "Action",
          email: log.email || "-",
          successLabel: "-",
          timestamp: log.created_at,
        }));
        const loginLogs = (loginRes.data || []).map((log) => ({
          ...log,
          rowId: `login-${log.id}`,
          type: "Login",
          email: log.email_attempted,
          action: "LOGIN_ATTEMPT",
          table_name: "login_attempts",
          record_id: log.id,
          successLabel: log.success ? "Success" : "Failed",
          timestamp: log.attempted_at,
        }));
        setLogs(
          [...actionLogs, ...loginLogs].sort(
            (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0),
          ),
        );
      } catch (err) {
        setError(apiErrorMessage(err, "Unable to load audit logs."));
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button type="button" onClick={() => navigate("/admin")} style={backButtonStyle}>
        Back to Dashboard
      </button>
      <h1 style={{ color: "#17324d", margin: "0 0 6px", fontSize: "30px" }}>
        Audit Logs
      </h1>
      <p style={{ color: "#64748b", margin: "0 0 24px" }}>
        Recent login attempts and admin/HR actions captured with user, IP, target, and timestamp.
      </p>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={tableWrapStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
          <thead>
            <tr style={{ background: "#17324d", color: "white" }}>
              {["Type", "Action", "Email", "User ID", "Target", "IP Address", "Result", "Timestamp"].map((heading) => (
                <th key={heading} style={thStyle}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length ? (
              logs.map((log) => (
                <tr key={log.rowId} style={{ borderBottom: "1px solid #eef2f6" }}>
                  <td style={tdStyle}>{log.type}</td>
                  <td style={{ ...tdStyle, color: "#17324d", fontWeight: 700 }}>{log.action}</td>
                  <td style={tdStyle}>{log.email}</td>
                  <td style={tdStyle}>{log.user_id || "-"}</td>
                  <td style={tdStyle}>
                    {log.table_name || "-"}
                    {log.record_id ? ` #${log.record_id}` : ""}
                  </td>
                  <td style={tdStyle}>{log.ip_address || "-"}</td>
                  <td style={{ ...tdStyle, color: log.success === false ? "#c0392b" : "#1f7a4d" }}>
                    {log.successLabel}
                  </td>
                  <td style={tdStyle}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ padding: "28px", color: "#64748b" }}>
                  No audit log entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LoadingOverlay show={loading} title="Loading audit logs" message="Fetching login and action events." />
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

const tableWrapStyle = {
  background: "white",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  overflowX: "auto",
};

const thStyle = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: "13px",
};

const tdStyle = {
  padding: "12px 14px",
  color: "#64748b",
  fontSize: "13px",
};

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};
