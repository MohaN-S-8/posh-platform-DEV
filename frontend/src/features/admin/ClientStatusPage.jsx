import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import { apiErrorMessage } from "../../api/errors";
import { PortalShell } from "../../components/PortalShell";

const tabs = ["Company Compliance Status", "Employee Report"];
const trainingOptions = ["All", "Completed", "Pending"];

export function ClientStatusPage() {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [analytics, setAnalytics] = useState(null);
  const [companyFilter, setCompanyFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [location, setLocation] = useState("");
  const [awarenessTraining, setAwarenessTraining] = useState("All");
  const [icTraining, setIcTraining] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/analytics/overview");
        if (active) setAnalytics(res.data);
      } catch (err) {
        if (active) setError(apiErrorMessage(err, "Unable to load client status."));
      } finally {
        if (active) setLoading(false);
      }
    };
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const companies = useMemo(() => analytics?.organizations || [], [analytics?.organizations]);
  const employeeRows = useMemo(
    () => analytics?.user_training_rows || [],
    [analytics?.user_training_rows],
  );

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return companies.filter((company) => {
      if (companyFilter !== "All" && String(company.company_id) !== companyFilter) return false;
      if (!query) return true;
      return [company.company_name, company.client_id, company.company_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [companies, companyFilter, searchQuery]);

  const filteredEmployees = useMemo(() => {
    const nameQuery = employeeName.trim().toLowerCase();
    const idQuery = employeeId.trim().toLowerCase();
    const departmentQuery = department.trim().toLowerCase();
    const designationQuery = designation.trim().toLowerCase();
    const locationQuery = location.trim().toLowerCase();
    return employeeRows.filter((row) => {
      if (companyFilter !== "All" && String(row.company_id) !== companyFilter) return false;
      if (idQuery && !String(row.employee_id || "").toLowerCase().includes(idQuery)) return false;
      if (nameQuery && !String(row.name || "").toLowerCase().includes(nameQuery)) return false;
      if (departmentQuery && !String(row.department || "").toLowerCase().includes(departmentQuery)) return false;
      if (designationQuery && !String(row.role || "").toLowerCase().includes(designationQuery)) return false;
      if (locationQuery && !String(row.company_name || "").toLowerCase().includes(locationQuery)) return false;
      if (awarenessTraining !== "All" && row.completion_status !== awarenessTraining) return false;
      if (
        icTraining !== "All"
        && String(row.role || "").toLowerCase().includes("ic")
        && row.completion_status !== icTraining
      ) return false;
      return true;
    });
  }, [
    awarenessTraining,
    companyFilter,
    department,
    designation,
    employeeId,
    employeeName,
    employeeRows,
    icTraining,
    location,
  ]);

  const clearFilters = () => {
    setCompanyFilter("All");
    setSearchQuery("");
    setEmployeeId("");
    setEmployeeName("");
    setDepartment("");
    setDesignation("");
    setLocation("");
    setAwarenessTraining("All");
    setIcTraining("All");
  };

  const exportCsv = () => {
    const rows = activeTab === tabs[0]
      ? complianceCsvRows(filteredCompanies)
      : employeeCsvRows(filteredEmployees);
    downloadCsv(
      activeTab === tabs[0] ? "client_compliance_status.csv" : "client_employee_report.csv",
      rows,
    );
  };

  const exportPdf = () => {
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) return;
    const html = activeTab === tabs[0]
      ? compliancePrintHtml(filteredCompanies)
      : employeePrintHtml(filteredEmployees);
    popup.document.write(html);
    popup.document.close();
  };

  return (
    <PortalShell
      title="Client Status"
      subtitle="Master-company view - compliance status and employee report across every client, all in one place."
    >
      {error && <div style={errorStyle}>{error}</div>}
      <div style={tabBarStyle}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? activeTabStyle : tabStyle}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === tabs[0] ? (
        <CompanyComplianceFilters
          companies={companies}
          companyFilter={companyFilter}
          searchQuery={searchQuery}
          onCompanyFilter={setCompanyFilter}
          onSearch={setSearchQuery}
          onClear={clearFilters}
        />
      ) : (
        <EmployeeFilters
          companies={companies}
          companyFilter={companyFilter}
          employeeId={employeeId}
          employeeName={employeeName}
          department={department}
          designation={designation}
          location={location}
          awarenessTraining={awarenessTraining}
          icTraining={icTraining}
          onCompanyFilter={setCompanyFilter}
          onEmployeeId={setEmployeeId}
          onEmployeeName={setEmployeeName}
          onDepartment={setDepartment}
          onDesignation={setDesignation}
          onLocation={setLocation}
          onAwarenessTraining={setAwarenessTraining}
          onIcTraining={setIcTraining}
          onClear={clearFilters}
        />
      )}

      <div style={actionBarStyle}>
        <button type="button" onClick={exportCsv} style={secondaryButtonStyle}>
          <DownloadIcon fontSize="small" /> Download Excel
        </button>
        <button type="button" onClick={exportPdf} style={secondaryButtonStyle}>
          <PrintIcon fontSize="small" /> Download PDF
        </button>
      </div>

      {loading ? (
        <div style={emptyStyle}>Loading client status...</div>
      ) : activeTab === tabs[0] ? (
        <CompanyComplianceTable companies={filteredCompanies} />
      ) : (
        <EmployeeReportTable rows={filteredEmployees} />
      )}
    </PortalShell>
  );
}

