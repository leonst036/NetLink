#!/usr/bin/env bash
set -euo pipefail

# Root directory of the repository
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "🧹 Cleaning generated files and build artifacts..."
count=0

# Helper function to check if git tracks a file/dir
is_tracked() {
    git ls-files --error-unmatch "$1" >/dev/null 2>&1
}

# 1. Remove build directories (dist, build, out)
while IFS= read -r -d '' dir; do
    if ! is_tracked "$dir"; then
        echo "Removing directory: $dir"
        rm -rf "$dir"
        ((count++)) || true
    fi
done < <(find . -type d \( -name "node_modules" -o -name ".git" \) -prune -o -type d \( -name "dist" -o -name "build" -o -name "out" \) -print0)

# 2. Remove in-place compiled JS/TS declaration files (.js, .js.map, .d.ts, .d.ts.map, .jsx, .jsx.map, .tsbuildinfo)
while IFS= read -r -d '' file; do
    if ! is_tracked "$file"; then
        echo "Deleting file: $file"
        rm -f "$file"
        ((count++)) || true
    fi
done < <(find . -type d \( -name "node_modules" -o -name ".git" \) -prune -o -type f \( \
    -name "*.js" -o \
    -name "*.js.map" -o \
    -name "*.d.ts" -o \
    -name "*.d.ts.map" -o \
    -name "*.jsx" -o \
    -name "*.jsx.map" -o \
    -name "*.tsbuildinfo" \
\) -print0)

# 3. Clean log files and logs directories
while IFS= read -r -d '' item; do
    if ! is_tracked "$item"; then
        echo "Deleting log item: $item"
        rm -rf "$item"
        ((count++)) || true
    fi
done < <(find . -type d \( -name "node_modules" -o -name ".git" \) -prune -o \( -type f -name "*.log" -o -type d -name "logs" \) -print0)

# 4. Clean untracked NetStore application files/folders
for netstore_dir in "backend/local_server/NetStore/Applications" "backend/relay/NetStore/Applications"; do
    if [ -d "$netstore_dir" ]; then
        while IFS= read -r -d '' app_item; do
            if ! is_tracked "$app_item"; then
                echo "Deleting generated NetStore item: $app_item"
                rm -rf "$app_item"
                ((count++)) || true
            fi
        done < <(find "$netstore_dir" -mindepth 1 -maxdepth 1 -print0)
    fi
done

if [ "$count" -eq 0 ]; then
    echo "✨ Clean! No generated files found."
else
    echo "✅ Cleanup finished. Removed $count generated items."
fi

