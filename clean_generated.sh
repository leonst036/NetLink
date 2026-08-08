#!/usr/bin/env bash

# Find all .ts files, excluding node_modules
find . -type d \( -name "node_modules" -o -name ".git" \) -prune -o -type f -name "*.ts" -print | while read -r ts_file; do
    # Get the base name without extension
    base_name="${ts_file%.ts}"
    
    js_file="${base_name}.js"
    map_file="${base_name}.js.map"
    
    # Check if the .js file exists and delete it
    if [ -f "$js_file" ]; then
        echo "Deleting $js_file"
        rm "$js_file"
    fi
    
    # Check if the .js.map file exists and delete it
    if [ -f "$map_file" ]; then
        echo "Deleting $map_file"
        rm "$map_file"
    fi
done

echo "Cleanup finished."
