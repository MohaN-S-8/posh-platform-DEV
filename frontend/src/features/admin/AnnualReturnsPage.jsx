import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const currentYear = new Date().getFullYear();
const statusOptions = ["Pending", "Draft", "Submitted"];
const trainingModes = ["In person", "Online", "Hybrid"];

const emptyForm = {
  company_id: "",
  branch_id: "",
  branch_name: "",
  company_name: "",
  year: currentYear,
  return_date: "",
  status: "Pending",
  presiding_officer: "",
  sector_nature: "",
  shift_breakdown: "",
  employees_total: 0,
  employees_male: 0,
  employees_female: 0,
  awareness_attendees: 0,
  complaints_received: 0,
  complaints_disposed: 0,
  complaints_pending_90: 0,
  pending_90_reasons: "",
  workshops_count: 0,
  workshop_period_from: "",
  workshop_period_to: "",
  workshop_details: "",
  action_taken: "",
  ic_constituted_date: "",
  ic_member_change: "NIL",
  orientation_programme_date: "",
  policy_disseminated: "At the time of appointment of employees",
  notice_displayed_from: "",
  wfh_awareness_session_date: "",
  new_joiner_orientation_timing: "Within one month of joining",
  posh_awareness_date: "",
  posh_awareness_mode: "In person",
  posh_awareness_resource_person: "",
  ic_members: [],
  complaint_rows: [],
  training_proof: "",
  annual_return_copy: "",
  acknowledgement_proof: "",
  postal_proof: "",
  registered_post_tracking_number: "",
  covering_from_address: "",
  posh_office_name: "",
  posh_office_address: "",
  posh_office_recipient: "",
};

function asInputDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

