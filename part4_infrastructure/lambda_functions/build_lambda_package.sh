#!/bin/bash

# Lambda Package Builder
# This script creates deployment packages for Lambda functions with all dependencies

set -e

# Configuration
LAMBDA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$LAMBDA_DIR/build"
PACKAGE_DIR="$BUILD_DIR/package"

echo "🔨 Building Lambda deployment package..."
echo "Lambda directory: $LAMBDA_DIR"
echo "Build directory: $BUILD_DIR"

# Clean up previous builds
if [ -d "$BUILD_DIR" ]; then
    echo "Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$PACKAGE_DIR"

# Install dependencies
echo "Installing Python dependencies..."
pip install --target "$PACKAGE_DIR" -r "$LAMBDA_DIR/requirements.txt"

# Copy Lambda function code
echo "Copying Lambda function code..."
cp "$LAMBDA_DIR"/*.py "$PACKAGE_DIR/"

# Create deployment package
echo "Creating deployment package..."
cd "$PACKAGE_DIR"
zip -r "../lambda-deployment-package.zip" . -q

echo "✅ Lambda deployment package created at: $BUILD_DIR/lambda-deployment-package.zip"
echo "Package size: $(du -h "$BUILD_DIR/lambda-deployment-package.zip" | cut -f1)"

# List package contents for verification
echo "Package contents:"
unzip -l "../lambda-deployment-package.zip" | head -20