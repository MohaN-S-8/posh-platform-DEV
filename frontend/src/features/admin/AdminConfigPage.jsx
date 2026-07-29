import { useEffect, useMemo, useState } from "react";
import BusinessIcon from "@mui/icons-material/Business";
import ChecklistIcon from "@mui/icons-material/Checklist";
import SecurityIcon from "@mui/icons-material/Security";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

const emptyMaster = {
  category: "State Code",
  name: "",
  code: "",
  description: "",
  is_active: true,
};

const emptyOffice = {
  office_name: "",
  office_address: "",
  is_active: true,
};

const emptyAccess = {
  role_label: "Employee",
  access_item: "",
  access_status: "Access enabled",
  is_allowed: true,
  display_order: 1,
};

const implementationRows = [
  ["Main Page - Login Option", "Done", "Landing page has login/signup and role-based login flow."],
  ["Signup / Login RBAC", "Done", "Super Admin, Corp Admin, Client / Mgmt, HR / IC, Employee roles exist."],
  ["Create Admin Login - 1A", "Done", "Only Super Admin can create Corp Admin users."],
  ["User Creation Flow", "Done", "Corp Admin -> Client/Mgmt -> HR/IC -> Employee is enforced in backend."],
  ["State / City / Scope / Deliverables - 1A", "Done", "Backend-backed master config is editable here."],
  ["Create Company / Work Order - 1A", "Done", "Company screen captures company registration and work-order/service details."],
  ["Company Registration - 1B", "Done", "Company form captures the pasted 1B fields, contacts, billing/corporate addresses, and branches."],
  ["Employee Master - 1C", "Done", "User form captures personal, employment, branch, transfer, reporting, and IC-role fields."],
  ["POSH Office - 1E", "Done", "Backend-backed POSH office config is editable here."],
  ["Role Access - 1E", "Done", "Backend-backed role access matrix is editable here."],
];

