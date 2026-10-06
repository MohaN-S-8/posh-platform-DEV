import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import { meetingPrintHtml } from "./meetingPrint";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { ValidatedForm } from "../../components/ValidatedForm";

const agendas = ["Welcome Note by the Presiding Officer", "Changes / Additions of IC Members and Brief Introductions", "Status of Complaints Received", "Any Other Status", "Upcoming Meeting Dates and Other Activities"];
const empty = () => ({ branch_id: "", year: new Date().getFullYear(), quarter: 1, meeting_date: "", meeting_time: "", presiding_officer: "", venue: "", attendees: "", agenda1: "", agenda2: "", agenda3: "", agenda4: "", agenda5: "" });
const dateLabel = (value) => value ? value.slice(0, 10).split("-").reverse().join("/") : "-";
const options = (rows) => rows.map((row) => <option key={row.branch_id} value={row.branch_id}>{row.branch_name}</option>);

export function NoticeMeetingsPanel({ companyId, canEdit }) {
  const [branches, setBranches] = useState([]);
  const [notices, setNotices] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [notice, setNotice] = useState({ branch_id: "", status: "Completed", notes: "" });
  const [form, setForm] = useState(empty);
  const [show, setShow] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState({ branch: "", year: "", quarter: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const formRef = useRef(null);
  const detailRef = useRef(null);
  useEffect(() => { if (selected) detailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [selected]);
  useEffect(() => { if (show) formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [show, formKey]);
  const base = `/hr/compliance/companies/${companyId}`;
  useEffect(() => {
    let active = true;
    Promise.all([apiClient.get(`${base}/notices`), apiClient.get(`${base}/meetings`)]).then(([n, m]) => {
      if (active) { setBranches(n.data.branches || []); setNotices(n.data.notices || []); setMeetings(Array.isArray(m.data) ? m.data : []); }
    }).catch((err) => { if (active) setError(apiErrorMessage(err)); });
    return () => { active = false; };
  }, [base]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const act = async (action) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (err) { setError(apiErrorMessage(err, "Unable to save compliance information.")); }
    finally { setBusy(false); }
  };
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const reloadMeetings = async () => setMeetings((await apiClient.get(`${base}/meetings`)).data);
  const filtered = meetings.filter((row) => (!filter.branch || row.branch_id === filter.branch) && (!filter.year || row.year === Number(filter.year)) && (!filter.quarter || row.quarter === Number(filter.quarter)));
  const years = [...new Set([new Date().getFullYear(), ...meetings.map((row) => row.year)])].sort((a, b) => b - a);
  const validateMeeting = () => {
    const issues = [];
    if (form.meeting_date) {
      const [year, month] = form.meeting_date.split("-").map(Number);
      if (year !== Number(form.year) || Math.ceil(month / 3) !== Number(form.quarter)) issues.push("Meeting date must fall within the selected year and quarter.");
    }
    if (photo && (photo.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(photo.type))) issues.push("Meeting photo must be JPEG or PNG, up to 10 MB.");
    return issues;
  };
  const saveNotice = (event) => {
    event.preventDefault();
    return act(async () => { await apiClient.put(`${base}/notices`, notice); setNotices((await apiClient.get(`${base}/notices`)).data.notices); setMessage("Notice display status saved."); });
  };
  const saveMeeting = (event) => {
    event.preventDefault();
    return act(async () => {
      const body = new FormData(); body.append("payload", JSON.stringify(form)); if (photo) body.append("photo", photo);
      if (editingId) await apiClient.put(`${base}/meetings/${editingId}`, body, { headers: { "Content-Type": "multipart/form-data" } });
      else await apiClient.post(`${base}/meetings`, body, { headers: { "Content-Type": "multipart/form-data" } });
      await reloadMeetings(); setShow(false); setPhoto(null); setSelected(null); setEditingId(null); setMessage("Minutes of Meeting saved.");
    });
  };
  const viewMeeting = (row) => act(async () => setSelected((await apiClient.get(`${base}/meetings/${row.id}`)).data));
  const editMeeting = (row) => act(async () => {
    const { data } = await apiClient.get(`${base}/meetings/${row.id}`);
    setForm(Object.fromEntries(Object.keys(empty()).map((key) => [key, key === "meeting_time" ? data[key].slice(0, 5) : data[key] ?? ""])));
    setEditingId(row.id); setPhoto(null); setFormKey((key) => key + 1); setShow(true); setSelected(null);
  });
  const printMeeting = (row) => {
    const page = window.open("", "_blank", "width=950,height=1100");
    if (!page) { setError("Allow pop-ups to open the print preview."); return; }
    page.opener = null;
    act(async () => {
      try {
        const { data } = await apiClient.get(`${base}/meetings/${row.id}`);
        page.document.open(); page.document.write(meetingPrintHtml(data)); page.document.close(); page.focus();
      } catch (err) { page.close(); throw err; }
    });
  };
  const openProof = (row, kind) => act(async () => {
    const res = await apiClient.get(`${base}/meetings/${row.id}/documents/${kind}`, { responseType: "blob" });
    setPreview({ url: URL.createObjectURL(res.data), kind });
  });
  const signedUpload = (row, event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".pdf")) { setError("Signed MOM must be PDF, up to 10 MB."); return; }
    act(async () => {
      const body = new FormData(); body.append("file", file);
      await apiClient.post(`${base}/meetings/${row.id}/signed`, body, { headers: { "Content-Type": "multipart/form-data" } });
      await reloadMeetings(); setMessage("Signed MOM uploaded.");
    });
  };
  return <>
    <h3 className="portal-section-title">Displays &amp; Notices Status</h3>
    {canEdit && <ValidatedForm className="constitution-form" error={error} onSubmit={saveNotice}>
      <h4>Update Notice Display Status</h4><div className="constitution-grid">
        <label>Branch Name *<select required value={notice.branch_id} onChange={(event) => { const row = notices.find((item) => item.branch_id === event.target.value); setNotice({ branch_id: event.target.value, status: row?.status || "Completed", notes: row?.notes || "" }); }}><option value="">Select Branch</option>{options(branches)}</select></label>
        <label>Status *<select value={notice.status} onChange={(event) => setNotice({ ...notice, status: event.target.value })}><option>Completed</option><option>Pending</option></select></label>
        <label>Notes (optional)<input maxLength={2000} value={notice.notes} onChange={(event) => setNotice({ ...notice, notes: event.target.value })} /></label>
      </div><button className="portal-primary-btn" disabled={busy}><SaveIcon fontSize="small" /> Save Status</button>
    </ValidatedForm>}
    <div className="constitution-table"><table><thead><tr><th>Branch</th><th>Status</th><th>Notes</th><th>Last Updated</th></tr></thead><tbody>
      {notices.map((row) => <tr key={row.id}><td>{row.branch_name}</td><td><span className={`portal-badge ${row.status === "Completed" ? "portal-badge-green" : "portal-badge-amber"}`}>{row.status}</span></td><td>{row.notes || "-"}</td><td>{dateLabel(row.updated_at)}</td></tr>)}
      {!notices.length && <tr><td colSpan={4}>No notice display status recorded.</td></tr>}</tbody></table></div>
    <h3 className="portal-section-title">Minutes of Meeting - Quarterly IC Meetings</h3>
    <div ref={formRef} className="meeting-header"><h4>{editingId ? "Edit Quarterly Meeting" : "Record a Quarterly Meeting"}</h4>{canEdit && <button type="button" className="portal-primary-btn" disabled={busy} onClick={() => { setEditingId(null); setForm(empty()); setPhoto(null); setFormKey((key) => key + 1); setError(""); setShow(true); }}><AddIcon fontSize="small" /> New Minutes of Meeting</button>}</div>
    {show && canEdit && <ValidatedForm key={formKey} className="constitution-form" error={error} validate={validateMeeting} onSubmit={saveMeeting}>
      <div className="constitution-grid">
        <label>Branch Name *<select required value={form.branch_id} onChange={(event) => update("branch_id", event.target.value)}><option value="">Select Branch</option>{options(branches)}</select></label>
        <label>Year *<select required value={form.year} onChange={(event) => update("year", Number(event.target.value))}>{Array.from({ length: 101 }, (_, index) => 2100 - index).map((year) => <option key={year}>{year}</option>)}</select></label>
        <label>Quarterly Meeting *<select required value={form.quarter} onChange={(event) => update("quarter", Number(event.target.value))}>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select></label>
        {[["meeting_date", "Meeting Date", "date", 10], ["meeting_time", "Meeting Time", "time", 5], ["presiding_officer", "Presiding Officer Name", "text", 150], ["venue", "Venue / Mode of Meeting", "text", 500], ["attendees", "Members Present (Attendees)", "text", 4000]].map(([key, label, type, max]) => <label key={key} className={["venue", "attendees"].includes(key) ? "meeting-wide" : ""}>{label} *<input required type={type} maxLength={max} value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
      </div><h4 className="portal-section-title">Key Discussion Points</h4>
      {agendas.map((label, index) => <label className="meeting-agenda" key={label}>Agenda {index + 1} - {label}<textarea rows={3} maxLength={10000} value={form[`agenda${index + 1}`]} onChange={(event) => update(`agenda${index + 1}`, event.target.value)} /></label>)}
      <label className="meeting-agenda">Meeting Photo (proof)<input type="file" accept="image/jpeg,image/png" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label>
      <div className="meeting-header"><button disabled={busy} className="portal-primary-btn"><SaveIcon fontSize="small" /> {editingId ? "Update Minutes of Meeting" : "Save Minutes of Meeting"}</button><button type="button" disabled={busy} className="portal-outline-btn" onClick={() => { setShow(false); setEditingId(null); setPhoto(null); setError(""); }}>Cancel</button></div>
    </ValidatedForm>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="constitution-grid meeting-filters">
      <label>Select Branch<select value={filter.branch} onChange={(event) => setFilter({ ...filter, branch: event.target.value })}><option value="">All Branches</option>{options([...new Map([...branches, ...meetings].map((row) => [row.branch_id, row])).values()])}</select></label>
      <label>Select Year<select value={filter.year} onChange={(event) => setFilter({ ...filter, year: event.target.value })}><option value="">All Years</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
      <label>Select Quarterly Meeting<select value={filter.quarter} onChange={(event) => setFilter({ ...filter, quarter: event.target.value })}><option value="">All Quarters</option>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select></label>
    </div>
    <div className="constitution-table"><table><thead><tr>{["Branch", "Year", "Quarter", "Meeting Date", "Time", "Attendees", "Photo Proof", "Signed MOM", "Actions"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>
      {filtered.map((row) => <tr key={row.id}><td>{row.branch_name}</td><td>{row.year}</td><td>Q{row.quarter}</td><td>{dateLabel(row.meeting_date)}</td><td>{row.meeting_time.slice(0, 5)}</td><td>{row.attendees}</td><td>{row.has_photo ? <button type="button" disabled={busy} onClick={() => openProof(row, "photo")}>Photo proof</button> : "-"}</td>
        <td>{row.has_signed_mom ? <button type="button" disabled={busy} onClick={() => openProof(row, "signed")}>Signed MOM</button> : <>Not uploaded{canEdit && <label>Upload PDF<input aria-label={`Upload signed MOM for ${row.branch_name} Q${row.quarter} ${row.year}`} type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => signedUpload(row, event)} /></label>}</>}</td><td><div className="meeting-actions"><button type="button" disabled={busy} onClick={() => viewMeeting(row)}><VisibilityIcon fontSize="small" /> View</button>{canEdit && <button type="button" disabled={busy} onClick={() => editMeeting(row)}><EditIcon fontSize="small" /> Edit</button>}<button type="button" disabled={busy} onClick={() => printMeeting(row)}><PrintIcon fontSize="small" /> Print</button></div></td></tr>)}
      {!filtered.length && <tr><td colSpan={9}>No meeting records match these filters.</td></tr>}</tbody></table></div>
    {selected && <section ref={detailRef} className="meeting-detail" aria-label="Minutes of Meeting details">
      <h4>Minutes of Meeting - {selected.branch_name} - Q{selected.quarter} {selected.year} ({dateLabel(selected.meeting_date)}, {selected.meeting_time.slice(0, 5)})</h4>
      <p>Presiding Officer: {selected.presiding_officer} | Venue / Mode: {selected.venue}</p><p>Attendees: {selected.attendees}</p>
      {agendas.map((title, index) => <div key={title}><h5>Agenda {index + 1} - {title}</h5><p>{selected[`agenda${index + 1}`] || "-"}</p></div>)}
      <div className="meeting-actions"><button type="button" className="portal-primary-btn" disabled={busy} onClick={() => printMeeting(selected)}><PrintIcon fontSize="small" /> Print / Preview Formal Minutes</button><button type="button" className="portal-outline-btn" onClick={() => setSelected(null)}>Close</button></div>
    </section>}
    {preview && <div role="dialog" aria-label="Meeting proof" className="constitution-preview"><button type="button" onClick={() => setPreview(null)}>Close</button>{preview.kind === "photo" ? <img alt="Meeting proof" src={preview.url} style={{ width: "100%", minHeight: 0, flex: 1, objectFit: "contain" }} /> : <iframe title="Signed minutes of meeting" src={preview.url} />}</div>}
  </>;
}
NoticeMeetingsPanel.propTypes = { companyId: PropTypes.string.isRequired, canEdit: PropTypes.bool.isRequired };