function CompanyComplianceFilters({ companies, companyFilter, searchQuery, onCompanyFilter, onSearch, onClear }) {
  return (
    <section style={filterPanelStyle}>
      <label style={labelStyle}>Company
        <select value={companyFilter} onChange={(event) => onCompanyFilter(event.target.value)} style={inputStyle}>
          <option value="All">All Companies</option>
          {companies.map((company) => (
            <option key={company.company_id} value={company.company_id}>{company.company_name}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>Search Company / Code
        <input value={searchQuery} onChange={(event) => onSearch(event.target.value)} placeholder="Type to search..." style={inputStyle} />
      </label>
      <button type="button" onClick={onClear} style={clearButtonStyle}>Clear Filters</button>
    </section>
  );
}

function EmployeeFilters(props) {
  return (
    <section style={employeeFilterPanelStyle}>
      <label style={labelStyle}>Company
        <select value={props.companyFilter} onChange={(event) => props.onCompanyFilter(event.target.value)} style={inputStyle}>
          <option value="All">All Companies</option>
          {props.companies.map((company) => (
            <option key={company.company_id} value={company.company_id}>{company.company_name}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>Employee ID
        <input value={props.employeeId} onChange={(event) => props.onEmployeeId(event.target.value)} placeholder="e.g. ABCL-001" style={inputStyle} />
      </label>
      <label style={labelStyle}>Employee Name
        <input value={props.employeeName} onChange={(event) => props.onEmployeeName(event.target.value)} placeholder="Type to search..." style={inputStyle} />
      </label>
      <label style={labelStyle}>Department
        <input value={props.department} onChange={(event) => props.onDepartment(event.target.value)} placeholder="Type to search..." style={inputStyle} />
      </label>
      <label style={labelStyle}>Designation
        <input value={props.designation} onChange={(event) => props.onDesignation(event.target.value)} placeholder="Type to search..." style={inputStyle} />
      </label>
      <label style={labelStyle}>Location / Branch
        <input value={props.location} onChange={(event) => props.onLocation(event.target.value)} placeholder="Type to search..." style={inputStyle} />
      </label>
      <label style={labelStyle}>Awareness Training
        <select value={props.awarenessTraining} onChange={(event) => props.onAwarenessTraining(event.target.value)} style={inputStyle}>
          {trainingOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label style={labelStyle}>IC Training
        <select value={props.icTraining} onChange={(event) => props.onIcTraining(event.target.value)} style={inputStyle}>
          {trainingOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <button type="button" onClick={props.onClear} style={clearButtonStyle}>Clear Filters</button>
    </section>
  );
}

function CompanyComplianceTable({ companies }) {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {["Company", "IC Policy", "IC Constitution", "Display & Notices", "IC Meetings (Q1-Q4)", "Annual Return", "Complaints"].map((heading) => (
              <th key={heading} style={thStyle}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.company_id}>
              <td style={tdStyle}>
                <strong>{company.company_name}</strong>
                <small style={mutedBlockStyle}>{company.client_id || company.company_code || "-"}</small>
              </td>
              <td style={tdStyle}><StatusBadge status={company.services?.length ? "Completed" : "Pending"} /></td>
              <td style={tdStyle}><StatusBadge status={company.ic_users ? "Completed" : "Pending"} /></td>
              <td style={tdStyle}><StatusBadge status={company.services?.length ? "Completed" : "Pending"} /></td>
              <td style={tdStyle}><QuarterChecks complete={company.ic_users > 0} /></td>
              <td style={tdStyle}><StatusBadge status={company.annual_return_status === "Filed" ? "Completed" : "Pending"} /></td>
              <td style={tdStyle}><StatusBadge status={company.open_complaints ? `${company.open_complaints} Open` : "No Open Complaints"} /></td>
            </tr>
          ))}
          {!companies.length && <tr><td colSpan={7} style={emptyCellStyle}>No companies match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeReportTable({ rows }) {
  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {["Company", "Employee ID", "Employee Name", "Department", "Designation", "Awareness Training", "IC Training", "Certificate"].map((heading) => (
              <th key={heading} style={thStyle}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isIc = String(row.role || "").toLowerCase().includes("ic");
            return (
              <tr key={row.user_id}>
                <td style={tdStyle}>{row.company_name}</td>
                <td style={tdStyle}>{row.employee_id}</td>
                <td style={tdStyle}>{row.name}</td>
                <td style={tdStyle}>{row.department}</td>
                <td style={tdStyle}>{row.role}</td>
                <td style={tdStyle}><StatusBadge status={row.completion_status === "Completed" ? "Completed" : "Pending"} /></td>
                <td style={tdStyle}><StatusBadge status={!isIc ? "NA" : row.completion_status === "Completed" ? "Completed" : "Pending"} /></td>
                <td style={tdStyle}><StatusBadge status={row.certificate_status} /></td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={8} style={emptyCellStyle}>No employees match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function QuarterChecks({ complete }) {
  return (
    <div style={quarterStyle}>
      {["Q1", "Q2", "Q3", "Q4"].map((quarter, index) => (
        <label key={quarter}>
          <input type="checkbox" readOnly checked={complete && index === 0} /> {quarter}
        </label>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "Pending");
  const tone = normalized.includes("Completed") || normalized.includes("No Open") || normalized === "Valid"
    ? "green"
    : normalized.includes("Open")
      ? "amber"
      : "red";
  return <span style={{ ...badgeStyle, ...badgeToneStyle[tone] }}>{normalized}</span>;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function complianceCsvRows(companies) {
  return [
    ["Company", "IC Policy", "IC Constitution", "Display & Notices", "Annual Return", "Complaints"],
    ...companies.map((company) => [
      company.company_name,
      company.services?.length ? "Completed" : "Pending",
      company.ic_users ? "Completed" : "Pending",
      company.services?.length ? "Completed" : "Pending",
      company.annual_return_status,
      company.open_complaints ? `${company.open_complaints} Open` : "No Open Complaints",
    ]),
  ];
}

function employeeCsvRows(rows) {
  return [
    ["Company", "Employee ID", "Employee Name", "Department", "Designation", "Training", "Certificate"],
    ...rows.map((row) => [
      row.company_name,
      row.employee_id,
      row.name,
      row.department,
      row.role,
      row.completion_status,
      row.certificate_status,
    ]),
  ];
}

function compliancePrintHtml(companies) {
  const rows = complianceCsvRows(companies).slice(1);
  return printShell(
    "Client Compliance Status Report",
    `<table><thead><tr>${complianceCsvRows([])[0].map((heading) => `<th>${heading}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
  );
}

function employeePrintHtml(rows) {
  const csvRows = employeeCsvRows(rows);
  return printShell(
    "Client Employee Report",
    `<table><thead><tr>${csvRows[0].map((heading) => `<th>${heading}</th>`).join("")}</tr></thead><tbody>${csvRows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
  );
}

function printShell(title, body) {
  return `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #172033; padding: 24px; }
          button { background: #4f2d8f; color: white; border: 0; border-radius: 4px; padding: 9px 13px; margin-right: 8px; font-weight: 700; }
          h1 { font-size: 22px; margin: 18px 0 8px; }
          p { color: #5f6b7a; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
          th, td { border: 1px solid #cfd5e3; padding: 8px; text-align: left; }
          th { background: #f5f1ff; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Print / Save as PDF</button>
        <button onclick="window.close()">Close</button>
        <h1>${title}</h1>
        <p>Generated ${new Date().toLocaleDateString("en-IN")} - Samarthana Corporate Services</p>
        ${body}
      </body>
    </html>
  `;
}

CompanyComplianceFilters.propTypes = {
  companies: PropTypes.array.isRequired,
  companyFilter: PropTypes.string.isRequired,
  searchQuery: PropTypes.string.isRequired,
  onCompanyFilter: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

EmployeeFilters.propTypes = {
  companies: PropTypes.array.isRequired,
  companyFilter: PropTypes.string.isRequired,
  employeeId: PropTypes.string.isRequired,
  employeeName: PropTypes.string.isRequired,
  department: PropTypes.string.isRequired,
  designation: PropTypes.string.isRequired,
  location: PropTypes.string.isRequired,
  awarenessTraining: PropTypes.string.isRequired,
  icTraining: PropTypes.string.isRequired,
  onCompanyFilter: PropTypes.func.isRequired,
  onEmployeeId: PropTypes.func.isRequired,
  onEmployeeName: PropTypes.func.isRequired,
  onDepartment: PropTypes.func.isRequired,
  onDesignation: PropTypes.func.isRequired,
  onLocation: PropTypes.func.isRequired,
  onAwarenessTraining: PropTypes.func.isRequired,
  onIcTraining: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

CompanyComplianceTable.propTypes = {
  companies: PropTypes.array.isRequired,
};

EmployeeReportTable.propTypes = {
  rows: PropTypes.array.isRequired,
};

QuarterChecks.propTypes = {
  complete: PropTypes.bool.isRequired,
};

StatusBadge.propTypes = {
  status: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

const tabBarStyle = {
  display: "flex",
  gap: "24px",
  borderBottom: "1px solid var(--portal-border)",
  marginBottom: "16px",
};

const tabStyle = {
  border: "none",
  background: "transparent",
  color: "var(--portal-muted)",
  padding: "12px 0",
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabStyle = {
  ...tabStyle,
  color: "var(--portal-purple)",
  borderBottom: "2px solid var(--portal-pink)",
};

const filterPanelStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 1fr) auto",
  gap: "16px",
  alignItems: "end",
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "18px",
  marginBottom: "12px",
};

const employeeFilterPanelStyle = {
  ...filterPanelStyle,
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  fontSize: "12px",
  fontWeight: 800,
  color: "var(--portal-text)",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--portal-border)",
  borderRadius: "7px",
  padding: "10px 12px",
  background: "white",
  color: "var(--portal-text)",
};

const clearButtonStyle = {
  width: "fit-content",
  border: "1px solid var(--portal-border)",
  background: "white",
  color: "var(--portal-purple)",
  borderRadius: "7px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const actionBarStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginBottom: "12px",
};

const secondaryButtonStyle = {
  ...clearButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const tableWrapStyle = {
  background: "white",
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: "940px",
  borderCollapse: "collapse",
};

const thStyle = {
  padding: "12px",
  textAlign: "left",
  background: "#faf8ff",
  color: "var(--portal-muted)",
  fontSize: "11px",
  textTransform: "uppercase",
};

const tdStyle = {
  padding: "12px",
  borderTop: "1px solid var(--portal-border)",
  color: "var(--portal-text)",
};

const mutedBlockStyle = {
  display: "block",
  marginTop: "3px",
  color: "var(--portal-muted)",
  fontSize: "11px",
};

const quarterStyle = {
  display: "grid",
  gap: "2px",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "74px",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "11px",
  fontWeight: 800,
};

const badgeToneStyle = {
  green: { background: "#dcfce7", color: "#047857" },
  amber: { background: "#fef3c7", color: "#a16207" },
  red: { background: "#ffe4e6", color: "#be123c" },
};

const emptyStyle = {
  border: "1px solid var(--portal-border)",
  borderRadius: "8px",
  padding: "24px",
  color: "var(--portal-muted)",
  background: "#faf8ff",
};

const emptyCellStyle = {
  padding: "26px",
  textAlign: "center",
  color: "var(--portal-muted)",
};

const errorStyle = {
  background: "#fdf0f0",
  border: "1px solid #e74c3c",
  borderRadius: "8px",
  padding: "12px 16px",
  color: "#c0392b",
  marginBottom: "16px",
};

export default ClientStatusPage;