export function AdminConfigPage() {
  const [config, setConfig] = useState({ master_codes: [], offices: [], role_access: [] });
  const [masterForm, setMasterForm] = useState(emptyMaster);
  const [officeForm, setOfficeForm] = useState(emptyOffice);
  const [accessForm, setAccessForm] = useState(emptyAccess);
  const [editing, setEditing] = useState({ type: "", id: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const groupedMasters = useMemo(() => {
    return config.master_codes.reduce((groups, row) => {
      const key = row.category || "Other";
      groups[key] = groups[key] || [];
      groups[key].push(row);
      return groups;
    }, {});
  }, [config.master_codes]);

  const groupedAccess = useMemo(() => {
    return config.role_access.reduce((groups, row) => {
      const key = row.role_label || "Other";
      groups[key] = groups[key] || [];
      groups[key].push(row);
      return groups;
    }, {});
  }, [config.role_access]);

  const fetchConfig = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/admin-config/");
      setConfig(res.data || { master_codes: [], offices: [], role_access: [] });
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load POSH admin configuration."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(fetchConfig, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const resetForms = () => {
    setMasterForm(emptyMaster);
    setOfficeForm(emptyOffice);
    setAccessForm(emptyAccess);
    setEditing({ type: "", id: null });
  };

  const saveMaster = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editing.type === "master") {
        await apiClient.put(`/admin-config/master-codes/${editing.id}`, masterForm);
        setSuccess("Master code updated.");
      } else {
        await apiClient.post("/admin-config/master-codes", masterForm);
        setSuccess("Master code added.");
      }
      resetForms();
      await fetchConfig();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save master code."));
    } finally {
      setSaving(false);
    }
  };

  const saveOffice = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editing.type === "office") {
        await apiClient.put(`/admin-config/offices/${editing.id}`, officeForm);
        setSuccess("POSH office updated.");
      } else {
        await apiClient.post("/admin-config/offices", officeForm);
        setSuccess("POSH office added.");
      }
      resetForms();
      await fetchConfig();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save POSH office."));
    } finally {
      setSaving(false);
    }
  };

  const saveAccess = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = { ...accessForm, display_order: Number(accessForm.display_order || 1) };
      if (editing.type === "access") {
        await apiClient.put(`/admin-config/role-access/${editing.id}`, payload);
        setSuccess("Role access updated.");
      } else {
        await apiClient.post("/admin-config/role-access", payload);
        setSuccess("Role access added.");
      }
      resetForms();
      await fetchConfig();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save role access."));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (type, id) => {
    if (!window.confirm("Delete this configuration row?")) return;
    const endpoint = {
      master: "master-codes",
      office: "offices",
      access: "role-access",
    }[type];
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/admin-config/${endpoint}/${id}`);
      setSuccess("Configuration row deleted.");
      await fetchConfig();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete configuration row."));
    }
  };

  return (
    <PortalShell
      title="POSH Admin Configuration"
      subtitle="1A masters, 1E POSH offices, role access, and implementation flow cross-check."
    >
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}
      {loading ? (
        <p style={{ color: "#64748b" }}>Loading POSH configuration...</p>
      ) : (
        <>
          <section className="portal-grid-3" style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
            {Object.entries(groupedMasters).map(([category, rows]) => (
              <article className="portal-card" key={category}>
                <div className="portal-section-title" style={{ marginTop: 0 }}>
                  {category}
                </div>
                <table className="portal-table">
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.name}</strong>
                          <small style={mutedBlockStyle}>{row.description || "Configured master"}</small>
                        </td>
                        <td style={{ color: "var(--portal-purple)", fontWeight: 800 }}>{row.code}</td>
                        <td style={actionCellStyle}>
                          <button type="button" onClick={() => {
                            setMasterForm(row);
                            setEditing({ type: "master", id: row.id });
                          }} style={miniButtonStyle}>Edit</button>
                          <button type="button" onClick={() => removeRecord("master", row.id)} style={miniDangerStyle}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </section>

          <section style={editorGridStyle}>
            <form onSubmit={saveMaster} style={editorPanelStyle}>
              <h3 style={editorTitleStyle}>{editing.type === "master" ? "Edit 1A Master" : "Add 1A Master"}</h3>
              <label style={labelStyle}>Category
                <select value={masterForm.category} onChange={(e) => setMasterForm({ ...masterForm, category: e.target.value })} style={inputStyle}>
                  {["State Code", "City Code", "Scope of Work ID", "Deliverables", "Create Company", "Work Order Form"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>Name
                <input required value={masterForm.name} onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })} style={inputStyle} />
              </label>
              <label style={labelStyle}>Code
                <input required value={masterForm.code} onChange={(e) => setMasterForm({ ...masterForm, code: e.target.value.toUpperCase() })} style={inputStyle} />
              </label>
              <label style={labelStyle}>Description
                <input value={masterForm.description || ""} onChange={(e) => setMasterForm({ ...masterForm, description: e.target.value })} style={inputStyle} />
              </label>
              <label style={checkboxStyle}>
                <input type="checkbox" checked={masterForm.is_active} onChange={(e) => setMasterForm({ ...masterForm, is_active: e.target.checked })} />
                Active
              </label>
              <div style={buttonRowStyle}>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? "Saving..." : "Save Master"}</button>
                <button type="button" onClick={resetForms} style={secondaryButtonStyle}>Clear</button>
              </div>
            </form>

            <form onSubmit={saveOffice} style={editorPanelStyle}>
              <h3 style={editorTitleStyle}>{editing.type === "office" ? "Edit POSH Office" : "Add POSH Office"}</h3>
              <label style={labelStyle}>Office Name
                <input required value={officeForm.office_name} onChange={(e) => setOfficeForm({ ...officeForm, office_name: e.target.value.toUpperCase() })} style={inputStyle} />
              </label>
              <label style={labelStyle}>Office Address
                <textarea required rows={3} value={officeForm.office_address} onChange={(e) => setOfficeForm({ ...officeForm, office_address: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
              </label>
              <label style={checkboxStyle}>
                <input type="checkbox" checked={officeForm.is_active} onChange={(e) => setOfficeForm({ ...officeForm, is_active: e.target.checked })} />
                Active
              </label>
              <div style={buttonRowStyle}>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>Save Office</button>
                <button type="button" onClick={resetForms} style={secondaryButtonStyle}>Clear</button>
              </div>
            </form>

            <form onSubmit={saveAccess} style={editorPanelStyle}>
              <h3 style={editorTitleStyle}>{editing.type === "access" ? "Edit Role Access" : "Add Role Access"}</h3>
              <label style={labelStyle}>Role
                <select value={accessForm.role_label} onChange={(e) => setAccessForm({ ...accessForm, role_label: e.target.value })} style={inputStyle}>
                  {["Employee", "PO / Member", "Super Admin", "Corp Admin", "Client / Management", "HR / IC"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>Access Item
                <input required value={accessForm.access_item} onChange={(e) => setAccessForm({ ...accessForm, access_item: e.target.value })} style={inputStyle} />
              </label>
              <label style={labelStyle}>Status Text
                <input value={accessForm.access_status} onChange={(e) => setAccessForm({ ...accessForm, access_status: e.target.value })} style={inputStyle} />
              </label>
              <label style={labelStyle}>Display Order
                <input type="number" min="1" value={accessForm.display_order} onChange={(e) => setAccessForm({ ...accessForm, display_order: e.target.value })} style={inputStyle} />
              </label>
              <label style={checkboxStyle}>
                <input type="checkbox" checked={accessForm.is_allowed} onChange={(e) => setAccessForm({ ...accessForm, is_allowed: e.target.checked, access_status: e.target.checked ? "Access enabled" : "NO Access" })} />
                Access allowed
              </label>
              <div style={buttonRowStyle}>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>Save Access</button>
                <button type="button" onClick={resetForms} style={secondaryButtonStyle}>Clear</button>
              </div>
            </form>
          </section>

          <section style={{ marginBottom: "24px" }}>
            <div className="portal-section-title">POSH Office</div>
            <div className="portal-grid-3" style={{ display: "grid", gap: "16px" }}>
              {config.offices.map((office) => (
                <article className="portal-card" key={office.id}>
                  <BusinessIcon style={{ color: "var(--portal-purple)", marginBottom: "10px" }} />
                  <h3>{office.office_name}</h3>
                  <p>{office.office_address}</p>
                  <div style={buttonRowStyle}>
                    <button type="button" onClick={() => {
                      setOfficeForm(office);
                      setEditing({ type: "office", id: office.id });
                    }} style={miniButtonStyle}>Edit</button>
                    <button type="button" onClick={() => removeRecord("office", office.id)} style={miniDangerStyle}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: "24px" }}>
            <div className="portal-section-title">POSH Access</div>
            <div className="portal-grid-2" style={{ display: "grid", gap: "16px" }}>
              {Object.entries(groupedAccess).map(([role, rows]) => (
                <article className="portal-card" key={role}>
                  <SecurityIcon style={{ color: "var(--portal-pink)", marginBottom: "10px" }} />
                  <h3>{role}</h3>
                  <div className="portal-home-checklist">
                    {rows.map((row) => (
                      <div className="portal-home-check" key={row.id}>
                        <span className={row.is_allowed ? "done" : ""}><ChecklistIcon fontSize="small" /></span>
                        <div>
                          <strong>{row.access_item}</strong>
                          <small>{row.access_status}</small>
                          <div style={buttonRowStyle}>
                            <button type="button" onClick={() => {
                              setAccessForm(row);
                              setEditing({ type: "access", id: row.id });
                            }} style={miniButtonStyle}>Edit</button>
                            <button type="button" onClick={() => removeRecord("access", row.id)} style={miniDangerStyle}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <div className="portal-section-title">Flow Cross Check</div>
        <div className="portal-card" style={{ overflowX: "auto" }}>
          <table className="portal-table" style={{ minWidth: "820px" }}>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {implementationRows.map(([requirement, status, notes]) => (
                <tr key={requirement}>
                  <td>{requirement}</td>
                  <td><span className="portal-badge portal-badge-green">{status}</span></td>
                  <td>{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PortalShell>
  );
}

const editorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const editorPanelStyle = {
  display: "grid",
  gap: "12px",
  background: "white",
  border: "1px solid #d8e1ea",
  borderRadius: "8px",
  padding: "16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const editorTitleStyle = {
  margin: 0,
  color: "#1a3c5e",
  fontSize: "16px",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  color: "#17324d",
  fontWeight: 700,
  fontSize: "13px",
};

const checkboxStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  color: "#17324d",
  fontSize: "13px",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #d8e1ea",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const buttonRowStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryButtonStyle = {
  padding: "9px 14px",
  background: "#1a3c5e",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryButtonStyle = {
  padding: "8px 12px",
  background: "#eef4f8",
  color: "#17324d",
  border: "1px solid #cdd9e2",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 800,
};

const miniButtonStyle = {
  ...secondaryButtonStyle,
  padding: "5px 8px",
  fontSize: "12px",
};

const miniDangerStyle = {
  ...miniButtonStyle,
  background: "#fff1f2",
  color: "#b42318",
  border: "1px solid #fecdd3",
};

const actionCellStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const mutedBlockStyle = {
  display: "block",
  color: "#64748b",
  fontSize: "12px",
  marginTop: "3px",
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
  background: "#e8f5ee",
  border: "1px solid #1f7a4d",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#1f7a4d",
  marginBottom: "16px",
};
