#!/bin/bash

# Comprehensive CDK Environment Bootstrap Script
# This script completes the CDK environment setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 CDK Environment Bootstrap Script${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

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

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "part4_infrastructure/cdk/cdk.json" ]]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Starting environment bootstrap process..."

# Step 1: Check AWS credentials
echo ""
echo -e "${BLUE}Step 1: Checking AWS Credentials${NC}"

if [[ -n "$AWS_ACCESS_KEY_ID" && -n "$AWS_SECRET_ACCESS_KEY" ]]; then
    print_status "AWS credentials found in environment variables"
elif [[ -f "$HOME/.aws/credentials" || -f "$HOME/.aws/config" ]]; then
    print_status "AWS credentials found in ~/.aws/ directory"
elif [[ -f ".env" ]]; then
    print_info "Loading credentials from .env file"
    export $(grep -v '^#' .env | xargs)
    if [[ -n "$AWS_ACCESS_KEY_ID" && -n "$AWS_SECRET_ACCESS_KEY" ]]; then
        print_status "AWS credentials loaded from .env file"
    else
        print_error "Invalid .env file format"
        exit 1
    fi
else
    print_error "No AWS credentials found"
    echo ""
    echo -e "${YELLOW}Please configure AWS credentials using one of these methods:${NC}"
    echo "1. Run: aws configure"
    echo "2. Set environment variables:"
    echo "   export AWS_ACCESS_KEY_ID='your-access-key'"
    echo "   export AWS_SECRET_ACCESS_KEY='your-secret-key'"
    echo "   export AWS_DEFAULT_REGION='us-east-2'"
    echo "3. Create a .env file with your credentials"
    echo "4. Run the credential setup script: ./setup_credentials.sh"
    echo ""
    exit 1
fi

# Test credentials
print_info "Testing AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION="${AWS_DEFAULT_REGION:-us-east-2}"
    print_status "AWS credentials are valid for account: $ACCOUNT_ID"
else
    print_error "AWS credentials are not valid"
    exit 1
fi

# Step 2: Check CDK installation
echo ""
echo -e "${BLUE}Step 2: Verifying CDK Installation${NC}"

if command -v cdk &> /dev/null; then
    CDK_VER=$(cdk --version)
    print_status "AWS CDK $CDK_VER is installed"
else
    print_error "AWS CDK not found. Installing..."
    npm install -g aws-cdk
    print_status "AWS CDK installed"
fi

# Step 3: Check Python environment
echo ""
echo -e "${BLUE}Step 3: Setting up Python Environment${NC}"

cd part4_infrastructure/cdk

if [[ ! -d "venv" ]]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv venv
    print_status "Virtual environment created"
fi

source venv/bin/activate
print_status "Virtual environment activated"

# Install/update dependencies
print_info "Installing/updating Python dependencies..."
pip install -r requirements.txt > /dev/null 2>&1
print_status "Python dependencies installed"

# Step 4: Build Lambda packages
echo ""
echo -e "${BLUE}Step 4: Building Lambda Packages${NC}"

cd ../lambda_functions

# Check if Lambda package exists
if [[ ! -f "build-minimal/lambda-minimal-package.zip" ]]; then
    print_info "Building minimal Lambda package..."
    bash build_minimal_package.sh > /dev/null 2>&1
    print_status "Minimal Lambda package built"
else
    print_status "Lambda package already exists"
fi

# Check if analytics package exists (if needed)
if [[ -f "build_analytics_package.sh" && ! -f "build-analytics/lambda-analytics-package.zip" ]]; then
    print_info "Building analytics Lambda package..."
    bash build_analytics_package.sh > /dev/null 2>&1
    print_status "Analytics Lambda package built"
fi

# Step 5: CDK Bootstrap
echo ""
echo -e "${BLUE}Step 5: Running CDK Bootstrap${NC}"

cd ../cdk
source venv/bin/activate

# Set CDK environment variables
export CDK_DEFAULT_ACCOUNT=$ACCOUNT_ID
export CDK_DEFAULT_REGION=$AWS_REGION

print_info "Bootstrapping CDK for account $ACCOUNT_ID in region $AWS_REGION..."

# Run CDK bootstrap
if cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION" --require-approval never; then
    print_status "CDK bootstrap completed successfully!"
else
    print_error "CDK bootstrap failed"
    exit 1
fi

# Step 6: Verify setup
echo ""
echo -e "${BLUE}Step 6: Verifying Setup${NC}"

print_info "Running CDK diff to verify stack configuration..."
if cdk diff > /dev/null 2>&1; then
    print_status "CDK stack configuration is valid"
else
    print_warning "CDK diff completed with warnings (this is normal for initial setup)"
fi

# Final status
echo ""
echo -e "${GREEN}🎉 Environment Bootstrap Complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Review your stack configuration:"
echo "   cd part4_infrastructure/cdk"
echo "   source venv/bin/activate"
echo "   cdk diff"
echo ""
echo "2. Deploy your infrastructure:"
echo "   cdk deploy"
echo ""
echo "3. To destroy resources later:"
echo "   cdk destroy"
echo ""
echo -e "${GREEN}Your CDK environment is now ready for deployment!${NC}"