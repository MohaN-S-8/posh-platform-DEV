import BadgeIcon from "@mui/icons-material/Badge";
import DownloadIcon from "@mui/icons-material/Download";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

export function CertificatesPage() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadCertificates = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/certificates/my");
        if (active) setCertificates(res.data || []);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to load certificates.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCertificates();
    return () => {
      active = false;
    };
  }, []);

  const handleDownload = async (cert) => {
    setDownloading(cert.certificate_id);
    setError("");
    try {
      const res = await apiClient.get(`/certificates/${cert.certificate_id}/download`);
      window.open(res.data.download_url, "_blank");
    } catch (err) {
      setError(err.response?.data?.detail || "Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button
        type="button"
        onClick={() => navigate("/employee")}
        style={{
          background: "none",
          border: "none",
          color: "#17324d",
          cursor: "pointer",
          marginBottom: "16px",
          fontWeight: 700,
        }}
      >
        Back to Dashboard
      </button>

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
          My Certificates
        </h1>
        <p style={{ color: "#64748b", margin: "6px 0 0" }}>
          Download valid certificates and verify certificate numbers.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#fff7f6",
            border: "1px solid #f3b4ae",
            borderRadius: "8px",
            color: "#c0392b",
            padding: "12px 14px",
            marginBottom: "18px",
          }}
        >
          {error}
        </div>
      )}

      {!loading && certificates.length === 0 ? (
        <div
          style={{
            background: "white",
            borderRadius: "8px",
            padding: "40px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e7edf3",
            textAlign: "center",
          }}
        >
          <BadgeIcon style={{ fontSize: "46px", color: "#17324d" }} />
          <h2 style={{ color: "#17324d", marginBottom: "8px" }}>
            No certificates yet
          </h2>
          <p style={{ color: "#64748b", margin: 0 }}>
            Complete a training video and pass the assessment to earn your certificate.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {certificates.map((cert) => (
            <div
              key={cert.certificate_id}
              style={{
                background: "white",
                borderRadius: "8px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e7edf3",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ color: "#17324d", margin: "0 0 6px", fontSize: "18px" }}>
                  {cert.course_name}
                </h2>
                <p style={{ color: "#64748b", margin: "0 0 4px", fontSize: "13px" }}>
                  Certificate ID: <strong>{cert.certificate_number}</strong>
                </p>
                <p style={{ color: "#64748b", margin: 0, fontSize: "13px" }}>
                  Completed: {cert.completion_date || "-"} | Issued: {cert.issue_date || "-"} |{" "}
                  <strong style={{ color: cert.status === "Valid" ? "#1f7a4d" : "#c0392b" }}>
                    {cert.status}
                  </strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `/api/v1/certificates/verify/${cert.certificate_number}`,
                      "_blank",
                    )
                  }
                  style={{
                    padding: "9px 14px",
                    background: "#f0f4ff",
                    color: "#17324d",
                    border: "1px solid #cdd9e2",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <VerifiedIcon fontSize="small" />
                  Verify
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(cert)}
                  disabled={downloading === cert.certificate_id}
                  style={{
                    padding: "9px 14px",
                    background: downloading === cert.certificate_id ? "#93a4b7" : "#17324d",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: downloading === cert.certificate_id ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <DownloadIcon fontSize="small" />
                  {downloading === cert.certificate_id ? "Opening..." : "Download PDF"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoadingOverlay
        show={loading || Boolean(downloading)}
        title={downloading ? "Opening certificate" : "Loading certificates"}
        message={
          downloading
            ? "Preparing the signed certificate PDF link."
            : "Fetching your issued certificates."
        }
      />
    </div>
  );
}
