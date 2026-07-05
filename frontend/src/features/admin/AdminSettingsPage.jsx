import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

const implementedItems = [
  "Management APIs enforce permission_master and role_permission checks.",
  "company_languages table is created and seeded for the default company.",
  "Audit Logs shows login attempts and sensitive admin/HR action logging.",
  "Employee, department, and certificate reports export as Excel, CSV, and PDF.",
  "HR can create due and overdue training reminder notifications.",
  "video_quality table stores uploaded quality variants.",
  "Video transcript text is stored as English WebVTT subtitles.",
  "Certificate templates support color, font, logo, and signature assets.",
];

export function AdminSettingsPage() {
  const navigate = useNavigate();
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLanguages = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/admin/languages");
        setLanguages(res.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    };
    loadLanguages();
  }, []);

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button type="button" onClick={() => navigate("/admin")} style={backButtonStyle}>
        Back to Dashboard
      </button>
      <h1 style={{ color: "#17324d", margin: "0 0 6px", fontSize: "30px" }}>
        System Settings
      </h1>
      <p style={{ color: "#64748b", margin: "0 0 24px" }}>
        Current platform configuration.
      </p>

      {error && <div style={errorStyle}>{error}</div>}

      <section style={cardStyle}>
        <h2 style={headingStyle}>Configured Languages</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {languages.map((language) => (
            <span
              key={language.language_id}
              style={{
                background: "#eef4f8",
                color: "#17324d",
                borderRadius: "999px",
                padding: "7px 12px",
                fontWeight: 700,
                fontSize: "13px",
              }}
            >
              {language.language_name}
            </span>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={headingStyle}>Implemented Platform Configuration</h2>
        <div style={{ display: "grid", gap: "10px" }}>
          {implementedItems.map((item) => (
            <div key={item} style={{ color: "#64748b", fontSize: "14px" }}>
              {item}
            </div>
          ))}
        </div>
      </section>

      <LoadingOverlay show={loading} title="Loading settings" message="Fetching languages." />
    </div>
  );
}

const backButtonStyle = {
  background: "none",
  border: "none",
  color: "#17324d",
  cursor: "pointer",
  marginBottom: "16px",
  fontWeight: 700,
};

const cardStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  border: "1px solid #e7edf3",
  marginBottom: "18px",
};

const headingStyle = {
  color: "#17324d",
  margin: "0 0 14px",
  fontSize: "20px",
};

const errorStyle = {
  background: "#fff7f6",
  border: "1px solid #f3b4ae",
  borderRadius: "8px",
  color: "#c0392b",
  padding: "12px 14px",
  marginBottom: "18px",
};
