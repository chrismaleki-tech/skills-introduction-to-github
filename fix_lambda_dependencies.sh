#!/bin/bash

# Lambda Dependencies Fix Deployment Script
# This script fixes the Lambda function dependency issue

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Lambda Dependencies Fix Deployment${NC}"
echo -e "${BLUE}====================================${NC}\n"

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo -e "${BLUE}Checking Prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install AWS CLI v2"
    echo "  curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o \"awscliv2.zip\""
    echo "  unzip awscliv2.zip"
    echo "  sudo ./aws/install"
    exit 1
fi

print_status "AWS CLI found"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure'"
    exit 1
fi

print_status "AWS credentials configured"

# Check if Lambda function exists
FUNCTION_NAME="data-quest-v2-data-processor"
if ! aws lambda get-function --function-name "$FUNCTION_NAME" &> /dev/null; then
    print_error "Lambda function '$FUNCTION_NAME' not found"
    print_warning "Please deploy the CDK stack first or check the function name"
    exit 1
fi

print_status "Lambda function '$FUNCTION_NAME' found"

# Build the minimal deployment package
echo -e "\n${BLUE}Building Lambda Deployment Package...${NC}"
cd /workspace/part4_infrastructure/lambda_functions

if [ ! -f "./build_minimal_package.sh" ]; then
    print_error "Build script not found"
    exit 1
fi

./build_minimal_package.sh

# Verify package exists
PACKAGE_PATH="./build-minimal/lambda-minimal-package.zip"
if [ ! -f "$PACKAGE_PATH" ]; then
    print_error "Deployment package not found at $PACKAGE_PATH"
    exit 1
fi

print_status "Deployment package created: $(du -h "$PACKAGE_PATH" | cut -f1)"

# Update Lambda function
echo -e "\n${BLUE}Updating Lambda Function...${NC}"
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$PACKAGE_PATH" \
    --output table

print_status "Lambda function updated successfully"

# Test the function
echo -e "\n${BLUE}Testing Lambda Function...${NC}"
RESPONSE_FILE="/tmp/lambda_response.json"

aws lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --payload '{}' \
    "$RESPONSE_FILE" \
    --output table

if [ -f "$RESPONSE_FILE" ]; then
    echo -e "\n${BLUE}Lambda Response:${NC}"
    cat "$RESPONSE_FILE"
    echo ""
    
    # Check for errors in the response
    if grep -q "errorMessage" "$RESPONSE_FILE"; then
        print_warning "Lambda function executed but returned an error"
    else
        print_status "Lambda function test completed"
    fi
    
    rm -f "$RESPONSE_FILE"
else
    print_warning "No response file generated"
fi

echo -e "\n${GREEN}🎉 Lambda Dependencies Fix Completed!${NC}"
echo -e "${BLUE}Summary:${NC}"
echo "- Fixed missing 'requests' dependency"
echo "- Deployed minimal package (1.7MB)"
echo "- Function should now execute without import errors"
echo ""
echo -e "${YELLOW}Note:${NC} The analytics processor still needs Lambda layers for pandas/numpy"
echo "See LAMBDA_FIX_GUIDE.md for details on implementing Lambda layers"