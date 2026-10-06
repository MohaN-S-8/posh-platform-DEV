import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import apiClient from "../api/client";

let pendingRequest;
function loadGeography() {
  if (!pendingRequest) {
    pendingRequest = apiClient.get("/companies/geography-codes/")
      .then((response) => response.data || [])
      .finally(() => { pendingRequest = undefined; });
  }
  return pendingRequest;
}

const normalize = (value) => String(value || "").trim().toLowerCase();
function metadata(row) {
  try {
    return JSON.parse(row.description || "{}") || {};
  } catch {
    return {};
  }
}

export function MasterCityInput({ value = "", onChange, state = "", country = "", required = false, autoMap = false }) {
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadGeography().then((rows) => {
      if (active) setMasters(rows);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const matches = (category, selected, stored) => {
    if (!selected || !stored) return true;
    const master = masters.find((row) => row.category === category
      && [row.name, row.code].some((item) => normalize(item) === normalize(selected)));
    return [selected, master?.code, master?.name].filter(Boolean)
      .some((item) => normalize(item) === normalize(stored));
  };
  const options = masters.filter((row) => row.category === "City Code" && row.is_active)
    .filter((row) => autoMap || (matches("State Code", state, metadata(row).state)
      && matches("Country Code", country, metadata(row).country)));
  const selected = masters.find((row) => row.category === "City Code"
    && [row.code, row.name].some((item) => normalize(item) === normalize(value)))
    || (value ? { name: value, code: value } : null);

  const resolveCode = (category, reference) => masters.find((row) => row.category === category
    && [row.code, row.name].some((item) => normalize(item) === normalize(reference)))?.code || "";
  const geographyFor = (option) => {
    const meta = metadata(option || {});
    const stateCode = resolveCode("State Code", meta.state);
    const stateRow = masters.find((row) => row.category === "State Code" && row.code === stateCode);
    const countryCode = resolveCode("Country Code", meta.country || metadata(stateRow || {}).country);
    return { ...(stateCode ? { state: stateCode } : {}), ...(countryCode ? { country: countryCode } : {}) };
  };
  const selectedGeography = geographyFor(selected);
  const mappedState = selectedGeography.state;
  const mappedCountry = selectedGeography.country;
  useEffect(() => {
    if (!autoMap || !value) return;
    const missing = {
      ...(!state && mappedState ? { state: mappedState } : {}),
      ...(!country && mappedCountry ? { country: mappedCountry } : {}),
    };
    if (Object.keys(missing).length) onChange(value, missing);
  }, [autoMap, value, state, country, mappedState, mappedCountry, onChange]);

  return (
    <Autocomplete
      size="small"
      options={options}
      value={selected}
      loading={loading}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, current) => option.code === current.code}
      onChange={(_, option) => autoMap
        ? onChange(option?.name || "", geographyFor(option))
        : onChange(option?.name || "")}
      noOptionsText={failed ? "Unable to load City Master" : "No matching cities in City Master"}
      renderInput={(params) => (
        <TextField {...params} required={required} placeholder="Search or select city"
          error={failed} helperText={failed ? "City Master could not be loaded. Reload to retry." : undefined}
          slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, "aria-label": "City" } }} />
      )}
      sx={{ width: "100%", minWidth: 0, backgroundColor: "white" }}
    />
  );
}

MasterCityInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  state: PropTypes.string,
  country: PropTypes.string,
  required: PropTypes.bool,
  autoMap: PropTypes.bool,
};
