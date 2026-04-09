#!/usr/bin/env bash
# exit on error
set -o errexit

# 1. Build React Frontend (CubemoonsScanner)
echo "--- BUILDING REACT FRONTEND ---"
cd CubemoonsScanner
npm install
npm run build
cd ..

# 2. Setup Frontend Directory
# My FastAPI backend expects CubemoonsScanner/dist to exist or be mapped.
# In main.py, let's verify where it expects it.
echo "--- INSTALLING PYTHON DEPENDENCIES ---"
pip install -r requirements.txt

echo "--- BUILD COMPLETE ---"
