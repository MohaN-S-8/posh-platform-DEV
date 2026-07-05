import AddIcon from "@mui/icons-material/Add";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cfd7df",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const initialForm = {
  template_name: "",
  font_name: "Helvetica",
  color_code: "#1a3c5e",
};

export function CertificateTemplatePage() {
  const navigate = useNavigate();
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
      setError(err.response?.data?.detail || "Unable to load certificate templates.");
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
      setError(err.response?.data?.detail || "Unable to save certificate template.");
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
      setError(err.response?.data?.detail || "Unable to update template status.");
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
      setSuccess(`${assetType === "logo" ? "Logo" : "Signature"} uploaded successfully.`);
      await loadTemplates();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to upload template asset.");
    } finally {
      setAssetUploading("");
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            style={{
              background: "none",
              border: "none",
              color: "#17324d",
              cursor: "pointer",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            Back to Dashboard
          </button>
          <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
            Certificate Templates
          </h1>
          <p style={{ color: "#64748b", margin: "6px 0 0" }}>
            Configure certificate style used for generated POSH completion PDFs.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm((v) => !v)} style={primaryButtonStyle}>
          <AddIcon fontSize="small" />
          New Template
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
      {success && <div style={successStyle}>{success}</div>}

      {showForm && (
        <form onSubmit={submitTemplate} style={panelStyle}>
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

      <div style={tableWrapStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "680px" }}>
          <thead>
            <tr style={{ background: "#17324d", color: "white" }}>
              {["Template", "Font", "Color", "Status", "Assets", "Actions"].map((heading) => (
                <th key={heading} style={thStyle}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {templates.length ? (
              templates.map((template) => (
                <tr key={template.template_id} style={{ borderBottom: "1px solid #eef2f6" }}>
                  <td style={{ ...tdStyle, color: "#17324d", fontWeight: 700 }}>
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
                    <button
                      type="button"
                      onClick={() => toggleStatus(template)}
                      style={secondaryButtonStyle}
                    >
                      {template.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: "28px", color: "#64748b" }}>
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
    </div>
  );
}

const panelStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  marginBottom: "20px",
};

const labelStyle = {
  color: "#17324d",
  fontWeight: 700,
  fontSize: "13px",
  display: "grid",
  gap: "6px",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  background: "#17324d",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const secondaryButtonStyle = {
  padding: "7px 10px",
  background: "#f0f4ff",
  color: "#17324d",
  border: "1px solid #cdd9e2",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
};

const tableWrapStyle = {
  background: "white",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
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
