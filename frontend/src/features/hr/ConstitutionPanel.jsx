import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import SaveIcon from "@mui/icons-material/Save";
import UploadIcon from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon from "@mui/icons-material/Delete";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { ValidatedForm } from "../../components/ValidatedForm";
import { useAuthStore } from "../../store/authStore";
import { NoticeMeetingsPanel } from "./NoticeMeetingsPanel";
import "./constitution.css";

const emptyMember = { name: "", organization: "", designation: "", location: "", contact: "", email: "" };
const fields = [["name", "Name", true, 150], ["organization", "Company Name (optional)", false, 200], ["designation", "Designation", true, 150], ["location", "Location", false, 150], ["contact", "Contact No.", false, 25], ["email", "Email ID", true, 254]];

export function ConstitutionPanel() {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    apiClient.get("/hr/compliance/companies").then(({ data }) => {
      if (!active) return;
      setCompanies(data);
      if (data.length === 1) setCompanyId(String(data[0].company_id));
    }).catch((err) => { if (active) setError(apiErrorMessage(err, "Unable to load companies.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <section className="constitution-panel">
    <label className="constitution-company">Company
      <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
        <option value="">Select Company</option>
        {companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company_name}</option>)}
      </select>
    </label>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading companies...</p>}
    {!loading && !error && !companies.length && <p role="status">No companies are assigned to this account.</p>}
    {companyId && <CompanyConstitution key={companyId} companyId={companyId} canEdit={[1, 2, 5].includes(user?.role_id)} />}
  </section>;
}

function CompanyConstitution({ companyId, canEdit }) {
  const [data, setData] = useState({ members: [], letters: [] });
  const [member, setMember] = useState(emptyMember);
  const [memberId, setMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState("");
  const base = `/hr/compliance/companies/${companyId}`;
  useEffect(() => {
    let active = true;
    apiClient.get(`${base}/constitution`).then(({ data: result }) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(apiErrorMessage(err)); });
    return () => { active = false; };
  }, [base]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const refresh = async () => setData((await apiClient.get(`${base}/constitution`)).data);
  const act = async (action) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (err) { setError(apiErrorMessage(err, "Unable to complete this action.")); }
    finally { setBusy(false); }
  };
  const saveMember = (event) => {
    event.preventDefault();
    return act(async () => {
      await apiClient.post(`${base}/members`, member);
      setMember(emptyMember); await refresh(); setMessage("External member saved.");
    });
  };
  const submit = (event) => {
    event.preventDefault();
    return act(async () => {
      const body = new FormData(); body.append("member_id", memberId); body.append("title", title); body.append("file", file);
      const res = await apiClient.post(`${base}/letters`, body, { headers: { "Content-Type": "multipart/form-data" } });
      setData((current) => ({ ...current, letters: [res.data, ...current.letters.filter((row) => row.id !== res.data.id)] }));
      setTitle(""); setFile(null); setFileKey((key) => key + 1);
      setMessage(res.data.delivery_status === "Sent" ? "Letter submitted. Approval email sent." : "Letter saved, but email delivery failed. Use Resend approval email.");
    });
  };
  const fileErrors = () => !file ? ["Select a management approval PDF."] : file.size > 10 * 1024 * 1024 ? ["PDF must be 10 MB or smaller."] : !file.name.toLowerCase().endsWith(".pdf") ? ["Upload a PDF document."] : [];
  return <>
    {message && <p role="status">{message}</p>}
    <h3 className="portal-section-title">External Member Status</h3>
    {canEdit && <ValidatedForm className="constitution-form" onSubmit={saveMember} error={error}
      validate={() => member.contact && (!/^\+?[0-9 ()-]+$/.test(member.contact) || member.contact.replace(/\D/g, "").length < 7 || member.contact.replace(/\D/g, "").length > 15) ? ["Contact No. must contain 7 to 15 digits."] : []}>
      <h4>Add External Member</h4>
      <div className="constitution-grid">{fields.map(([key, label, required, max]) => <label key={key}>{label}{required ? " *" : ""}
        <input data-validation={key === "name" ? "person" : key === "contact" ? "international-phone" : undefined} required={required} maxLength={max} type={key === "email" ? "email" : key === "contact" ? "tel" : "text"} value={member[key]} onChange={(event) => setMember({ ...member, [key]: event.target.value })} />
      </label>)}</div>
      <button className="portal-primary-btn" disabled={busy}><SaveIcon fontSize="small" /> Save External Member</button>
    </ValidatedForm>}
    <div className="constitution-table"><table><thead><tr>{["Name", "Company", "Designation", "Location", "Contact No.", "Email ID", "Actions"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{data.members.map((row) => <tr key={row.id}>{["name", "organization", "designation", "location", "contact", "email"].map((key) => <td key={key}>{row[key] || "-"}</td>)}
        <td>{canEdit && <button type="button" title="Delete external member" aria-label={`Delete ${row.name}`} disabled={busy} onClick={() => {
          if (window.confirm(`Delete external member ${row.name}?`)) act(async () => { await apiClient.delete(`${base}/members/${row.id}`); if (memberId === String(row.id)) setMemberId(""); await refresh(); setMessage("External member deleted."); });
        }}><DeleteOutlineIcon fontSize="small" /></button>}</td></tr>)}
        {!data.members.length && <tr><td colSpan={7}>No external members added.</td></tr>}</tbody></table></div>
    <h3 className="portal-section-title">IC Constitution Status</h3>
    {canEdit && <ValidatedForm className="constitution-form" error={error} onSubmit={submit} validate={fileErrors}>
      <h4>Upload Management Approval Letter</h4>
      <div className="constitution-grid">
        <label>Letter Title (optional)<input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Route for Approval to External Member *<select required value={memberId} onChange={(event) => setMemberId(event.target.value)}><option value="">Select External Member</option>{data.members.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.email})</option>)}</select></label>
        <label>Management Approval File (PDF, up to 10 MB) *<input key={fileKey} type="file" required accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      </div>
      <button className="portal-primary-btn" disabled={busy}><UploadIcon fontSize="small" /> Submit for Approval</button>
    </ValidatedForm>}
    {error && <p role="alert">{error}</p>}
    <div className="constitution-table"><table><thead><tr>{["Letter", "File", "Approver", "Submitted", "Status", "Email"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{data.letters.map((row) => <tr key={row.id}><td>{row.title || "IC Constitution Letter"}</td><td><button type="button" disabled={busy} onClick={() => act(async () => { const res = await apiClient.get(`${base}/letters/${row.id}/file`, { responseType: "blob" }); setPreview(URL.createObjectURL(res.data)); })}>{row.filename}</button></td><td>{row.approver_name}<br />{row.approver_email}</td><td>{new Date(`${row.submitted_at}Z`).toLocaleDateString()}</td><td>{row.status}{row.status === "Completed" ? " (Locked)" : ""}</td><td>{row.delivery_status}
        {canEdit && row.status === "Pending" && <button type="button" disabled={busy} onClick={() => act(async () => { const res = await apiClient.post(`${base}/letters/${row.id}/resend`); await refresh(); setMessage(res.data.delivery_status === "Sent" ? "Approval email sent." : "Email delivery failed. Please retry."); })}>Resend approval email</button>}</td></tr>)}
        {!data.letters.length && <tr><td colSpan={6}>No IC Constitution letters uploaded yet.</td></tr>}</tbody></table></div>
    {preview && <div role="dialog" aria-label="Management approval letter" className="constitution-preview"><button type="button" onClick={() => setPreview("")}>Close</button><iframe title="Management approval letter" src={preview} /></div>}
    <NoticeMeetingsPanel companyId={companyId} canEdit={canEdit} />
  </>;
}
CompanyConstitution.propTypes = { companyId: PropTypes.string.isRequired, canEdit: PropTypes.bool.isRequired };
