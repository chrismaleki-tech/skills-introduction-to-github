#!/bin/bash

# Test script for manually triggering the data pipeline
# This script tries different methods to trigger the Lambda function

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing Manual Pipeline Triggers${NC}"
echo "====================================="

# Check AWS CLI availability
if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗${NC} AWS CLI not found. Please install AWS CLI first."
    exit 1
fi

# Check AWS credentials
echo -e "${BLUE}Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} AWS credentials not configured or invalid."
    echo "Please run: aws configure"
    exit 1
fi
echo -e "${GREEN}✓${NC} AWS credentials valid"

# Get AWS region
AWS_REGION=$(aws configure get region || echo "us-east-2")
echo -e "${BLUE}Using AWS region: ${AWS_REGION}${NC}"

echo ""
echo -e "${BLUE}Method 1: EventBridge put-events (corrected format)${NC}"
echo "=================================================="

# Try the corrected EventBridge command
echo "Trying: aws events put-events --entries '[{\"Source\":\"manual\",\"DetailType\":\"Manual Trigger\",\"Detail\":\"{}\"}]'"
if aws events put-events --entries '[{"Source":"manual","DetailType":"Manual Trigger","Detail":"{}"}]' --region "$AWS_REGION"; then
    echo -e "${GREEN}✓${NC} EventBridge event sent successfully"
else
    echo -e "${RED}✗${NC} EventBridge command failed"
fi

echo ""
echo -e "${BLUE}Method 2: Using JSON file${NC}"
echo "==========================="

# Create temporary JSON file
cat > /tmp/manual-trigger.json << EOF
[
  {
    "Source": "manual",
    "DetailType": "Manual Trigger",
    "Detail": "{}",
    "Resources": [],
    "Time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }
]
EOF

echo "Trying: aws events put-events --entries file:///tmp/manual-trigger.json"
if aws events put-events --entries file:///tmp/manual-trigger.json --region "$AWS_REGION"; then
    echo -e "${GREEN}✓${NC} EventBridge event sent via JSON file"
else
    echo -e "${RED}✗${NC} JSON file method failed"
fi

echo ""
echo -e "${BLUE}Method 3: Direct Lambda invocation${NC}"
echo "=================================="

# Try to find the Lambda function
LAMBDA_FUNCTION=$(aws lambda list-functions --region "$AWS_REGION" --query 'Functions[?contains(FunctionName, `data-processor`)].FunctionName' --output text 2>/dev/null || echo "")

if [ -n "$LAMBDA_FUNCTION" ]; then
    echo "Found Lambda function: $LAMBDA_FUNCTION"
    echo "Trying: aws lambda invoke --function-name $LAMBDA_FUNCTION"
    if aws lambda invoke --function-name "$LAMBDA_FUNCTION" --region "$AWS_REGION" /tmp/lambda-response.json; then
        echo -e "${GREEN}✓${NC} Lambda invoked directly"
        echo "Response:"
        cat /tmp/lambda-response.json
    else
        echo -e "${RED}✗${NC} Direct Lambda invocation failed"
    fi
else
    echo -e "${YELLOW}⚠${NC} No data-processor Lambda function found"
fi

echo ""
echo -e "${BLUE}Method 4: List EventBridge rules${NC}"
echo "==============================="

echo "Checking for EventBridge rules..."
aws events list-rules --region "$AWS_REGION" --query 'Rules[?contains(Name, `rearc`) || contains(Name, `data`)].[Name,State,Description]' --output table

echo ""
echo -e "${BLUE}Summary${NC}"
echo "======="
echo "If none of the methods worked, check:"
echo "1. AWS credentials and permissions"
echo "2. Correct AWS region"
echo "3. Infrastructure deployment status"
echo "4. Lambda function exists and has proper triggers"

# Cleanup
rm -f /tmp/manual-trigger.json /tmp/lambda-response.json