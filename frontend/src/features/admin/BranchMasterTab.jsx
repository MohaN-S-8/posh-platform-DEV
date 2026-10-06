import { ValidatedForm } from "../../components/ValidatedForm";
import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import SaveIcon from "@mui/icons-material/Save";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { MasterCityInput } from "../../components/MasterCityInput";

const empty = { company_id: "", branch_name: "", branch_id: "", city: "", state: "", country: "", address1: "", ic_member_ids: ["", "", "", ""] };
const input = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: "10px 12px", border: "1px solid var(--portal-border)", borderRadius: 6, background: "white", color: "var(--portal-text)" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 16 };
const label = { display: "grid", gap: 7, minWidth: 0, fontSize: 13, fontWeight: 600 };
const button = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 12px", border: "1px solid var(--portal-border)", borderRadius: 6, background: "white", color: "var(--portal-purple)", cursor: "pointer" };
const cell = { padding: "12px 10px", textAlign: "left", borderBottom: "1px solid var(--portal-border)", verticalAlign: "top" };
const section = { display: "grid", gap: 16, padding: "20px 0", borderBottom: "1px solid var(--portal-border)" };
const heading = { margin: 0, fontSize: 15, color: "var(--portal-purple)" };

export function BranchMasterTab({ readOnly }) {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(empty);
  const [originalId, setOriginalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({ company: "", name: "", id: "" });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/admin-config/branches");
      setCompanies(response.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load branches."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const company = companies.find((item) => String(item.company_id) === String(form.company_id));
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const reset = () => { setForm(empty); setOriginalId(null); };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      await apiClient.post("/admin-config/branches", {
        ...form, company_id: Number(form.company_id), original_branch_id: originalId,
        ic_member_ids: form.ic_member_ids.filter(Boolean),
      });
      reset(); setSuccess("Branch saved."); await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to save branch."));
    } finally { setSaving(false); }
  };
  const download = async () => {
    setError("");
    try {
      const response = await apiClient.get("/admin-config/branches/template", { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url; link.download = "branch_master_template.xlsx"; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(apiErrorMessage(err, "Unable to download template.")); }
  };
  const upload = async (file) => {
    if (!file) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const data = new FormData(); data.append("file", file);
      const response = await apiClient.post("/admin-config/branches/bulk-upload", data, { headers: { "Content-Type": "multipart/form-data" } });
      setSuccess(response.data.detail); await load();
    } catch (err) { setError(apiErrorMessage(err, "Unable to import branches.")); }
    finally { setSaving(false); }
  };
  const edit = (row) => {
    setOriginalId(row.branch_id);
    setForm({ ...empty, ...row, ic_member_ids: Array.from({ length: 4 }, (_, index) => row.ic_member_ids?.[index] || "") });
    setError(""); setSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const branches = companies.flatMap((item) => item.branches.map((branch) => ({ ...branch, company_id: item.company_id, company_name: item.company_name, employees: item.employees, presiding_officers: item.presiding_officers })))
    .filter((branch) => (!filters.company || String(branch.company_id) === String(filters.company))
      && (branch.branch_name || "").toLowerCase().includes(filters.name.toLowerCase())
      && (branch.branch_id || "").toLowerCase().includes(filters.id.toLowerCase()));

  return <div>
    {error && <div role="alert" style={{ padding: 12, color: "#b91c1c" }}>{error}</div>}
    {success && <div role="status" style={{ padding: 12, color: "#15803d" }}>{success}</div>}
    {!readOnly && <ValidatedForm error={error} onSubmit={save} style={section}>
      <h3 style={heading}>{originalId === null ? "Add Branch" : "Edit Branch"}</h3>
      <fieldset disabled={saving || loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "grid", gap: 16 }}>
        <div style={grid}>
          <label style={label}>Company Name *
            <select required disabled={originalId !== null} value={form.company_id} onChange={(event) => { setForm({ ...empty, company_id: event.target.value }); }} style={input}>
              <option value="">Select Company</option>
              {companies.map((item) => <option key={item.company_id} value={item.company_id}>{item.company_name}</option>)}
            </select>
          </label>
          <label style={label}>Presiding Officer (auto)
            <input readOnly value={company?.presiding_officers.map((person) => person.name).join(", ") || ""} placeholder={company ? "Not assigned" : "Select Company first"} style={input} />
          </label>
        </div>
        <div style={grid}>
          <label style={label}>Branch Name *<input required maxLength={150} value={form.branch_name} onChange={(event) => update("branch_name", event.target.value)} style={input} /></label>
          <label style={label}>Branch ID *<input required readOnly={originalId !== null} maxLength={50} value={form.branch_id} onChange={(event) => update("branch_id", event.target.value)} style={input} /></label>
          <label style={label}>City<MasterCityInput autoMap value={form.city} state={form.state} country={form.country} onChange={(value, geography) => setForm((current) => ({ ...current, city: value, ...geography }))} /></label>
        </div>
        <div style={grid}>
          <label style={label}>Address<input maxLength={1000} value={form.address1} onChange={(event) => update("address1", event.target.value)} style={input} /></label>
          <label style={label}>State<input readOnly value={form.state} style={input} /></label>
          <label style={label}>Country<input readOnly value={form.country} style={input} /></label>
        </div>
        <h4 style={heading}>IC Committee Members for This Branch</h4>
        <div style={grid}>
          {[0, 1, 2, 3].map((index) => {
            const selected = company?.employees.find((person) => person.employee_id === form.ic_member_ids[index]);
            return <div key={index} style={{ display: "grid", gap: 12, minWidth: 0 }}>
              <label style={label}>IC Member {index + 1} - Employee ID
                <Autocomplete size="small" disabled={!company} options={company?.employees || []}
                  value={selected || null} getOptionLabel={(person) => `${person.employee_id} - ${person.name}`}
                  isOptionEqualToValue={(a, b) => a.employee_id === b.employee_id}
                  getOptionDisabled={(person) => form.ic_member_ids.some((id, position) => position !== index && id === person.employee_id)}
                  onChange={(_, person) => update("ic_member_ids", form.ic_member_ids.map((id, position) => position === index ? person?.employee_id || "" : id))}
                  renderInput={(params) => <TextField {...params} placeholder="Search Employee ID / name" slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, "aria-label": `IC Member ${index + 1} - Employee ID` } }} />} />
              </label>
              <label style={label}>Employee Name<input readOnly value={selected?.name || ""} style={input} /></label>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" style={{ ...button, background: "var(--portal-purple)", color: "white" }}><SaveIcon fontSize="small" />{saving ? "Saving..." : "Save Branch"}</button>
          {originalId !== null && <button type="button" onClick={reset} style={button}>Cancel</button>}
        </div>
      </fieldset>
    </ValidatedForm>}
    {!readOnly && <section style={section}>
      <h3 style={heading}>Bulk Upload Branches</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={download} style={button}><DownloadIcon fontSize="small" />Download Excel Template</button>
        <label style={button}><UploadFileIcon fontSize="small" />{saving ? "Uploading..." : "Bulk Upload Branches (Excel)"}
          <input type="file" accept=".xlsx" disabled={saving} style={{ display: "none" }} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
      </div>
    </section>}
    <section style={section}>
      <h3 style={heading}>Branches</h3>
      <div style={grid}>
        <label style={label}>Company Name
          <Autocomplete size="small" options={companies} getOptionLabel={(item) => item.company_name}
            value={companies.find((item) => String(item.company_id) === String(filters.company)) || null}
            isOptionEqualToValue={(a, b) => a.company_id === b.company_id}
            onChange={(_, item) => setFilters({ ...filters, company: item?.company_id || "" })}
            renderInput={(params) => <TextField {...params} placeholder="All Companies" />} />
        </label>
        <label style={label}>Branch Name<input value={filters.name} onChange={(event) => setFilters({ ...filters, name: event.target.value })} style={input} /></label>
        <label style={label}>Branch ID<input value={filters.id} onChange={(event) => setFilters({ ...filters, id: event.target.value })} style={input} /></label>
      </div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr>{["Company", "Branch", "Branch ID", "City / State", "Presiding Officer", "IC Members", ...(!readOnly ? ["Actions"] : [])].map((title) => <th key={title} style={cell}>{title}</th>)}</tr></thead>
        <tbody>{branches.map((branch, index) => <tr key={`${branch.company_id}-${branch.branch_id}-${index}`}>
          <td style={cell}>{branch.company_name}</td><td style={cell}>{branch.branch_name}</td><td style={cell}>{branch.branch_id}</td>
          <td style={cell}>{[branch.city, branch.state].filter(Boolean).join(", ")}</td>
          <td style={cell}>{branch.presiding_officers.map((person) => person.name).join(", ") || "Not assigned"}</td>
          <td style={cell}>{(branch.ic_member_ids || []).map((id) => branch.employees.find((person) => person.employee_id === id)?.name || id).join(", ") || "Not assigned"}</td>
          {!readOnly && <td style={cell}><button type="button" disabled={saving} onClick={() => edit(branch)} style={button}><EditIcon fontSize="small" />Edit</button></td>}
        </tr>)}{!branches.length && <tr><td colSpan={readOnly ? 6 : 7} style={cell}>{loading ? "Loading branches..." : "No branches found."}</td></tr>}</tbody>
      </table></div>
    </section>
  </div>;
}

BranchMasterTab.propTypes = { readOnly: PropTypes.bool.isRequired };
