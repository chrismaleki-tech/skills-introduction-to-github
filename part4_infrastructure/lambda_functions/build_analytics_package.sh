#!/bin/bash

# Analytics Lambda Package Builder
# This script creates deployment packages for the analytics processor with full dependencies

set -e

# Configuration
LAMBDA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$LAMBDA_DIR/build-analytics"
PACKAGE_DIR="$BUILD_DIR/package"

echo "🔨 Building analytics Lambda deployment package..."
echo "Lambda directory: $LAMBDA_DIR"
echo "Build directory: $BUILD_DIR"

# Clean up previous builds
if [ -d "$BUILD_DIR" ]; then
    echo "Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$PACKAGE_DIR"

# Install full dependencies for analytics
echo "Installing analytics Python dependencies..."
pip install --target "$PACKAGE_DIR" -r "$LAMBDA_DIR/requirements.txt"

# Copy only the analytics processor code
echo "Copying analytics processor code..."
cp "$LAMBDA_DIR/analytics_processor.py" "$PACKAGE_DIR/"

# Create deployment package
echo "Creating deployment package..."
cd "$PACKAGE_DIR"
zip -r "../lambda-analytics-package.zip" . -q

echo "✅ Analytics Lambda deployment package created at: $BUILD_DIR/lambda-analytics-package.zip"
echo "Package size: $(du -h "$BUILD_DIR/lambda-analytics-package.zip" | cut -f1)"

# Check if package is too large for Lambda
PACKAGE_SIZE_BYTES=$(stat -c%s "$BUILD_DIR/lambda-analytics-package.zip")
LAMBDA_LIMIT_BYTES=$((50 * 1024 * 1024))  # 50MB

if [ $PACKAGE_SIZE_BYTES -gt $LAMBDA_LIMIT_BYTES ]; then
    echo "⚠️  WARNING: Package size exceeds AWS Lambda 50MB limit!"
    echo "Consider using Lambda Layers or container images for large dependencies."
else
    echo "✅ Package size is within Lambda limits."
fi