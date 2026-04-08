#!/usr/bin/env bash
set -e
python manage.py migrate --noinput
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" TRIPLINK.asgi:application
