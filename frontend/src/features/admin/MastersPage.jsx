import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

const tabs = [
  { key: "Country Code", label: "Country Code", addLabel: "+ Add Country" },
  { key: "State Code", label: "State Code", addLabel: "+ Add State" },
  { key: "City Code", label: "City Code", addLabel: "+ Add City" },
  { key: "Scope of Work ID", label: "Scope of Work", addLabel: "+ Add Scope" },
  { key: "Deliverables", label: "Deliverables", addLabel: "+ Add Deliverable" },
];

const emptyByTab = {
  "Country Code": { name: "", code: "", description: "" },
  "State Code": { country: "IN", name: "", code: "" },
  "City Code": { country: "IN", state: "", name: "", code: "" },
  "Scope of Work ID": { name: "", code: "" },
  Deliverables: { scope: "", name: "" },
};

const parseDescription = (description) => {
  try {
    const parsed = JSON.parse(description || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const codeFromName = (name) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 18);

export function MastersPage() {
  const [activeTab, setActiveTab] = useState("Country Code");
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState(emptyByTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchMasters = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/admin-config/");
      setRows(res.data?.master_codes || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load masters."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchMasters, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMasters]);

  const byCategory = useCallback(
    (category) => rows.filter((row) => row.category === category && row.is_active),
    [rows],
  );

  const countries = useMemo(() => byCategory("Country Code"), [byCategory]);
  const states = useMemo(() => byCategory("State Code"), [byCategory]);
  const scopes = useMemo(() => byCategory("Scope of Work ID"), [byCategory]);

  const updateDraft = (field, value) => {
    setDrafts((current) => ({
      ...current,
      [activeTab]: { ...current[activeTab], [field]: value },
    }));
  };

  const createRow = async () => {
    const draft = drafts[activeTab] || {};
    let payload = null;

    if (activeTab === "Country Code") {
      payload = { category: activeTab, name: draft.name, code: draft.code, description: "Country master", is_active: true };
    }
    if (activeTab === "State Code") {
      payload = { category: activeTab, name: draft.name, code: draft.code, description: JSON.stringify({ country: draft.country }), is_active: true };
    }
    if (activeTab === "City Code") {
      payload = { category: activeTab, name: draft.name, code: draft.code, description: JSON.stringify({ country: draft.country, state: draft.state }), is_active: true };
    }
    if (activeTab === "Scope of Work ID") {
      payload = { category: activeTab, name: draft.name, code: draft.code, description: "Scope master", is_active: true };
    }
    if (activeTab === "Deliverables") {
      const deliverableCode = `${draft.scope}-${codeFromName(draft.name)}`.slice(0, 80);
      payload = {
        category: activeTab,
        name: draft.name,
        code: deliverableCode,
        description: JSON.stringify({ scope: draft.scope }),
        is_active: true,
      };
    }

    if (!payload?.name?.trim() || !payload?.code?.trim()) {
      setError("Name and code are required.");
      return;
    }
    setSaving("create");
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/admin-config/master-codes", payload);
      setDrafts((current) => ({ ...current, [activeTab]: emptyByTab[activeTab] }));
      setSuccess(`${activeTab} added.`);
      await fetchMasters();
    } catch (err) {
      setError(apiErrorMessage(err, `Failed to add ${activeTab}.`));
    } finally {
      setSaving("");
    }
  };

  const updateRow = async (row, patch) => {
    setSaving(`row-${row.id}`);
    setError("");
    setSuccess("");
    try {
      await apiClient.put(`/admin-config/master-codes/${row.id}`, patch);
      setSuccess("Master updated.");
      await fetchMasters();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update master."));
    } finally {
      setSaving("");
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    setSaving(`row-${row.id}`);
    setError("");
    setSuccess("");
    try {
      await apiClient.delete(`/admin-config/master-codes/${row.id}`);
      setSuccess("Master deleted.");
      await fetchMasters();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to delete master."));
    } finally {
      setSaving("");
    }
  };

  return (
    <PortalShell title="Masters" subtitle="State Code, City Code, Scope of Work, Deliverables">
      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={activeTab === tab.key ? activeTabStyle : tabStyle}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={emptyStyle}>Loading masters...</div>
      ) : activeTab === "Deliverables" ? (
        <DeliverablesTab
          scopes={scopes}
          rows={byCategory("Deliverables")}
          draft={drafts.Deliverables}
          onDraft={updateDraft}
          onCreate={createRow}
          onDelete={deleteRow}
          saving={saving}
        />
      ) : (
        <StandardTab
          activeTab={activeTab}
          countries={countries}
          states={states}
          rows={byCategory(activeTab)}
          draft={drafts[activeTab]}
          onDraft={updateDraft}
          onCreate={createRow}
          onUpdate={updateRow}
          onDelete={deleteRow}
          saving={saving}
        />
      )}
    </PortalShell>
  );
}

function StandardTab({ activeTab, countries, states, rows, draft, onDraft, onCreate, onUpdate, onDelete, saving }) {
  const isCountry = activeTab === "Country Code";
  const isState = activeTab === "State Code";
  const isCity = activeTab === "City Code";
  const isScope = activeTab === "Scope of Work ID";
  const columns = [
    ...(isState || isCity ? ["Country"] : []),
    ...(isCity ? ["State"] : []),
    isCountry ? "Country Name" : isState ? "State Name" : isCity ? "City Name" : "Scope of Work",
    isScope ? "Scope Code" : "Code",
    "",
  ];

  return (
    <>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>{columns.map((column) => <th key={column} style={thStyle}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = parseDescription(row.description);
              return (
                <tr key={row.id} style={trStyle}>
                  {(isState || isCity) && <td style={tdStyle}>{meta.country || "IN"}</td>}
                  {isCity && <td style={tdStyle}>{meta.state || "-"}</td>}
                  <td style={tdStyle}>
                    <input
                      defaultValue={row.name}
                      onBlur={(e) => {
                        if (e.target.value !== row.name) onUpdate(row, { name: e.target.value });
                      }}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      defaultValue={row.code}
                      onBlur={(e) => {
                        const nextCode = e.target.value.toUpperCase();
                        if (nextCode !== row.code) onUpdate(row, { code: nextCode });
                      }}
                      style={inputStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => onDelete(row)} disabled={saving === `row-${row.id}`} style={deleteButtonStyle}>Delete</button>
                  </td>
                </tr>
              );
            })}
            <tr style={trStyle}>
              {(isState || isCity) && (
                <td style={tdStyle}>
                  <select value={draft.country || "IN"} onChange={(e) => onDraft("country", e.target.value)} style={inputStyle}>
                    {countries.map((country) => <option key={country.id} value={country.code}>{country.name}</option>)}
                  </select>
                </td>
              )}
              {isCity && (
                <td style={tdStyle}>
                  <select value={draft.state || ""} onChange={(e) => onDraft("state", e.target.value)} style={inputStyle}>
                    <option value="">Select State</option>
                    {states.map((state) => <option key={state.id} value={state.code}>{state.name}</option>)}
                  </select>
                </td>
              )}
              <td style={tdStyle}>
                <input value={draft.name || ""} placeholder={columns.at(-3) || columns[0]} onChange={(e) => onDraft("name", e.target.value)} style={inputStyle} />
              </td>
              <td style={tdStyle}>
                <input value={draft.code || ""} placeholder="Code" onChange={(e) => onDraft("code", e.target.value.toUpperCase())} style={inputStyle} />
              </td>
              <td style={tdStyle} />
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" onClick={onCreate} disabled={saving === "create"} style={primaryButtonStyle}>
        {tabs.find((tab) => tab.key === activeTab)?.addLabel}
      </button>
    </>
  );
}

function DeliverablesTab({ scopes, rows, draft, onDraft, onCreate, onDelete, saving }) {
  const grouped = scopes.map((scope) => ({
    ...scope,
    deliverables: rows.filter((row) => parseDescription(row.description).scope === scope.code),
  }));
  const unassigned = rows.filter((row) => !parseDescription(row.description).scope);

  return (
    <div style={deliverableListStyle}>
      {[...grouped, ...(unassigned.length ? [{ name: "General", code: "GENERAL", deliverables: unassigned }] : [])].map((scope) => (
        <section key={scope.code} style={deliverableCardStyle}>
          <h3 style={scopeTitleStyle}>{scope.name} ({scope.code})</h3>
          <div style={chipRowStyle}>
            {scope.deliverables.map((item) => (
              <button key={item.id} type="button" onClick={() => onDelete(item)} style={chipStyle}>
                {item.name} x
              </button>
            ))}
          </div>
          <div style={deliverableAddStyle}>
            <input
              value={draft.scope === scope.code ? draft.name : ""}
              placeholder="Add a deliverable"
              onChange={(e) => {
                onDraft("scope", scope.code);
                onDraft("name", e.target.value);
              }}
              style={inputStyle}
            />
            <button type="button" onClick={onCreate} disabled={saving === "create"} style={deleteButtonStyle}>+ Add</button>
          </div>
        </section>
      ))}
    </div>
  );
}

const masterRowShape = PropTypes.shape({
  id: PropTypes.number.isRequired,
  category: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  code: PropTypes.string.isRequired,
  description: PropTypes.string,
  is_active: PropTypes.bool,
});

StandardTab.propTypes = {
  activeTab: PropTypes.string.isRequired,
  countries: PropTypes.arrayOf(masterRowShape).isRequired,
  states: PropTypes.arrayOf(masterRowShape).isRequired,
  rows: PropTypes.arrayOf(masterRowShape).isRequired,
  draft: PropTypes.shape({
    country: PropTypes.string,
    state: PropTypes.string,
    name: PropTypes.string,
    code: PropTypes.string,
  }).isRequired,
  onDraft: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  saving: PropTypes.string.isRequired,
};

DeliverablesTab.propTypes = {
  scopes: PropTypes.arrayOf(masterRowShape).isRequired,
  rows: PropTypes.arrayOf(masterRowShape).isRequired,
  draft: PropTypes.shape({
    scope: PropTypes.string,
    name: PropTypes.string,
  }).isRequired,
  onDraft: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  saving: PropTypes.string.isRequired,
};

const tabBarStyle = {
  display: "flex",
  gap: "22px",
  borderBottom: "1px solid var(--portal-border)",
  marginBottom: "18px",
  overflowX: "auto",
};

const tabStyle = {
  border: "none",
  background: "transparent",
  padding: "13px 0",
  color: "var(--portal-muted)",
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabStyle = {
  ...tabStyle,
  color: "var(--portal-purple)",
  borderBottom: "2px solid var(--portal-pink)",
};

const tableWrapStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  overflowX: "auto",
  marginBottom: "12px",
};

const tableStyle = {
  width: "100%",
  minWidth: "760px",
  borderCollapse: "collapse",
};

const thStyle = {
  padding: "12px",
  textAlign: "left",
  background: "#faf8ff",
  color: "var(--portal-muted)",
  fontSize: "12px",
  textTransform: "uppercase",
};

const trStyle = {
  borderTop: "1px solid var(--portal-border)",
};

const tdStyle = {
  padding: "10px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--portal-border)",
  borderRadius: "7px",
  padding: "9px 10px",
  background: "white",
};

const primaryButtonStyle = {
  background: "var(--portal-purple)",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "11px 16px",
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

const deliverableListStyle = {
  display: "grid",
  gap: "14px",
};

const deliverableCardStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "18px",
};

const scopeTitleStyle = {
  margin: "0 0 12px",
  color: "var(--portal-purple)",
  fontSize: "16px",
};

const chipRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "12px",
};

const chipStyle = {
  background: "#f3e8ff",
  color: "var(--portal-purple)",
  border: "none",
  borderRadius: "999px",
  padding: "5px 10px",
  fontWeight: 800,
  cursor: "pointer",
};

const deliverableAddStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "10px",
};

const emptyStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "26px",
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