function candidateKey(row) {
  return `${row?.company_id || ""}-${row?.branch_id || ""}-${row?.year || ""}`;
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRowForForm(row) {
  return {
    ...emptyForm,
    ...row,
    return_date: asInputDate(row.return_date),
    workshop_period_from: asInputDate(row.workshop_period_from),
    workshop_period_to: asInputDate(row.workshop_period_to),
    ic_constituted_date: asInputDate(row.ic_constituted_date),
    orientation_programme_date: asInputDate(row.orientation_programme_date),
    notice_displayed_from: asInputDate(row.notice_displayed_from),
    wfh_awareness_session_date: asInputDate(row.wfh_awareness_session_date),
    posh_awareness_date: asInputDate(row.posh_awareness_date),
    status: row.status || "Pending",
    ic_members: parseJsonList(row.ic_members_json),
    complaint_rows: parseJsonList(row.complaint_rows_json),
  };
}

function printableHtml(row, cover = false) {
  if (cover) {
    return `
      <h2>Covering Letter - Annual Return ${row.year}</h2>
      <p>From,<br />${row.covering_from_address || row.company_name || "-"}</p>
      <p>To,<br />${row.posh_office_recipient || row.posh_office_address || "The District Officer"}</p>
      <p>Please find enclosed the Annual Return under Section 21(1) / Rule 14 for
      <strong>${row.company_name}</strong>, ${row.branch_name}, for the year ${row.year}.</p>
      <p>Registered Post Tracking No: <strong>${row.registered_post_tracking_number || "-"}</strong></p>
      <p style="margin-top: 48px;">Authorized Signatory</p>
    `;
  }
  return `
    <h2>Annual Return - ${row.branch_name} - ${row.year}</h2>
    <p>Presiding Officer: ${row.presiding_officer || "-"} | Status: ${row.status} | Date: ${formatDate(row.return_date)}</p>
    <h3>(a) Complaints Received</h3><p>${row.complaints_received ?? 0}</p>
    <h3>(b) Complaints Disposed</h3><p>${row.complaints_disposed ?? 0}</p>
    <h3>(c) Cases Pending Beyond 90 Days</h3><p>${row.complaints_pending_90 ?? 0}</p>
    <h3>(d) Workshops / Awareness Programmes Conducted</h3><p>${row.workshops_count ?? 0} - ${row.workshop_details || "-"}</p>
    <h3>(e) Nature of Action Taken</h3><p>${row.action_taken || "-"}</p>
    <h3>POSH Office Recipient</h3><p>${row.posh_office_recipient || row.posh_office_address || "-"}</p>
  `;
}

function printRow(row, cover = false) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>${cover ? "Covering Letter" : "Annual Return"} ${row.year}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1b1642; padding: 32px; line-height: 1.55; }
          h2 { color: #43248a; }
          h3 { color: #43248a; font-size: 14px; margin-bottom: 4px; }
        </style>
      </head>
      <body>${printableHtml(row, cover)}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export function AnnualReturnsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState({ rows: [], summary: {} });
  const [offices, setOffices] = useState([]);
  const [year, setYear] = useState(currentYear);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedRow, setSelectedRow] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canSeePlatform = [1, 2].includes(user?.role_id);

  const loadAnnualReturns = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [annualRes, configRes] = await Promise.allSettled([
        apiClient.get(`/annual-returns/?year=${year}`),
        apiClient.get("/admin-config/"),
      ]);
      if (annualRes.status === "fulfilled") {
        setData(annualRes.value.data || { rows: [], summary: {} });
        setSelectedRow((current) => {
          const rows = annualRes.value.data?.rows || [];
          if (!rows.length) return null;
          return rows.find((row) => candidateKey(row) === candidateKey(current || {})) || rows[0];
        });
      } else {
        throw annualRes.reason;
      }
      if (configRes.status === "fulfilled") {
        setOffices((configRes.value.data?.offices || []).filter((office) => office.is_active));
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load annual returns."));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    const timer = window.setTimeout(loadAnnualReturns, 0);
    return () => window.clearTimeout(timer);
  }, [loadAnnualReturns]);

  const companies = useMemo(() => {
    const map = new Map();
    (data.rows || []).forEach((row) => map.set(row.company_id, row.company_name));
    return [...map.entries()].map(([company_id, company_name]) => ({ company_id, company_name }));
  }, [data.rows]);

  const rowsForCompany = useMemo(
    () =>
      (data.rows || []).filter(
        (row) => selectedCompany === "all" || String(row.company_id) === selectedCompany,
      ),
    [data.rows, selectedCompany],
  );

  const branches = useMemo(() => {
    const map = new Map();
    rowsForCompany.forEach((row) => map.set(row.branch_id, row.branch_name));
    return [...map.entries()].map(([branch_id, branch_name]) => ({ branch_id, branch_name }));
  }, [rowsForCompany]);

  const filteredRows = useMemo(
    () => rowsForCompany.filter((row) => selectedBranch === "all" || row.branch_id === selectedBranch),
    [rowsForCompany, selectedBranch],
  );

  const openForm = (row = null) => {
    const target = row || filteredRows[0] || data.rows[0] || {
      ...emptyForm,
      year,
      company_id: companies[0]?.company_id || user?.company_id || "",
      company_name: companies[0]?.company_name || "",
      branch_id: "HEAD-OFFICE",
      branch_name: companies[0]?.company_name
        ? `${companies[0].company_name} Head Office`
        : "Head Office",
    };
    setForm(normalizeRowForForm(target));
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const updateFormRow = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const changeCompany = (companyId) => {
    const nextRow = (data.rows || []).find((row) => String(row.company_id) === String(companyId));
    if (nextRow) {
      setForm(normalizeRowForForm(nextRow));
      return;
    }
    const nextCompany = companies.find((company) => String(company.company_id) === String(companyId));
    setForm((current) => ({
      ...current,
      company_id: companyId,
      company_name: nextCompany?.company_name || "",
      branch_id: "HEAD-OFFICE",
      branch_name: nextCompany?.company_name
        ? `${nextCompany.company_name} Head Office`
        : "Head Office",
    }));
  };

  const changeBranch = (branchId) => {
    const nextRow = (data.rows || []).find(
      (row) => String(row.company_id) === String(form.company_id) && row.branch_id === branchId,
    );
    if (nextRow) setForm((current) => ({ ...normalizeRowForForm(nextRow), year: current.year }));
  };

  const updateListItem = (listName, index, key, value) => {
    setForm((current) => ({
      ...current,
      [listName]: current[listName].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const addListItem = (listName, item) => {
    setForm((current) => ({ ...current, [listName]: [...current[listName], item] }));
  };

  const deleteListItem = (listName, index) => {
    setForm((current) => ({
      ...current,
      [listName]: current[listName].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateFileName = (field, event) => {
    const file = event.target.files?.[0];
    if (file) updateFormRow(field, file.name);
  };

  const selectOffice = (officeId) => {
    const office = offices.find((item) => String(item.id) === String(officeId));
    if (!office) return;
    setForm((current) => ({
      ...current,
      posh_office_name: office.office_name,
      posh_office_address: office.office_address || "",
      posh_office_recipient: office.office_address || office.office_name,
    }));
  };

  const saveAnnualReturn = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        ...form,
        year: Number(form.year),
        complaints_received: Number(form.complaints_received || 0),
        complaints_disposed: Number(form.complaints_disposed || 0),
        complaints_pending_90: Number(form.complaints_pending_90 || 0),
        workshops_count: Number(form.workshops_count || 0),
        employees_total: Number(form.employees_total || 0),
        employees_male: Number(form.employees_male || 0),
        employees_female: Number(form.employees_female || 0),
        awareness_attendees: Number(form.awareness_attendees || 0),
        return_date: form.return_date || null,
        workshop_period_from: form.workshop_period_from || null,
        workshop_period_to: form.workshop_period_to || null,
        ic_constituted_date: form.ic_constituted_date || null,
        orientation_programme_date: form.orientation_programme_date || null,
        notice_displayed_from: form.notice_displayed_from || null,
        wfh_awareness_session_date: form.wfh_awareness_session_date || null,
        posh_awareness_date: form.posh_awareness_date || null,
        ic_members_json: JSON.stringify(form.ic_members),
        complaint_rows_json: JSON.stringify(form.complaint_rows),
      };
      delete payload.company_name;
      delete payload.company_code;
      delete payload.annual_return_id;
      delete payload.completed_training_users;
      delete payload.ic_members;
      delete payload.complaint_rows;

      const res = await apiClient.put("/annual-returns/", payload);
      setSelectedRow(res.data);
      setShowForm(false);
      setSuccess("Annual return saved.");
      await loadAnnualReturns();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to save annual return."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell
      title="Annual Returns"
      subtitle="Statutory Annual Return under Section 21(1) / Rule 14 - one per branch, per year."
    >
      <section style={infoStyle}>
        <strong>About this format</strong>
        <p>
          This form is aligned to the Annual Return format actually filed with
          the District Nodal Officer. It records workforce details, Section 21 /
          Rule 14 complaint statistics, IC initiatives, proof documents, and the
          covering-letter address for printing.
        </p>
      </section>

      <section style={actionBarStyle}>
        <div>
          <strong>Create / Edit Annual Return</strong>
          <p>One Annual Return per branch, per year - filed with that branch&apos;s District Officer by 31 January.</p>
        </div>
        <button type="button" onClick={() => openForm()} style={primaryButtonStyle}>
          + New Annual Return
        </button>
      </section>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      {showForm && (
        <AnnualReturnForm
          form={form}
          companies={companies}
          branches={
            (data.rows || []).filter((row) => String(row.company_id) === String(form.company_id))
              .length
              ? (data.rows || []).filter((row) => String(row.company_id) === String(form.company_id))
              : [{ branch_id: form.branch_id || "HEAD-OFFICE", branch_name: form.branch_name || "Head Office" }]
          }
          offices={offices}
          canSeePlatform={canSeePlatform}
          saving={saving}
          onSubmit={saveAnnualReturn}
          onClose={() => setShowForm(false)}
          onChange={updateFormRow}
          onCompanyChange={changeCompany}
          onBranchChange={changeBranch}
          onSelectOffice={selectOffice}
          onFileChange={updateFileName}
          onAddListItem={addListItem}
          onDeleteListItem={deleteListItem}
          onUpdateListItem={updateListItem}
        />
      )}

      <AnnualReturnStatus
        rows={filteredRows}
        companies={companies}
        branches={branches}
        selectedCompany={selectedCompany}
        selectedBranch={selectedBranch}
        year={year}
        canSeePlatform={canSeePlatform}
        onCompanyChange={(value) => {
          setSelectedCompany(value);
          setSelectedBranch("all");
        }}
        onBranchChange={setSelectedBranch}
        onYearChange={setYear}
        onView={setSelectedRow}
        onEdit={openForm}
      />

      {selectedRow && (
        <section style={panelStyle}>
          <h3 style={panelTitleStyle}>Annual Return - {selectedRow.branch_name} - {selectedRow.year}</h3>
          <p>Presiding Officer: {selectedRow.presiding_officer || "-"} | Status: {selectedRow.status} | Date: {formatDate(selectedRow.return_date)}</p>
          <Detail label="(a) Complaints Received" value={selectedRow.complaints_received} />
          <Detail label="(b) Complaints Disposed" value={selectedRow.complaints_disposed} />
          <Detail label="(c) Cases Pending Beyond 90 Days" value={selectedRow.complaints_pending_90} />
          <Detail label="(d) Workshops / Awareness Programmes Conducted" value={`${selectedRow.workshops_count ?? 0} - ${selectedRow.workshop_details || "-"}`} />
          <Detail label="(e) Nature of Action Taken" value={selectedRow.action_taken || "-"} />
          <Detail label="POSH Office Recipient" value={selectedRow.posh_office_recipient || selectedRow.posh_office_address || "Office of the District Officer"} />
          <div style={buttonRowStyle}>
            <button type="button" onClick={() => printRow(selectedRow)} style={primaryButtonStyle}><PrintIcon fontSize="small" /> Print Annual Return</button>
            <button type="button" onClick={() => printRow(selectedRow, true)} style={primaryButtonStyle}><PrintIcon fontSize="small" /> Print Covering Letter</button>
            <button type="button" onClick={() => setSelectedRow(null)} style={secondaryButtonStyle}>Close</button>
          </div>
        </section>
      )}

      <LoadingOverlay show={loading || saving} title={saving ? "Saving annual return" : "Loading annual returns"} message="Fetching branch and statutory return status." />
    </PortalShell>
  );
}

function AnnualReturnForm({
  form,
  companies,
  branches,
  offices,
  canSeePlatform,
  saving,
  onSubmit,
  onClose,
  onChange,
  onCompanyChange,
  onBranchChange,
  onSelectOffice,
  onFileChange,
  onAddListItem,
  onDeleteListItem,
  onUpdateListItem,
}) {
  return (
    <form onSubmit={onSubmit} style={panelStyle}>
      <div style={formHeaderStyle}>
        <div>
          <h3 style={panelTitleStyle}>Create / Edit Annual Return</h3>
          <p style={mutedStyle}>One Annual Return per branch, per year.</p>
        </div>
        <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
      </div>

      <div style={gridStyle}>
        {canSeePlatform ? (
          <label style={labelStyle}>
            Company Name
            <select value={form.company_id} onChange={(event) => onCompanyChange(event.target.value)} style={inputStyle} required>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>{company.company_name}</option>
              ))}
            </select>
          </label>
        ) : (
          <TextInput label="Company Name" value={form.company_name} readOnly />
        )}
        <label style={labelStyle}>
          Branch Name
          <select value={form.branch_id} onChange={(event) => onBranchChange(event.target.value)} style={inputStyle} required>
            {branches.map((branch) => (
              <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
            ))}
          </select>
        </label>
        <TextInput label="Year" type="number" value={form.year} onChange={(value) => onChange("year", value)} />
        <TextInput label="Date (dd/mm/yyyy)" type="date" value={form.return_date} onChange={(value) => onChange("return_date", value)} />
        <label style={labelStyle}>
          Status
          <select value={form.status} onChange={(event) => onChange("status", event.target.value)} style={inputStyle}>
            {statusOptions.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <TextInput label="Presiding Officer Name" value={form.presiding_officer} onChange={(value) => onChange("presiding_officer", value)} />
      </div>

      <SectionTitle>Organisation & Workforce Details</SectionTitle>
      <TextInput label="Sector / Nature of Business" value={form.sector_nature} onChange={(value) => onChange("sector_nature", value)} placeholder="e.g. Information Technology / IT-Enabled Services" />
      <TextArea label="Shift Breakdown" value={form.shift_breakdown} onChange={(value) => onChange("shift_breakdown", value)} placeholder="e.g. General Shift for all employees; Work-From-Home roster for X employees" />
      <div style={gridStyle}>
        <TextInput label="Employees Working - Total" type="number" value={form.employees_total} onChange={(value) => onChange("employees_total", value)} />
        <TextInput label="Employees Working - Male" type="number" value={form.employees_male} onChange={(value) => onChange("employees_male", value)} />
        <TextInput label="Employees Working - Female" type="number" value={form.employees_female} onChange={(value) => onChange("employees_female", value)} />
        <TextInput label="Employees Attended Awareness Sessions" type="number" value={form.awareness_attendees} onChange={(value) => onChange("awareness_attendees", value)} />
      </div>

      <SectionTitle>Particulars Under Section 21 / Rule 14</SectionTitle>
      <div style={gridStyle}>
        <TextInput label="(a) Complaints Received" type="number" value={form.complaints_received} onChange={(value) => onChange("complaints_received", value)} />
        <TextInput label="(b) Complaints Disposed" type="number" value={form.complaints_disposed} onChange={(value) => onChange("complaints_disposed", value)} />
        <TextInput label="(c) Cases Pending Beyond 90 Days" type="number" value={form.complaints_pending_90} onChange={(value) => onChange("complaints_pending_90", value)} />
      </div>
      <TextArea label="Reasons for Cases Pending Beyond 90 Days (if any)" value={form.pending_90_reasons} onChange={(value) => onChange("pending_90_reasons", value)} />
      <div style={gridStyle}>
        <TextInput label="(d) Number of Workshops / Awareness Programmes Conducted" type="number" value={form.workshops_count} onChange={(value) => onChange("workshops_count", value)} />
        <TextInput label="Period From" type="date" value={form.workshop_period_from} onChange={(value) => onChange("workshop_period_from", value)} />
        <TextInput label="Period To" type="date" value={form.workshop_period_to} onChange={(value) => onChange("workshop_period_to", value)} />
      </div>
      <TextArea label="Details of Workshops / Awareness Programmes" value={form.workshop_details} onChange={(value) => onChange("workshop_details", value)} />
      <TextArea label="(e) Nature of Action Taken by Employer / District Officer" value={form.action_taken} onChange={(value) => onChange("action_taken", value)} />

      <SectionTitle>Initiatives Taken During The Year</SectionTitle>
      <div style={gridStyle}>
        <TextInput label="(a) Date IC was Constituted" type="date" value={form.ic_constituted_date} onChange={(value) => onChange("ic_constituted_date", value)} />
        <TextInput label="(b) Change in IC Members (date, or NIL)" value={form.ic_member_change} onChange={(value) => onChange("ic_member_change", value)} />
        <TextInput label="(c) Orientation Programme Date" type="date" value={form.orientation_programme_date} onChange={(value) => onChange("orientation_programme_date", value)} />
        <TextInput label="(d) Anti-Sexual Harassment Policy Disseminated" value={form.policy_disseminated} onChange={(value) => onChange("policy_disseminated", value)} />
        <TextInput label="(e) Notice of Constitution Displayed From" type="date" value={form.notice_displayed_from} onChange={(value) => onChange("notice_displayed_from", value)} />
        <TextInput label="(f) Work-From-Home Awareness Session Date" type="date" value={form.wfh_awareness_session_date} onChange={(value) => onChange("wfh_awareness_session_date", value)} />
        <TextInput label="(g) New Joiner Orientation Timing" value={form.new_joiner_orientation_timing} onChange={(value) => onChange("new_joiner_orientation_timing", value)} />
      </div>

      <SectionTitle>(h) POSH Awareness Programme</SectionTitle>
      <div style={gridStyle}>
        <TextInput label="Date" type="date" value={form.posh_awareness_date} onChange={(value) => onChange("posh_awareness_date", value)} />
        <label style={labelStyle}>
          Mode of Training
          <select value={form.posh_awareness_mode} onChange={(event) => onChange("posh_awareness_mode", event.target.value)} style={inputStyle}>
            {trainingModes.map((mode) => <option key={mode}>{mode}</option>)}
          </select>
        </label>
        <TextInput label="Resource Person" value={form.posh_awareness_resource_person} onChange={(value) => onChange("posh_awareness_resource_person", value)} placeholder="e.g. Bavani Sivam" />
      </div>

      <EditableList
        title="Internal Committee Members (as on report date)"
        emptyText="No IC members added yet."
        rows={form.ic_members}
        fields={[
          ["name", "Name"],
          ["designation", "Designation"],
          ["email", "Email"],
        ]}
        onAdd={() => onAddListItem("ic_members", { name: "", designation: "", email: "" })}
        onDelete={(index) => onDeleteListItem("ic_members", index)}
        onUpdate={(index, key, value) => onUpdateListItem("ic_members", index, key, value)}
      />

      <EditableList
        title="Summary of Action Taken on Complaints"
        emptyText="No complaints on record for this year - table will print as NIL."
        rows={form.complaint_rows}
        fields={[
          ["case_no", "Case No"],
          ["summary", "Summary"],
          ["action", "Action Taken"],
        ]}
        onAdd={() => onAddListItem("complaint_rows", { case_no: "", summary: "", action: "" })}
        onDelete={(index) => onDeleteListItem("complaint_rows", index)}
        onUpdate={(index, key, value) => onUpdateListItem("complaint_rows", index, key, value)}
      />

      <SectionTitle>Supporting Documents</SectionTitle>
      <div style={gridStyle}>
        <FileInput label="Proof of Training / Awareness Programmes" value={form.training_proof} onChange={(event) => onFileChange("training_proof", event)} />
        <FileInput label="Annual Return (signed copy with seal & signature)" value={form.annual_return_copy} onChange={(event) => onFileChange("annual_return_copy", event)} />
        <FileInput label="Acknowledgement Proof (District Officer sign & seal)" value={form.acknowledgement_proof} onChange={(event) => onFileChange("acknowledgement_proof", event)} />
        <FileInput label="Registered Post Receipt (if sent by post)" value={form.postal_proof} onChange={(event) => onFileChange("postal_proof", event)} />
      </div>
      <TextInput label="Registered Post Tracking Number" value={form.registered_post_tracking_number} onChange={(value) => onChange("registered_post_tracking_number", value)} placeholder="e.g. RRxxxxxxxxIN" />

      <SectionTitle>Covering Letter - From / To Address</SectionTitle>
      <TextArea label="From Address (Presiding Officer / Branch Office)" value={form.covering_from_address} onChange={(value) => onChange("covering_from_address", value)} placeholder="Auto-fills from the selected branch - edit if needed" />
      <div style={gridStyle}>
        <label style={labelStyle}>
          POSH Office
          <select value={form.posh_office_name} onChange={(event) => onSelectOffice(event.target.value)} style={inputStyle}>
            <option value="">Select POSH Office</option>
            {offices.map((office) => <option key={office.id} value={office.id}>{office.office_name}</option>)}
          </select>
        </label>
        <TextArea label="POSH Office Address (editable)" value={form.posh_office_address} onChange={(value) => onChange("posh_office_address", value)} placeholder="Auto-fills from the office selected - edit as needed" />
      </div>

      <div style={buttonRowStyle}>
        <button type="submit" disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving..." : "Save Annual Return"}
        </button>
        <button type="button" onClick={onClose} style={secondaryButtonStyle}>Cancel</button>
      </div>
    </form>
  );
}

function AnnualReturnStatus({
  rows,
  companies,
  branches,
  selectedCompany,
  selectedBranch,
  year,
  canSeePlatform,
  onCompanyChange,
  onBranchChange,
  onYearChange,
  onView,
  onEdit,
}) {
  return (
    <section style={panelStyle}>
      <div className="portal-section-title" style={{ marginTop: 0 }}>Annual Return Status</div>
      <div style={filterGridStyle}>
        {canSeePlatform && (
          <label style={labelStyle}>
            Select Company
            <select value={selectedCompany} onChange={(event) => onCompanyChange(event.target.value)} style={inputStyle}>
              <option value="all">All Companies</option>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>{company.company_name}</option>
              ))}
            </select>
          </label>
        )}
        <label style={labelStyle}>
          Select Branch
          <select value={selectedBranch} onChange={(event) => onBranchChange(event.target.value)} style={inputStyle}>
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Select Year
          <select value={year} onChange={(event) => onYearChange(Number(event.target.value))} style={inputStyle}>
            {[currentYear, currentYear - 1, currentYear - 2].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={tableWrapStyle}>
        <table className="portal-table" style={{ minWidth: "1060px" }}>
          <thead>
            <tr>
              {["Branch", "Year", "Date", "Status", "Complaints R/D/P >90", "Workshops", "AR Copy", "Ack.", "Training Proof", "Postal Proof", "Actions"].map((heading) => <th key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={candidateKey(row)}>
                <td>{row.branch_name}</td>
                <td>{row.year}</td>
                <td>{formatDate(row.return_date)}</td>
                <td><span className={`portal-badge ${row.status === "Submitted" ? "portal-badge-green" : "portal-badge-red"}`}>{row.status}</span></td>
                <td>{row.complaints_received ?? 0} / {row.complaints_disposed ?? 0} / {row.complaints_pending_90 ?? 0}</td>
                <td>{row.workshops_count ?? 0}</td>
                <td>{row.annual_return_copy || (row.annual_return_id ? "Ready" : "-")}</td>
                <td>{row.acknowledgement_proof || "-"}</td>
                <td>{row.training_proof || "-"}</td>
                <td>{row.postal_proof || "-"}</td>
                <td>
                  <div style={actionButtonsStyle}>
                    <button type="button" onClick={() => onView(row)} style={linkButtonStyle}><VisibilityIcon fontSize="small" /> View</button>
                    <button type="button" onClick={() => onEdit(row)} style={linkButtonStyle}>Edit</button>
                    <button type="button" onClick={() => printRow(row)} style={linkButtonStyle}><PrintIcon fontSize="small" /> Print AR</button>
                    <button type="button" onClick={() => printRow(row, true)} style={linkButtonStyle}>Cover Letter</button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={11} style={{ padding: "28px", color: "#64748b" }}>No annual return rows available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditableList({ title, emptyText, rows, fields, onAdd, onDelete, onUpdate }) {
  return (
    <section style={{ marginTop: "20px" }}>
      <SectionTitle>{title}</SectionTitle>
      {!rows.length && <p style={mutedStyle}>{emptyText}</p>}
      {rows.map((row, index) => (
        <div key={`${title}-${index}`} style={listRowStyle}>
          {fields.map(([key, label]) => (
            <input
              key={key}
              value={row[key] || ""}
              onChange={(event) => onUpdate(index, key, event.target.value)}
              placeholder={label}
              style={inputStyle}
            />
          ))}
          <button type="button" onClick={() => onDelete(index)} style={linkButtonStyle}>Delete</button>
        </div>
      ))}
      <button type="button" onClick={onAdd} style={secondaryButtonStyle}>+ Add Row</button>
    </section>
  );
}

function FileInput({ label, value, onChange }) {
  return (
    <label style={labelStyle}>
      {label}
      <input type="file" onChange={onChange} style={inputStyle} />
      {value && <span style={mutedStyle}>{value}</span>}
    </label>
  );
}

function TextInput({ label, value, onChange, type = "text", readOnly = false, placeholder = "" }) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        style={{ ...inputStyle, background: readOnly ? "#f7f3ff" : "white" }}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder = "" }) {
  return (
    <label style={{ ...labelStyle, marginBottom: "12px" }}>
      {label}
      <textarea
        value={value || ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={textareaStyle}
      />
    </label>
  );
}

function SectionTitle({ children }) {
  return <div style={sectionTitleStyle}>{children}</div>;
}

function Detail({ label, value }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <strong style={{ color: "var(--portal-purple)" }}>{label}</strong>
      <p style={{ margin: "4px 0 0", color: "#475569" }}>{value ?? 0}</p>
    </div>
  );
}

AnnualReturnForm.propTypes = {
  form: PropTypes.object.isRequired,
  companies: PropTypes.array.isRequired,
  branches: PropTypes.array.isRequired,
  offices: PropTypes.array.isRequired,
  canSeePlatform: PropTypes.bool.isRequired,
  saving: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onCompanyChange: PropTypes.func.isRequired,
  onBranchChange: PropTypes.func.isRequired,
  onSelectOffice: PropTypes.func.isRequired,
  onFileChange: PropTypes.func.isRequired,
  onAddListItem: PropTypes.func.isRequired,
  onDeleteListItem: PropTypes.func.isRequired,
  onUpdateListItem: PropTypes.func.isRequired,
};

AnnualReturnStatus.propTypes = {
  rows: PropTypes.array.isRequired,
  companies: PropTypes.array.isRequired,
  branches: PropTypes.array.isRequired,
  selectedCompany: PropTypes.string.isRequired,
  selectedBranch: PropTypes.string.isRequired,
  year: PropTypes.number.isRequired,
  canSeePlatform: PropTypes.bool.isRequired,
  onCompanyChange: PropTypes.func.isRequired,
  onBranchChange: PropTypes.func.isRequired,
  onYearChange: PropTypes.func.isRequired,
  onView: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
};

EditableList.propTypes = {
  title: PropTypes.string.isRequired,
  emptyText: PropTypes.string.isRequired,
  rows: PropTypes.array.isRequired,
  fields: PropTypes.array.isRequired,
  onAdd: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

FileInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

FileInput.defaultProps = {
  value: "",
};

TextInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  type: PropTypes.string,
  readOnly: PropTypes.bool,
  placeholder: PropTypes.string,
};

TextInput.defaultProps = {
  value: "",
  onChange: undefined,
  type: "text",
  readOnly: false,
  placeholder: "",
};

TextArea.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

TextArea.defaultProps = {
  value: "",
  placeholder: "",
};

SectionTitle.propTypes = {
  children: PropTypes.node.isRequired,
};

Detail.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

Detail.defaultProps = {
  value: "",
};

const infoStyle = {
  background: "#f4ebff",
  border: "1px solid #d8c6ff",
  borderRadius: "8px",
  padding: "14px",
  marginBottom: "12px",
  color: "#33215f",
};

const actionBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "center",
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "14px",
  marginBottom: "18px",
};

const panelStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "18px",
};

const formHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  borderBottom: "1px solid var(--portal-border)",
  paddingBottom: "14px",
  marginBottom: "14px",
};

const panelTitleStyle = { margin: "0 0 8px", color: "var(--portal-purple)" };
const sectionTitleStyle = {
  margin: "22px 0 12px",
  color: "var(--portal-purple)",
  fontWeight: 800,
  fontSize: "12px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const mutedStyle = { margin: 0, color: "var(--portal-muted)", fontSize: "13px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" };
const filterGridStyle = { ...gridStyle, marginBottom: "12px" };
const labelStyle = { display: "grid", gap: "6px", color: "var(--portal-purple)", fontWeight: 700, fontSize: "13px" };
const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid var(--portal-border)", borderRadius: "8px", boxSizing: "border-box" };
const textareaStyle = { ...inputStyle, minHeight: "82px", resize: "vertical" };
const buttonRowStyle = { display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" };
const primaryButtonStyle = { padding: "10px 14px", background: "var(--portal-pink)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, display: "inline-flex", gap: "6px", alignItems: "center" };
const secondaryButtonStyle = { padding: "10px 14px", background: "#fff", color: "var(--portal-purple)", border: "1px solid #ddcbf3", borderRadius: "8px", cursor: "pointer", fontWeight: 700 };
const tableWrapStyle = { overflowX: "auto" };
const actionButtonsStyle = { display: "grid", gap: "4px", justifyItems: "start" };
const linkButtonStyle = { border: "none", background: "transparent", color: "var(--portal-purple)", fontWeight: 700, cursor: "pointer", display: "inline-flex", gap: "4px", alignItems: "center", padding: 0 };
const listRowStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) auto", gap: "8px", alignItems: "center", marginBottom: "8px" };
const errorStyle = { background: "#fff7f6", border: "1px solid #f3b4ae", borderRadius: "8px", color: "#c0392b", padding: "12px 14px", marginBottom: "18px" };
const successStyle = { background: "#f0fff6", border: "1px solid #b7ebc9", borderRadius: "8px", color: "#1f7a4d", padding: "12px 14px", marginBottom: "18px" };
