#!/bin/bash

# Minimal Lambda Package Builder
# This script creates deployment packages for Lambda functions with minimal dependencies

set -e

# Configuration
LAMBDA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$LAMBDA_DIR/build-minimal"
PACKAGE_DIR="$BUILD_DIR/package"

echo "🔨 Building minimal Lambda deployment package..."
echo "Lambda directory: $LAMBDA_DIR"
echo "Build directory: $BUILD_DIR"

# Clean up previous builds
if [ -d "$BUILD_DIR" ]; then
    echo "Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$PACKAGE_DIR"

# Install minimal dependencies
echo "Installing minimal Python dependencies..."
pip install --target "$PACKAGE_DIR" -r "$LAMBDA_DIR/requirements.minimal.txt"

# Copy Lambda function code
echo "Copying Lambda function code..."
cp "$LAMBDA_DIR"/*.py "$PACKAGE_DIR/"

# Remove the build script from the package
rm -f "$PACKAGE_DIR/build_*.py" 2>/dev/null || true

# Create deployment package
echo "Creating deployment package..."
cd "$PACKAGE_DIR"
zip -r "../lambda-minimal-package.zip" . -q

echo "✅ Minimal Lambda deployment package created at: $BUILD_DIR/lambda-minimal-package.zip"
echo "Package size: $(du -h "$BUILD_DIR/lambda-minimal-package.zip" | cut -f1)"

# List package contents for verification
echo "Package contents (first 30 items):"
unzip -l "../lambda-minimal-package.zip" | head -30