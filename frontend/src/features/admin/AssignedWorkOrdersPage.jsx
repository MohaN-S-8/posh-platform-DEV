import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

export function AssignedWorkOrdersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/companies/assigned-work-orders/");
        setRows(res.data || []);
      } catch (err) {
        setError(apiErrorMessage(err, "Failed to load assigned work orders."));
      } finally {
        setLoading(false);
      }
    };
    loadRows();
  }, []);

  return (
    <PortalShell
      title="Assigned Work Orders"
      subtitle="Company services assigned to you after work-order creation and approval."
    >
      {error && <div style={errorStyle}>{error}</div>}
      {loading ? (
        <p style={{ color: "var(--portal-muted)" }}>Loading assigned work orders...</p>
      ) : rows.length === 0 ? (
        <div style={emptyStyle}>No work orders are assigned to you yet.</div>
      ) : (
        <div style={gridStyle}>
          {rows.map((row, index) => (
            <article key={`${row.company_id}-${row.client_id || index}`} style={cardStyle}>
              <div style={cardTopStyle}>
                <div>
                  <strong style={companyStyle}>{row.company_name}</strong>
                  <span style={mutedStyle}>{row.reference_no || "No reference"}</span>
                </div>
                <span style={badgeStyle(row.approval_status)}>{row.approval_status}</span>
              </div>
              <div style={detailGridStyle}>
                <Info label="Client ID" value={row.client_id} />
                <Info label="Scope" value={row.scope} />
                <Info label="Deliverables" value={row.deliverables} />
                <Info label="Frequency" value={row.frequency} />
                <Info label="Start Date" value={row.start_date} />
                <Info label="Stop Date" value={row.stop_date} />
                <Info label="Contact Name" value={row.contact_name} />
                <Info label="Contact Email" value={row.contact_email} />
                <Info label="Contact Number" value={row.contact_number} />
              </div>
              <div style={notesStyle}>
                <strong>Notes</strong>
                <p>{row.notes || "-"}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </PortalShell>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span style={infoLabelStyle}>{label}</span>
      <strong style={infoValueStyle}>{value || "-"}</strong>
    </div>
  );
}

Info.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

const cardStyle = {
  background: "var(--portal-card)",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "18px",
  boxShadow: "0 2px 8px rgba(74,46,131,0.08)",
};

const cardTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
  marginBottom: "16px",
};

const companyStyle = {
  display: "block",
  color: "var(--portal-purple)",
  fontSize: "18px",
};

const mutedStyle = {
  display: "block",
  color: "var(--portal-muted)",
  fontSize: "13px",
  marginTop: "4px",
};

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "12px",
};

const infoLabelStyle = {
  display: "block",
  color: "var(--portal-muted)",
  fontSize: "12px",
  marginBottom: "3px",
};

const infoValueStyle = {
  color: "var(--portal-text)",
  fontSize: "14px",
};

const notesStyle = {
  marginTop: "16px",
  borderTop: "1px solid var(--portal-border)",
  paddingTop: "12px",
  color: "var(--portal-text)",
};

const badgeStyle = (status) => ({
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 800,
  background: status === "Approved" ? "#f7f3ff" : "#faf8ff",
  color: "var(--portal-purple)",
  border: "1px solid #d8c7ff",
});

const emptyStyle = {
  background: "var(--portal-card)",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "28px",
  color: "var(--portal-muted)",
  textAlign: "center",
};

const errorStyle = {
  background: "#fdf0f0",
  border: "1px solid #e74c3c",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#c0392b",
  marginBottom: "16px",
};
