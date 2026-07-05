import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";

export function BulkUploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0]) {
      setError("Please select a file.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", fileInputRef.current.files[0]);

    try {
      const res = await apiClient.post("/hr/employees/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csv =
      "employee_id,first_name,last_name,email,mobile,department,designation,role_id\n" +
      "EMP001,Ravi,Kumar,ravi@company.com,9876543210,IT,Developer,4\n" +
      "EMP002,Priya,Sharma,priya@company.com,9876543211,HR,Manager,3";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_template.csv";
    a.click();
  };

  return (
    <div style={{ padding: "32px", background: "#f5f7fa", minHeight: "100vh" }}>
      <button
        onClick={() => navigate("/hr")}
        style={{
          background: "none",
          border: "none",
          color: "#1a3c5e",
          cursor: "pointer",
          marginBottom: "16px",
        }}
      >
        ← Back to HR Dashboard
      </button>
      <h1 style={{ color: "#1a3c5e", marginBottom: "24px" }}>
        Bulk Employee Upload
      </h1>

      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ color: "#1a3c5e", marginTop: 0 }}>Upload Employee List</h3>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
          Upload an Excel (.xlsx) or CSV (.csv) file with employee data.
          Required columns:{" "}
          <code>employee_id, first_name, email, mobile, role_id</code>
        </p>
        <button
          onClick={downloadTemplate}
          style={{
            padding: "8px 16px",
            background: "#f0f4ff",
            color: "#1a3c5e",
            border: "1px solid #1a3c5e",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "13px",
            marginBottom: "20px",
          }}
        >
          ⬇ Download Template CSV
        </button>

        <form onSubmit={handleUpload}>
          <div
            style={{
              border: "2px dashed #ddd",
              borderRadius: "8px",
              padding: "32px",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            <p style={{ color: "#666", marginBottom: "12px" }}>
              Select your Excel or CSV file
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              style={{ fontSize: "14px" }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fdf0f0",
                border: "1px solid #e74c3c",
                borderRadius: "6px",
                padding: "10px 14px",
                color: "#e74c3c",
                fontSize: "14px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 28px",
              background: loading ? "#93b8d4" : "#1a3c5e",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Uploading..." : "Upload & Create Employees"}
          </button>
        </form>
      </div>

      {result && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#1a3c5e" }}>Upload Results</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            {[
              {
                label: "Total Rows",
                value: result.total_rows,
                color: "#1a3c5e",
              },
              {
                label: "Successfully Created",
                value: result.success_rows,
                color: "#27ae60",
              },
              {
                label: "Failed Rows",
                value: result.failed_rows,
                color: "#e74c3c",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#f9f9f9",
                  borderRadius: "8px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "32px", fontWeight: 700, color }}>
                  {value}
                </div>
                <div
                  style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          {result.errors?.length > 0 && (
            <div>
              <h4 style={{ color: "#e74c3c" }}>Rows with errors:</h4>
              <div style={{ maxHeight: "300px", overflow: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#fdf0f0" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>
                        Row
                      </th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>
                        Email
                      </th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>
                        Errors
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px 12px", color: "#e74c3c" }}>
                          Row {err.row}
                        </td>
                        <td style={{ padding: "8px 12px" }}>{err.email}</td>
                        <td style={{ padding: "8px 12px", color: "#666" }}>
                          {err.errors.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
