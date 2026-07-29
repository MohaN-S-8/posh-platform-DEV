import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useCallback, useEffect, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const initialForm = {
  template_name: "",
  font_name: "Helvetica",
  color_code: "#1a3c5e",
};

export function CertificateTemplatePage() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetUploading, setAssetUploading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get("/certificates/templates");
      setTemplates(res.data || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to load certificate templates."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTemplates();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTemplates]);

  const submitTemplate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post("/certificates/templates", form);
      setSuccess("Certificate template created successfully.");
      setForm(initialForm);
      setShowForm(false);
      await loadTemplates();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to save certificate template."));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (template) => {
    const nextStatus = template.status === "Active" ? "Inactive" : "Active";
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.patch(
        `/certificates/templates/${template.template_id}/status?status=${nextStatus}`,
      );
      setSuccess(`Template ${nextStatus.toLowerCase()} successfully.`);
      await loadTemplates();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to update template status."));
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (template, assetType, file) => {
    if (!file) return;
    setAssetUploading(`${template.template_id}-${assetType}`);
    setError("");
    setSuccess("");
    const formData = new FormData();
    formData.append("asset_type", assetType);
    formData.append("file", file);
    try {
      await apiClient.post(`/certificates/templates/${template.template_id}/asset`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const label =
        assetType === "logo"
          ? "Logo"
          : assetType === "signature"
            ? "Signature"
            : "Ready-made certificate template";
      setSuccess(`${label} uploaded successfully.`);
      await loadTemplates();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to upload template asset."));
    } finally {
      setAssetUploading("");
    }
  };

  const deleteTemplate = async (template) => {
    const confirmed = window.confirm(
      `Delete certificate template "${template.template_name}"? Issued certificates will remain, but this template file will be removed.`,
    );
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiClient.delete(`/certificates/templates/${template.template_id}`);
      setSuccess(res.data?.message || "Certificate template deleted.");
      await loadTemplates();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to delete certificate template."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalShell
      title="Certificate Setup"
      subtitle="Design certificate layout templates, uploaded images, and signature positioning."
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setShowForm((curr) => !curr)}
          style={primaryButtonStyle}
        >
          <AddIcon fontSize="small" /> New Template
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      {showForm && (
        <form onSubmit={submitTemplate} className="portal-card" style={{ marginBottom: "20px" }}>
          <div className="portal-section-title" style={{ marginTop: 0 }}>
            Template Details
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "14px",
              marginBottom: "16px",
            }}
          >
            <label style={labelStyle}>
              Template Name
              <input
                required
                value={form.template_name}
                onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Font
              <select
                value={form.font_name}
                onChange={(e) => setForm({ ...form, font_name: e.target.value })}
                style={inputStyle}
              >
                {["Helvetica", "Times-Roman", "Courier"].map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Brand Color
              <input
                type="color"
                value={form.color_code}
                onChange={(e) => setForm({ ...form, color_code: e.target.value })}
                style={{ ...inputStyle, padding: "4px", height: "42px" }}
              />
            </label>
          </div>
          <button type="submit" disabled={saving} style={primaryButtonStyle}>
            {saving ? "Saving..." : "Save Template"}
          </button>
        </form>
      )}

      <div className="portal-card" style={{ marginBottom: "20px" }}>
        <div className="portal-section-title" style={{ marginTop: 0 }}>
          Ready-Made Template Placeholders
        </div>
        <p style={{ color: "var(--portal-muted)", margin: 0, fontSize: "13px" }}>
          Upload a certificate background or document containing placeholders like{" "}
          <strong>&lt;&lt;name&gt;&gt;</strong>, <strong>&lt;&lt;course&gt;&gt;</strong>,{" "}
          <strong>&lt;&lt;date&gt;&gt;</strong>, and <strong>&lt;&lt;certificate_no&gt;&gt;</strong>.
        </p>
      </div>

      <div style={tableWrapStyle}>
        <table className="portal-table" style={{ minWidth: "920px" }}>
          <thead>
            <tr>
              {["Template", "Font", "Color", "Status", "Ready Template", "Assets", "Actions"].map((heading) => (
                <th key={heading} style={thStyle}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {templates.length ? (
              templates.map((template) => (
                <tr key={template.template_id}>
                  <td style={{ ...tdStyle, color: "var(--portal-purple)", fontWeight: 700 }}>
                    {template.template_name}
                  </td>
                  <td style={tdStyle}>{template.font_name}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        width: "20px",
                        height: "20px",
                        borderRadius: "4px",
                        background: template.color_code,
                        border: "1px solid #cdd9e2",
                        verticalAlign: "middle",
                        marginRight: "8px",
                      }}
                    />
                    {template.color_code}
                  </td>
                  <td style={tdStyle}>{template.status}</td>
                  <td style={tdStyle}>
                    <label style={fileButtonStyle}>
                      <UploadFileIcon fontSize="small" />
                      {template.template_file_path ? "Replace Template" : "Upload Template"}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.docx"
                        disabled={assetUploading === `${template.template_id}-template`}
                        onChange={(e) => uploadAsset(template, "template", e.target.files?.[0])}
                        style={{ display: "none" }}
                      />
                    </label>
                    {template.template_file_path && (
                      <div style={{ marginTop: "6px", color: "#1f7a4d", fontSize: "12px" }}>
                        Uploaded
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "grid", gap: "6px" }}>
                      <label>
                        Logo
                        <input
                          type="file"
                          accept="image/*"
                          disabled={assetUploading === `${template.template_id}-logo`}
                          onChange={(e) => uploadAsset(template, "logo", e.target.files?.[0])}
                        />
                      </label>
                      <label>
                        Signature
                        <input
                          type="file"
                          accept="image/*"
                          disabled={assetUploading === `${template.template_id}-signature`}
                          onChange={(e) =>
                            uploadAsset(template, "signature", e.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => toggleStatus(template)}
                        style={secondaryButtonStyle}
                      >
                        {template.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(template)}
                        style={dangerButtonStyle}
                      >
                        <DeleteIcon fontSize="small" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: "28px", color: "#64748b" }}>
                  No certificate templates created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LoadingOverlay
        show={loading || saving || Boolean(assetUploading)}
        title={saving ? "Saving template" : "Loading templates"}
        message="Fetching certificate template configuration."
      />
    </PortalShell>
  );
}

const labelStyle = {
  color: "var(--portal-purple)",
  fontWeight: 700,
  fontSize: "13px",
  display: "grid",
  gap: "6px",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  background: "var(--portal-pink)",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const secondaryButtonStyle = {
  padding: "7px 10px",
  background: "#f1eafb",
  color: "var(--portal-purple)",
  border: "1px solid #ddcbf3",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle = {
  padding: "7px 10px",
  background: "#fff7f6",
  color: "#c0392b",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
};

const fileButtonStyle = {
  ...secondaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const tableWrapStyle = {
  background: "white",
  borderRadius: "8px",
  border: "1px solid var(--portal-border)",
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

const successStyle = {
  background: "#e8f5ee",
  border: "1px solid #1f7a4d",
  borderRadius: "8px",
  color: "#1f7a4d",
  padding: "12px 14px",
  marginBottom: "18px",
};
