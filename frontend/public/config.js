// Fallback for local/static builds.
// In Docker/Railway this file is overwritten at container startup by docker-entrypoint.sh
// using the Railway API_BASE_URL environment variable.
window.__APP_CONFIG__ = {
  API_BASE_URL: "/api/v1",
};
