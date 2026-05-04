#!/bin/bash

cd /home/devbox/project || exit 1

app_env=${1:-development}

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Define build target
build_target="server"

# Development environment commands
dev_commands() {
    echo "Running development environment commands..."
    PORT=8080 HOST=0.0.0.0 NODE_ENV=development node "${build_target}.js"
}

# Production environment commands
# ※Compiled before release
prod_commands() {
    echo "Running production environment commands..."
    PORT=8080 HOST=0.0.0.0 NODE_ENV=production node "${build_target}.js"
}

# Check environment variables to determine the running environment
if [ "$app_env" = "production" ] || [ "$app_env" = "prod" ] ; then
    echo "Production environment detected"
    prod_commands
else
    echo "Development environment detected"
    dev_commands
fi
