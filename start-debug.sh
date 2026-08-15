#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "🐳 Starting NetStore Debug Server via Docker..."
docker compose up -d --build

echo "✅ NetStore Debug Server is running at http://localhost:4540"
echo "🌿 Health check: http://localhost:4540/health"
echo "🌿 Branch list:  http://localhost:4540/api/branches"
