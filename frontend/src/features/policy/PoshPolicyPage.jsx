import ChatIcon from "@mui/icons-material/Chat";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import HandshakeIcon from "@mui/icons-material/Handshake";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import PolicyIcon from "@mui/icons-material/Policy";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useEffect, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";
import { useAuthStore } from "../../store/authStore";

const defaultPolicy = {
  title: "Prevention, prohibition, and redressal at work.",
  overview:
    "This policy protects women employees against sexual harassment at the workplace and sets out mechanisms for prevention, prohibition, and redressal in line with the Sexual Harassment of Women at Workplace Act, 2013.",
  version: "3.2",
  approved_date: "04 Jan 2026",
  harassment_types: [
    {
      title: "Physical",
      text: "Unwelcome touching, patting, hugging, physical contact, or physical advances.",
    },
    {
      title: "Verbal",
      text: "Sexual remarks, jokes, comments on appearance, or requests for favours.",
    },
    {
      title: "Non-Verbal",
      text: "Staring, suggestive gestures, or displaying explicit material.",
    },
    {
      title: "Digital",
      text: "Sexually explicit messages, emails, images, or online communication.",
    },
  ],
  committee_members: [
    {
      role: "Presiding Officer",
      name: "Gomathi Subramaniam",
      detail: "Senior Manager - IC, Chennai HQ",
    },
    {
      role: "Member",
      name: "Priya Raman",
      detail: "IC Business Partner, Chennai HQ",
    },
    {
      role: "Member",
      name: "Arjun Mehta",
      detail: "Legal Counsel, Chennai HQ",
    },
    {
      role: "External Member",
      name: "Kavitha Reddy",
      detail: "Sakhi Foundation",
    },
  ],
  rights: [
    "Right to a safe workplace",
    "Right to file a complaint in confidence",
    "Protection from retaliation",
    "Identity of parties kept confidential under Section 16",
  ],
  faqs: [
    {
      question: "Who can file a complaint?",
      answer:
        "Any woman employee, including contractors, interns and visitors, who has experienced sexual harassment at the workplace.",
    },
    {
      question: "Can a man file a complaint?",
      answer:
        "The PoSH Act specifically protects women; all employees can escalate other workplace misconduct through IC's general grievance channel.",
    },
    {
      question: "What if the respondent is a senior leader?",
      answer:
        "The Internal Committee process applies equally regardless of seniority, including to the employer.",
    },
  ],
};

const harassmentIcons = {
  Physical: <HandshakeIcon />,
  Verbal: <ChatIcon />,
  "Non-Verbal": <VisibilityIcon />,
  Digital: <PhoneAndroidIcon />,
};

const editHints = {
  harassment_types: "One per line: Title | Description",
  committee_members: "One per line: Role | Name | Designation / branch",
  rights: "One right per line",
  faqs: "One per line: Question | Answer",
};

function policyToForm(policy) {
  return {
    title: policy.title || "",
    overview: policy.overview || "",
    version: policy.version || "",
    approved_date: policy.approved_date || "",
    harassment_types: (policy.harassment_types || [])
      .map((item) => `${item.title} | ${item.text}`)
      .join("\n"),
    committee_members: (policy.committee_members || [])
      .map((item) => `${item.role} | ${item.name} | ${item.detail}`)
      .join("\n"),
    rights: (policy.rights || []).join("\n"),
    faqs: (policy.faqs || [])
      .map((item) => `${item.question} | ${item.answer}`)
      .join("\n"),
  };
}

function parseLines(value, mapper) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(mapper);
}

