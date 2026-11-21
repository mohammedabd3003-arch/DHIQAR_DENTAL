#!/usr/bin/env bash
# يشغّل كل الهجرات والاختبارات على قاعدة محلية نظيفة (PostgreSQL 15+)
set -e
DB=${DB:-basma_test}
psql -q -c "drop database if exists $DB" -c "create database $DB"
for f in tests/00_supabase_stub.sql migrations/001_initial.sql migrations/002_location_license.sql migrations/003_platform.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$(dirname "$0")/../$f" > /dev/null
done
psql -q -d $DB -f "$(dirname "$0")/10_security_tests.sql"
