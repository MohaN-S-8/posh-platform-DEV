import { useEffect, useMemo, useState } from "react";
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
  background: "white",
  color: "#111827",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export function TrainingHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/employee/history");
        if (active) setHistory(res.data || []);
      } catch (err) {
        if (active) {
          setError(err.response?.data?.detail || "Unable to load training history.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  const years = useMemo(() => {
    const values = history
      .map((row) => row.completion_date || row.due_date)
      .filter(Boolean)
      .map((value) => String(new Date(value).getFullYear()));
    return ["All", ...Array.from(new Set(values)).sort((a, b) => b.localeCompare(a))];
  }, [history]);

  const filteredHistory = useMemo(
    () =>
      history.filter((row) => {
        const matchesQuery = row.course_name
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        const matchesStatus =
          statusFilter === "All" || row.status === statusFilter;
        const dateValue = row.completion_date || row.due_date;
        const rowYear = dateValue ? String(new Date(dateValue).getFullYear()) : "";
        const matchesYear = yearFilter === "All" || rowYear === yearFilter;
        return matchesQuery && matchesStatus && matchesYear;
      }),
    [history, query, statusFilter, yearFilter],
  );

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
          Training History
        </h1>
        <p style={{ color: "#64748b", margin: "6px 0 0" }}>
          Review course status, completion dates, assessment scores, and certificates.
        </p>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "18px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e7edf3",
          marginBottom: "18px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search course"
          style={inputStyle}
          aria-label="Search course"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={inputStyle}
          aria-label="Filter by status"
        >
          {["All", "Completed", "In Progress", "Not Started"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          style={inputStyle}
          aria-label="Filter by year"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year === "All" ? "All years" : year}
            </option>
          ))}
        </select>
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

      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid #e7edf3",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
          <thead>
            <tr style={{ background: "#f6f8fb" }}>
              {[
                "Course Name",
                "Status",
                "Completion",
                "Completion Date",
                "Assessment Score",
                "Result",
                "Certificate Number",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    color: "#64748b",
                    fontSize: "13px",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length ? (
              filteredHistory.map((row) => (
                <tr key={row.video_id} style={{ borderBottom: "1px solid #eef2f6" }}>
                  <td style={{ padding: "12px 14px", color: "#17324d", fontWeight: 700 }}>
                    {row.course_name}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#17324d" }}>
                    {row.status}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#17324d" }}>
                    {Math.round(row.completion_percent || 0)}%
                  </td>
                  <td style={{ padding: "12px 14px", color: "#64748b" }}>
                    {formatDate(row.completion_date)}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#17324d" }}>
                    {row.assessment_score === null || row.assessment_score === undefined
                      ? "-"
                      : `${row.assessment_score}%`}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#17324d" }}>
                    {row.assessment_result || "-"}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#64748b" }}>
                    {row.certificate_number || "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: "18px", color: "#64748b" }}>
                  No training history found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <LoadingOverlay
        show={loading}
        title="Loading training history"
        message="Fetching course status, assessment scores, and certificates."
      />
    </div>
  );
}
