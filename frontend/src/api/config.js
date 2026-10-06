export function resolveApiBaseUrl(runtimeUrl, buildUrl) {
  const normalize = (value) =>
    typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  const runtime = normalize(runtimeUrl);
  const build = normalize(buildUrl);
  return (runtime && runtime !== "/api/v1" ? runtime : build) || "/api/v1";
}
