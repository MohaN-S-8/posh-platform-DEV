#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-/api/v1}"
PORT="${PORT:-80}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL}"
};
EOF

sed -i "s/__PORT__/${PORT}/g" /etc/nginx/conf.d/default.conf

exec "$@"