function formToPolicy(form) {
  return {
    title: form.title.trim(),
    overview: form.overview.trim(),
    version: form.version.trim(),
    approved_date: form.approved_date.trim(),
    harassment_types: parseLines(form.harassment_types, (line) => {
      const [title = "", text = ""] = line
        .split("|")
        .map((part) => part.trim());
      return { title, text };
    }).filter((item) => item.title && item.text),
    committee_members: parseLines(form.committee_members, (line) => {
      const [role = "", name = "", detail = ""] = line
        .split("|")
        .map((part) => part.trim());
      return { role, name, detail };
    }).filter((item) => item.role && item.name && item.detail),
    rights: parseLines(form.rights, (line) => line),
    faqs: parseLines(form.faqs, (line) => {
      const [question = "", answer = ""] = line
        .split("|")
        .map((part) => part.trim());
      return { question, answer };
    }).filter((item) => item.question && item.answer),
  };
}

export function PoshPolicyPage() {
  const { user } = useAuthStore();
  const [openFaq, setOpenFaq] = useState(0);
  const [policy, setPolicy] = useState(defaultPolicy);
  const [form, setForm] = useState(policyToForm(defaultPolicy));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [acknowledgements, setAcknowledgements] = useState([]);
  const canEdit =
    user?.role_id === 1 || user?.role_id === 2 || user?.role_id === 5;
  const canViewAcknowledgements = user?.role_id === 1 || user?.role_id === 2;
  const canAcknowledge = !canEdit;

  useEffect(() => {
    let active = true;
    const loadPolicy = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/policy/");
        const nextPolicy = { ...defaultPolicy, ...(res.data || {}) };
        if (active) {
          setPolicy(nextPolicy);
          setForm(policyToForm(nextPolicy));
        }
      } catch (err) {
        if (active) {
          setError(
            apiErrorMessage(
              err,
              "Unable to load saved policy. Showing default policy.",
            ),
          );
          setForm(policyToForm(defaultPolicy));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadPolicy();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canViewAcknowledgements) return undefined;
    let active = true;
    const loadAcknowledgements = async () => {
      try {
        const res = await apiClient.get("/policy/acknowledgements");
        if (active) setAcknowledgements(res.data || []);
      } catch {
        if (active) setAcknowledgements([]);
      }
    };
    loadAcknowledgements();
    return () => {
      active = false;
    };
  }, [canViewAcknowledgements]);

  const savePolicy = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = formToPolicy(form);
      const res = await apiClient.put("/policy/", payload);
      const nextPolicy = { ...defaultPolicy, ...(res.data || payload) };
      setPolicy(nextPolicy);
      setForm(policyToForm(nextPolicy));
      setEditing(false);
      setMessage("Policy details saved permanently.");
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to save policy details."));
    } finally {
      setSaving(false);
    }
  };

  const uploadDocument = async (file) => {
    if (!file) return;
    setUploadingDoc(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post("/policy/document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const nextPolicy = { ...defaultPolicy, ...(res.data || {}) };
      setPolicy(nextPolicy);
      setForm(policyToForm(nextPolicy));
      setMessage("Policy document uploaded permanently.");
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to upload policy document."));
    } finally {
      setUploadingDoc(false);
    }
  };

  const downloadDocument = async () => {
    setDownloadingDoc(true);
    setError("");
    try {
      const res = await apiClient.get("/policy/document/download");
      window.open(res.data.download_url, "_blank");
    } catch (err) {
      setError(
        apiErrorMessage(err, "Policy document has not been uploaded yet."),
      );
    } finally {
      setDownloadingDoc(false);
    }
  };

  const acknowledgePolicy = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiClient.post("/policy/acknowledge");
      setPolicy((current) => ({ ...current, acknowledged: true }));
      setMessage("Policy acknowledged. Your training is now available.");
      window.dispatchEvent(new Event("posh-policy-acknowledged"));
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to acknowledge policy."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell
      title="PoSH Policy"
      subtitle="The rules, in plain language, and on record."
    >
      {error && <div className="portal-card portal-home-error">{error}</div>}
      {message && (
        <div className="portal-panel-success" style={{ marginBottom: "18px" }}>
          {message}
        </div>
      )}

      {canEdit && (
        <div className="portal-policy-editbar">
          <div>
            <strong>
              {user?.role_id === 1
                ? "Global policy editor"
                : "Company policy editor"}
            </strong>
            <span>Saved changes are shown to users permanently.</span>
          </div>
          <button
            type="button"
            className={editing ? "portal-outline-btn" : "portal-primary-btn"}
            onClick={() => {
              setEditing((current) => !current);
              setMessage("");
              setError("");
            }}
          >
            {editing ? "Cancel Edit" : "Edit Policy"}
          </button>
        </div>
      )}

      {canEdit && editing && (
        <form
          className="portal-card portal-policy-editor"
          onSubmit={savePolicy}
        >
          <div className="portal-section-title" style={{ marginTop: 0 }}>
            Edit Policy Details
          </div>
          <label>
            Policy Title
            <input
              className="portal-action-input"
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>
          <label>
            Overview
            <textarea
              className="portal-action-input"
              rows={4}
              value={form.overview}
              onChange={(event) =>
                setForm({ ...form, overview: event.target.value })
              }
            />
          </label>
          <div className="portal-grid-2 portal-policy-form-grid">
            <label>
              Version
              <input
                className="portal-action-input"
                value={form.version}
                onChange={(event) =>
                  setForm({ ...form, version: event.target.value })
                }
              />
            </label>
            <label>
              Board Approved Date
              <input
                className="portal-action-input"
                value={form.approved_date}
                onChange={(event) =>
                  setForm({ ...form, approved_date: event.target.value })
                }
              />
            </label>
          </div>
          {["harassment_types", "committee_members", "rights", "faqs"].map(
            (field) => (
              <label key={field}>
                {field.replaceAll("_", " ")}
                <small>{editHints[field]}</small>
                <textarea
                  className="portal-action-input"
                  rows={field === "faqs" ? 5 : 4}
                  value={form[field]}
                  onChange={(event) =>
                    setForm({ ...form, [field]: event.target.value })
                  }
                />
              </label>
            ),
          )}
          <div className="portal-modal-actions">
            <button
              type="button"
              className="portal-outline-btn"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="portal-primary-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Permanently"}
            </button>
          </div>
        </form>
      )}

      <section className="portal-policy-hero">
        <div>
          <div className="portal-home-eyebrow">Policy Overview</div>
          <h2>{policy.title}</h2>
          <p>{policy.overview}</p>
        </div>
        <div className="portal-home-shield">
          <PolicyIcon />
          <span>POLICY</span>
        </div>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <div className="portal-section-title">
          What Counts As Sexual Harassment?
        </div>
        <div className="portal-grid-4 portal-policy-card-grid">
          {policy.harassment_types.map((type) => (
            <article
              className="portal-card portal-policy-type"
              key={type.title}
            >
              <span>{harassmentIcons[type.title] || <PolicyIcon />}</span>
              <h3>{type.title}</h3>
              <p>{type.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <div className="portal-section-title">
          Internal Committee Composition
        </div>
        <div className="portal-grid-4 portal-policy-card-grid">
          {policy.committee_members.map((member) => (
            <article
              className="portal-card"
              key={`${member.role}-${member.name}`}
            >
              <span className="portal-badge portal-badge-purple">
                {member.role}
              </span>
              <h3 style={{ marginTop: "10px" }}>{member.name}</h3>
              <p>{member.detail}</p>
            </article>
          ))}
        </div>
        <p className="portal-policy-note">
          Committees may vary by branch. Use the company or IC records to
          confirm the Internal Committee applicable to your location.
        </p>
      </section>

      <section className="portal-grid-2 portal-policy-two-col">
        <article className="portal-card">
          <div className="portal-section-title" style={{ marginTop: 0 }}>
            Your Rights & Confidentiality
          </div>
          <div className="portal-policy-rights">
            {policy.rights.map((right) => (
              <div key={right}>
                <CheckCircleIcon fontSize="small" />
                <span>{right}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="portal-card">
          <div className="portal-section-title" style={{ marginTop: 0 }}>
            Policy Document
          </div>
          <h3>Version {policy.version}</h3>
          <p style={{ marginBottom: "14px" }}>
            Board-approved {policy.approved_date}
          </p>
          {policy.document_name && (
            <p style={{ marginBottom: "14px" }}>
              Uploaded file: {policy.document_name}
            </p>
          )}
          <div className="portal-policy-document-actions">
            <button
              type="button"
              className="portal-primary-btn"
              onClick={downloadDocument}
              disabled={downloadingDoc}
            >
              <DownloadIcon fontSize="small" />
              {downloadingDoc ? "Opening..." : "Download Policy PDF"}
            </button>
            {canEdit && (
              <label className="portal-outline-btn portal-policy-upload-btn">
                {uploadingDoc
                  ? "Uploading..."
                  : policy.document_path
                    ? "Replace PDF"
                    : "Upload PDF"}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={uploadingDoc}
                  onChange={(event) => uploadDocument(event.target.files?.[0])}
                />
              </label>
            )}
          </div>
          {!policy.document_path && (
            <p style={{ marginTop: "10px" }}>No policy PDF uploaded yet.</p>
          )}
        </article>
      </section>

      {canAcknowledge && (
        <section className="portal-card portal-policy-ack">
          <div>
            <strong>
              {policy.acknowledged
                ? "Policy acknowledged"
                : "Acknowledge PoSH Policy"}
            </strong>
            <p>
              {policy.acknowledged
                ? "Your acknowledgement is recorded for this policy version."
                : "You must acknowledge this policy before employee training is available."}
            </p>
          </div>
          <button
            type="button"
            className={
              policy.acknowledged ? "portal-outline-btn" : "portal-primary-btn"
            }
            disabled={saving || policy.acknowledged}
            onClick={acknowledgePolicy}
          >
            <CheckCircleIcon fontSize="small" />
            {policy.acknowledged ? "Acknowledged" : "I Acknowledge"}
          </button>
        </section>
      )}

      {canViewAcknowledgements && (
        <section style={{ marginBottom: "24px" }}>
          <div className="portal-section-title">Policy Acknowledgements</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {[
                    "Employee",
                    "Email",
                    "Company",
                    "Version",
                    "Acknowledged At",
                  ].map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acknowledgements.map((row) => (
                  <tr
                    key={`${row.user_id}-${row.policy_id}-${row.policy_version}`}
                    style={trStyle}
                  >
                    <td style={tdStyle}>
                      {row.full_name || row.employee_id || "-"}
                    </td>
                    <td style={tdStyle}>{row.email}</td>
                    <td style={tdStyle}>{row.company_name || "Global"}</td>
                    <td style={tdStyle}>{row.policy_version || "-"}</td>
                    <td style={tdStyle}>
                      {row.acknowledged_at
                        ? new Date(row.acknowledged_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
                {!acknowledgements.length && (
                  <tr style={trStyle}>
                    <td
                      colSpan={5}
                      style={{
                        ...tdStyle,
                        textAlign: "center",
                        color: "var(--portal-muted)",
                      }}
                    >
                      No acknowledgements recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <div className="portal-section-title">Frequently Asked Questions</div>
        <div className="portal-policy-faq-list">
          {policy.faqs.map((faq, index) => (
            <article className="portal-policy-faq" key={faq.question}>
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
              >
                <span>{faq.question}</span>
                <strong>{openFaq === index ? "-" : "+"}</strong>
              </button>
              {openFaq === index && <p>{faq.answer}</p>}
            </article>
          ))}
        </div>
      </section>

      <LoadingOverlay
        show={loading || saving || uploadingDoc}
        title={
          saving
            ? "Saving policy"
            : uploadingDoc
              ? "Uploading policy document"
              : "Loading policy"
        }
        message={
          saving
            ? "Updating policy details permanently."
            : uploadingDoc
              ? "Storing the uploaded PDF securely."
              : "Fetching saved PoSH policy details."
        }
      />
    </PortalShell>
  );
}

const tableWrapStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  overflowX: "auto",
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
  padding: "11px 12px",
  color: "var(--portal-text)",
};
