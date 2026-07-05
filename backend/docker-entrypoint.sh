#!/bin/sh
set -eu

python -m app.db.init_db

exec "$@"
