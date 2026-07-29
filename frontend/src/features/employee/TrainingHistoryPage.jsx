import { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { PortalShell } from "../../components/PortalShell";

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
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
    <PortalShell
      title="Training History"
      subtitle="Review course status, completion dates, assessment scores, and certificates."
    >

      <div
        className="portal-card"
        style={{
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
        className="portal-card"
        style={{
          overflowX: "auto",
        }}
      >
        <table className="portal-table" style={{ minWidth: "860px" }}>
          <thead>
            <tr>
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
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length ? (
              filteredHistory.map((row) => (
                <tr key={row.video_id}>
                  <td style={{ color: "var(--portal-purple)", fontWeight: 700 }}>
                    {row.course_name}
                  </td>
                  <td>
                    {row.status}
                  </td>
                  <td>
                    {Math.round(row.completion_percent || 0)}%
                  </td>
                  <td>
                    {formatDate(row.completion_date)}
                  </td>
                  <td>
                    {row.assessment_score === null || row.assessment_score === undefined
                      ? "-"
                      : `${row.assessment_score}%`}
                  </td>
                  <td>
                    {row.assessment_result || "-"}
                  </td>
                  <td>
                    {row.certificate_number || "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: "18px", color: "var(--portal-muted)" }}>
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
    </PortalShell>
  );
}
