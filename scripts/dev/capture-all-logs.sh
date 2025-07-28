#!/bin/bash

# Kill any existing processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Clear previous logs
> all-dev-errors.log

echo "Starting npm run dev with full logging..."
echo "All output will be captured in all-dev-errors.log"

# Run npm dev and capture ALL output (stdout and stderr)
npm run dev 2>&1 | tee all-dev-errors.log