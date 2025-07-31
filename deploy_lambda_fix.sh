#!/bin/bash

# Lambda Function Import Error Fix
# Fixes Runtime.ImportModuleError by updating function with proper dependencies

FUNCTION_NAME="rearc-quest-data-processor"
PACKAGE_PATH="part4_infrastructure/lambda_functions/build-minimal/lambda-minimal-package.zip"

echo "🔧 Fixing Lambda Runtime.ImportModuleError..."

# Update Lambda function code
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$PACKAGE_PATH"

echo "✅ Lambda function updated with dependencies!"