import { useCallback, useEffect, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

const emptyOffice = {
  office_name: "",
  office_address: "",
  is_active: true,
};

export function PoshOfficeMasterPage() {
  const [offices, setOffices] = useState([]);
  const [draft, setDraft] = useState(emptyOffice);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadOffices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/admin-config/");
      setOffices((res.data?.offices || []).filter((office) => office.is_active));
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load PoSH offices."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadOffices, 0);
    return () => window.clearTimeout(timer);
  }, [loadOffices]);

  const createOffice = async () => {
    if (!draft.office_name.trim() || !draft.office_address.trim()) {
      setError("Office name and address are required.");
      return;
    }
    setSaving("create");
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/admin-config/offices", {
        ...draft,
        office_name: draft.office_name.trim().toUpperCase(),
      });
      setDraft(emptyOffice);
      setSuccess("PoSH office added.");
      await loadOffices();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to add PoSH office."));
    } finally {
      setSaving("");
    }
  };

  const updateOffice = async (office, patch) => {
    setSaving(`office-${office.id}`);
    setError("");
    setSuccess("");
    try {
      await apiClient.put(`/admin-config/offices/${office.id}`, patch);
      setSuccess("PoSH office updated.");
      await loadOffices();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update PoSH office."));
    } finally {
      setSaving("");
    }
  };

  const deleteOffice = async (office) => {
    if (!window.confirm(`Delete ${office.office_name}?`)) return;
    setSaving(`office-${office.id}`);
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/admin-config/offices/${office.id}`);
      setSuccess("PoSH office deleted.");
      await loadOffices();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete PoSH office."));
    } finally {
      setSaving("");
    }
  };

  return (
    <PortalShell
      title="PoSH Office Master"
      subtitle="Regional PoSH support office directory."
    >
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <section style={panelStyle}>
        <h3 style={panelTitleStyle}>PoSH Office Master</h3>
        <p style={helperTextStyle}>Regional PoSH support office directory used across client work.</p>

        {loading ? (
          <div style={emptyStyle}>Loading offices...</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Office Name</th>
                  <th style={thStyle}>Address</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {offices.map((office) => (
                  <tr key={office.id}>
                    <td style={tdStyle}>
                      <input
                        defaultValue={office.office_name}
                        onBlur={(event) => {
                          const value = event.target.value.trim().toUpperCase();
                          if (value && value !== office.office_name) {
                            updateOffice(office, { office_name: value });
                          }
                        }}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        defaultValue={office.office_address}
                        onBlur={(event) => {
                          const value = event.target.value.trim();
                          if (value && value !== office.office_address) {
                            updateOffice(office, { office_address: value });
                          }
                        }}
                        style={inputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        disabled={saving === `office-${office.id}`}
                        onClick={() => deleteOffice(office)}
                        style={deleteButtonStyle}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {offices.length === 0 && (
                  <tr>
                    <td colSpan={3} style={emptyCellStyle}>No PoSH offices found.</td>
                  </tr>
                )}
                <tr>
                  <td style={tdStyle}>
                    <input
                      value={draft.office_name}
                      onChange={(event) => setDraft({ ...draft, office_name: event.target.value.toUpperCase() })}
                      placeholder="Office name"
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      value={draft.office_address}
                      onChange={(event) => setDraft({ ...draft, office_address: event.target.value })}
                      placeholder="Office address"
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle} />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={createOffice}
          disabled={saving === "create"}
          style={primaryButtonStyle}
        >
          {saving === "create" ? "Adding..." : "+ Add Office"}
        </button>
      </section>
    </PortalShell>
  );
}

const panelStyle = {
  maxWidth: "1160px",
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "18px",
  display: "grid",
  gap: "14px",
};

const panelTitleStyle = {
  margin: 0,
  color: "var(--portal-purple)",
  fontSize: "15px",
};

const helperTextStyle = {
  margin: 0,
  color: "var(--portal-muted)",
  fontSize: "13px",
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: "760px",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#faf8ff",
  color: "var(--portal-muted)",
  fontSize: "12px",
  textTransform: "uppercase",
};

const tdStyle = {
  padding: "8px 12px",
  borderTop: "1px solid var(--portal-border)",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--portal-border)",
  borderRadius: "7px",
  padding: "9px 10px",
  color: "var(--portal-text)",
  background: "white",
};

const primaryButtonStyle = {
  width: "fit-content",
  background: "var(--portal-purple)",
  color: "white",
  border: "none",
  borderRadius: "7px",
  padding: "10px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const deleteButtonStyle = {
  background: "white",
  color: "var(--portal-text)",
  border: "1px solid var(--portal-border)",
  borderRadius: "7px",
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStyle = {
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "22px",
  color: "var(--portal-muted)",
  background: "#faf8ff",
};

const emptyCellStyle = {
  padding: "26px",
  textAlign: "center",
  color: "var(--portal-muted)",
};

const errorStyle = {
  background: "#fdf0f0",
  border: "1px solid #e74c3c",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#c0392b",
  marginBottom: "16px",
};

const successStyle = {
  background: "#f7f3ff",
  border: "1px solid #d8c7ff",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "var(--portal-purple)",
  marginBottom: "16px",
};
