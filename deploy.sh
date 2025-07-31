#!/bin/bash

# Local Deployment Script for Rearc Data Quest
# This script mimics the GitHub Actions deployment workflow for local testing

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_DEFAULT_REGION:-us-east-2}"
PYTHON_VERSION="3.9"

echo -e "${BLUE}🚀 Starting Rearc Data Quest Deployment${NC}"
echo -e "${BLUE}=====================================\n${NC}"

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

# Check Python version
if command -v python3 &> /dev/null; then
    PYTHON_VER=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    print_status "Python $PYTHON_VER found"
else
    print_error "Python 3 not found. Please install Python 3.9+"
    exit 1
fi

# Check AWS CLI
if command -v aws &> /dev/null; then
    print_status "AWS CLI found"
    
    # Check AWS credentials
    if aws sts get-caller-identity &> /dev/null; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        print_status "AWS credentials configured for account: $ACCOUNT_ID"
    else
        print_error "AWS credentials not configured. Please run 'aws configure'"
        exit 1
    fi
else
    print_error "AWS CLI not found. Please install AWS CLI v2"
    exit 1
fi

# Check Node.js and CDK
if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    print_status "Node.js $NODE_VER found"
else
    print_error "Node.js not found. Please install Node.js 16+"
    exit 1
fi

if command -v cdk &> /dev/null; then
    CDK_VER=$(cdk --version)
    print_status "AWS CDK $CDK_VER found"
else
    print_warning "AWS CDK not found. Installing..."
    npm install -g aws-cdk@latest
    print_status "AWS CDK installed"
fi

echo

# Set up Python environment
echo -e "${BLUE}Setting up Python Environment...${NC}"

if [ ! -d "venv" ]; then
    print_status "Creating virtual environment..."
    python3 -m venv venv
fi

print_status "Activating virtual environment..."
source venv/bin/activate

print_status "Installing Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
pip install -r part4_infrastructure/cdk/requirements.txt > /dev/null 2>&1

echo

echo

# CDK Bootstrap
echo -e "${BLUE}Bootstrapping CDK...${NC}"
cd part4_infrastructure/cdk

if cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION" > /dev/null 2>&1; then
    print_status "CDK bootstrap completed"
else
    print_warning "CDK bootstrap may have failed or was already done"
fi

# CDK Synth
print_status "Synthesizing CDK stack..."
if cdk synth > /dev/null 2>&1; then
    print_status "CDK synthesis successful"
else
    print_error "CDK synthesis failed"
    exit 1
fi

# CDK Deploy
echo -e "${BLUE}Deploying Infrastructure...${NC}"
print_status "Starting CDK deployment..."

if cdk deploy --require-approval never --verbose; then
    print_status "Infrastructure deployment successful!"
else
    print_error "Infrastructure deployment failed"
    exit 1
fi

# Save outputs
cdk deploy --outputs-file cdk-outputs.json --require-approval never > /dev/null 2>&1 || true

cd ../..

echo

# Run application scripts
echo -e "${BLUE}Running Application Scripts...${NC}"

print_status "Running data sourcing script..."
cd part1_data_sourcing
if python bls_data_sync.py; then
    print_status "Data sourcing completed"
else
    print_warning "Data sourcing had issues"
fi
cd ..

print_status "Running API integration script..."
cd part2_api_integration
if python population_api.py; then
    print_status "API integration completed"
else
    print_warning "API integration had issues"
fi
cd ..

echo

# Integration tests
echo -e "${BLUE}Running Integration Tests...${NC}"

print_status "Testing S3 buckets..."
aws s3 ls s3://data-quest-v2-bls-data/ > /dev/null 2>&1 || print_warning "BLS bucket not found or empty"
aws s3 ls s3://data-quest-v2-population-data/ > /dev/null 2>&1 || print_warning "Population bucket not found or empty"

print_status "Testing Lambda functions..."
LAMBDA_FUNCTIONS=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `rearc`) || contains(FunctionName, `RearcDataQuest`)].FunctionName' --output text)
if [ -n "$LAMBDA_FUNCTIONS" ]; then
    print_status "Found Lambda functions: $LAMBDA_FUNCTIONS"
else
    print_warning "No Lambda functions found"
fi

print_status "Testing SQS queues..."
SQS_QUEUES=$(aws sqs list-queues --query 'QueueUrls[?contains(@, `rearc`) || contains(@, `RearcDataQuest`)]' --output text)
if [ -n "$SQS_QUEUES" ]; then
    print_status "Found SQS queues"
else
    print_warning "No SQS queues found"
fi

echo

# Generate deployment report
echo -e "${BLUE}Generating Deployment Report...${NC}"

cat > deployment-report.md << EOF
# Local Deployment Report

**Date:** $(date)
**AWS Account:** $ACCOUNT_ID
**Region:** $AWS_REGION

## S3 Buckets
\`\`\`
$(aws s3 ls | grep data-quest-v2 || echo "No data-quest-v2 buckets found")
\`\`\`

## Lambda Functions
\`\`\`
$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `data-quest-v2`)].{Name:FunctionName,Runtime:Runtime,Modified:LastModified}' --output table)
\`\`\`

## SQS Queues
\`\`\`
$(aws sqs list-queues --query 'QueueUrls[?contains(@, `data-quest-v2`)]' --output table)
\`\`\`

## CDK Stack Status
\`\`\`
$(aws cloudformation describe-stacks --stack-name DataQuestPipelineV2 --query 'Stacks[0].{Status:StackStatus,Created:CreationTime}' --output table 2>/dev/null || echo "Stack not found")
\`\`\`
EOF

print_status "Deployment report saved to deployment-report.md"

echo
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}====================\n${NC}"

print_status "Infrastructure deployed successfully"
print_status "Application scripts executed"
print_status "Integration tests completed"
print_status "Deployment report generated"

echo
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Check deployment-report.md for detailed information"
echo "2. Monitor AWS Console for resource status"
echo "3. Check CloudWatch logs for any errors"
echo "4. Test your data pipeline manually"

echo
echo -e "${YELLOW}To cleanup resources, run:${NC}"
echo "cd part4_infrastructure/cdk && cdk destroy"

# Deactivate virtual environment
deactivate