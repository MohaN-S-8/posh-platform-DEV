import BadgeIcon from "@mui/icons-material/Badge";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import VerifiedIcon from "@mui/icons-material/Verified";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

export function CertificateVerifyPage() {
  const { certificateNumber } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const verifyCertificate = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get(`/certificates/verify/${certificateNumber}`);
        if (active) setCertificate(res.data);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to verify this certificate.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    verifyCertificate();

    return () => {
      active = false;
    };
  }, [certificateNumber]);

  const isValid = certificate?.valid === true;
  const hasResult = Boolean(certificate) && !error;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f6f8fb",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "min(620px, 100%)",
          background: "white",
          borderRadius: "8px",
          padding: "32px",
          boxShadow: "0 8px 28px rgba(15, 23, 42, 0.1)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            marginBottom: "18px",
            background: isValid ? "#e8f7ef" : "#fff3f0",
            color: isValid ? "#1f7a4d" : "#c0392b",
          }}
        >
          {isValid ? <VerifiedIcon fontSize="large" /> : <ErrorOutlinedIcon fontSize="large" />}
        </div>

        <h1 style={{ color: "#17324d", margin: "0 0 8px", fontSize: "30px" }}>
          Certificate Verification
        </h1>
        <p style={{ color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
          This public page checks the certificate number against the POSH Training Platform
          records.
        </p>

        {error && (
          <div
            style={{
              background: "#fff7f6",
              border: "1px solid #f3b4ae",
              borderRadius: "8px",
              color: "#c0392b",
              padding: "12px 14px",
            }}
          >
            {error}
          </div>
        )}

        {hasResult && (
          <div style={{ display: "grid", gap: "12px" }}>
            <div
              style={{
                background: isValid ? "#f2fbf6" : "#fff7f6",
                border: `1px solid ${isValid ? "#b8e4ca" : "#f3b4ae"}`,
                color: isValid ? "#1f7a4d" : "#c0392b",
                borderRadius: "8px",
                padding: "14px",
                fontWeight: 800,
              }}
            >
              {isValid ? "Valid certificate" : certificate.message || "Certificate is not valid"}
            </div>

            <Detail label="Certificate Number" value={certificate.certificate_number} />
            {certificate.employee_name && (
              <Detail label="Employee" value={certificate.employee_name} />
            )}
            {certificate.course_name && <Detail label="Course" value={certificate.course_name} />}
            {certificate.completion_date && (
              <Detail label="Completion Date" value={certificate.completion_date} />
            )}
            {certificate.issue_date && <Detail label="Issue Date" value={certificate.issue_date} />}
            {certificate.status && <Detail label="Status" value={certificate.status} />}
          </div>
        )}

        {!loading && !hasResult && !error && (
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "24px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <BadgeIcon style={{ fontSize: "40px", color: "#17324d", marginBottom: "8px" }} />
            <p style={{ margin: 0 }}>No certificate details were returned.</p>
          </div>
        )}
      </div>

      <LoadingOverlay
        show={loading}
        title="Verifying certificate"
        message="Checking the certificate number."
      />
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: "12px",
        borderBottom: "1px solid #edf2f7",
        padding: "10px 0",
      }}
    >
      <span style={{ color: "#64748b", fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#17324d", fontWeight: 700, overflowWrap: "anywhere" }}>
        {value || "-"}
      </span>
    </div>
  );
}

Detail.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};
