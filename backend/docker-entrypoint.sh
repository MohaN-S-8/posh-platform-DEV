#!/bin/sh
set -eu

python -m app.db.init_db
python -m app.db.bootstrap &

exec "$@"
