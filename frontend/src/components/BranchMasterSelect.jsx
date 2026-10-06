import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import apiClient from "../api/client";
import { apiErrorMessage } from "../api/errors";

export function BranchMasterSelect({ companyId, branchId = "", branchName = "", onChange, required = false, style }) {
  const [result, setResult] = useState({ companyId: null, rows: [], error: "" });
  useEffect(() => {
    if (!companyId) return;
    let active = true;
    apiClient.get(`/users/company/${companyId}/branches`).then(({ data }) => {
      if (active) setResult({ companyId, rows: data || [], error: "" });
    }).catch((error) => {
      if (active) setResult({ companyId, rows: [], error: apiErrorMessage(error, "Unable to load Branch Master.") });
    });
    return () => { active = false; };
  }, [companyId]);
  const current = String(result.companyId) === String(companyId);
  const rows = current ? result.rows : [];
  const selected = rows.find((row) => branchId ? String(row.branch_id) === String(branchId) : row.branch_name === branchName);
  const legacyValue = branchId || (branchName ? `legacy:${branchName}` : "");
  const loading = Boolean(companyId) && !current;
  return <>
    <select required={required} value={selected?.branch_id || legacyValue} style={style}
      aria-busy={loading} disabled={!companyId}
      onChange={(event) => onChange(rows.find((row) => String(row.branch_id) === event.target.value) || null)}>
      <option value="">{!companyId ? "Select company first" : loading ? "Loading branches..." : "Select branch"}</option>
      {!selected && legacyValue && <option value={legacyValue}>{branchName || branchId} (existing)</option>}
      {rows.map((row) => <option key={row.branch_id} value={row.branch_id}>{row.branch_name} ({row.branch_id})</option>)}
    </select>
    {current && result.error && <span role="alert">{result.error}</span>}
    {current && !result.error && !rows.length && <span>No branches in Branch Master for this company.</span>}
    {selected && <span style={{ display: "block", fontSize: "12px", fontWeight: 400, marginTop: "4px" }}>
      {[selected.address1, selected.address2, selected.city, selected.state, selected.country, selected.pincode].filter(Boolean).join(", ")}
    </span>}
  </>;
}

BranchMasterSelect.propTypes = {
  companyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  branchId: PropTypes.string,
  branchName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  style: PropTypes.object,
};
