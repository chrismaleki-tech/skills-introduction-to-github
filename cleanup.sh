#!/bin/bash

# Cleanup Script for Rearc Data Quest
# This script removes all AWS resources created by the project

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}🧹 Rearc Data Quest Cleanup${NC}"
echo -e "${RED}===========================\n${NC}"

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

# Confirmation
echo -e "${YELLOW}This will delete ALL AWS resources created by Rearc Data Quest!${NC}"
echo -e "${YELLOW}This includes:${NC}"
echo "  - S3 buckets and all data"
echo "  - Lambda functions"
echo "  - SQS queues"
echo "  - CloudWatch logs"
echo "  - IAM roles and policies"
echo "  - CloudFormation stack"
echo

read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${BLUE}Cleanup cancelled.${NC}"
    exit 0
fi

echo

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure'"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_status "AWS credentials verified for account: $ACCOUNT_ID"

echo

# CDK Destroy
echo -e "${BLUE}Destroying CDK Stack...${NC}"

cd part4_infrastructure/cdk

if [ -f "cdk.json" ]; then
    print_status "Found CDK project"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name DataQuestPipelineV2 &> /dev/null; then
        print_status "Stack exists, proceeding with destruction..."
        
        if cdk destroy --force; then
            print_status "CDK stack destroyed successfully"
        else
            print_error "CDK stack destruction failed"
            print_warning "You may need to manually delete resources in AWS Console"
        fi
    else
        print_warning "CDK stack not found, may already be deleted"
    fi
else
    print_error "CDK project not found"
fi

cd ../..

echo

# Manual cleanup of resources that might be left behind
echo -e "${BLUE}Checking for Remaining Resources...${NC}"

# Check for S3 buckets
print_status "Checking S3 buckets..."
BUCKETS=$(aws s3 ls | grep rearc || echo "")
if [ -n "$BUCKETS" ]; then
    print_warning "Found remaining S3 buckets:"
    echo "$BUCKETS"
    echo
    echo "To manually delete buckets with data:"
    aws s3 ls | grep rearc | awk '{print $3}' | while read bucket; do
        echo "  aws s3 rm s3://$bucket --recursive"
        echo "  aws s3 rb s3://$bucket"
    done
else
    print_status "No S3 buckets found"
fi

# Check for Lambda functions
print_status "Checking Lambda functions..."
FUNCTIONS=$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `rearc`) || contains(FunctionName, `RearcDataQuest`)].FunctionName' --output text)
if [ -n "$FUNCTIONS" ]; then
    print_warning "Found remaining Lambda functions: $FUNCTIONS"
    echo "To manually delete:"
    for func in $FUNCTIONS; do
        echo "  aws lambda delete-function --function-name $func"
    done
else
    print_status "No Lambda functions found"
fi

# Check for SQS queues
print_status "Checking SQS queues..."
QUEUES=$(aws sqs list-queues --query 'QueueUrls[?contains(@, `rearc`) || contains(@, `RearcDataQuest`)]' --output text)
if [ -n "$QUEUES" ]; then
    print_warning "Found remaining SQS queues"
    echo "To manually delete:"
    for queue in $QUEUES; do
        echo "  aws sqs delete-queue --queue-url $queue"
    done
else
    print_status "No SQS queues found"
fi

# Check for CloudWatch log groups
print_status "Checking CloudWatch log groups..."
LOG_GROUPS=$(aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `rearc`) || contains(logGroupName, `RearcDataQuest`)].logGroupName' --output text)
if [ -n "$LOG_GROUPS" ]; then
    print_warning "Found remaining CloudWatch log groups"
    echo "To manually delete:"
    for group in $LOG_GROUPS; do
        echo "  aws logs delete-log-group --log-group-name $group"
    done
else
    print_status "No CloudWatch log groups found"
fi

echo

# Clean up local files
echo -e "${BLUE}Cleaning Up Local Files...${NC}"

# Remove CDK outputs
if [ -f "part4_infrastructure/cdk/cdk-outputs.json" ]; then
    rm -f part4_infrastructure/cdk/cdk-outputs.json
    print_status "Removed CDK outputs file"
fi

# Remove CDK generated files
if [ -d "part4_infrastructure/cdk/cdk.out" ]; then
    rm -rf part4_infrastructure/cdk/cdk.out
    print_status "Removed CDK output directory"
fi

# Remove reports
if [ -f "deployment-report.md" ]; then
    rm -f deployment-report.md
    print_status "Removed deployment report"
fi

if [ -f "bandit-report.json" ]; then
    rm -f bandit-report.json
    print_status "Removed security report"
fi

# Remove virtual environment (optional)
read -p "Remove Python virtual environment? (y/n): " remove_venv
if [ "$remove_venv" = "y" ] || [ "$remove_venv" = "Y" ]; then
    if [ -d "venv" ]; then
        rm -rf venv
        print_status "Removed Python virtual environment"
    fi
fi

echo

# Final summary
echo -e "${GREEN}🎉 Cleanup Complete!${NC}"
echo -e "${GREEN}==================\n${NC}"

print_status "CDK stack destruction attempted"
print_status "Local cleanup files removed"

echo
echo -e "${BLUE}Summary:${NC}"
echo "1. CDK stack has been destroyed"
echo "2. Check AWS Console to verify all resources are deleted"
echo "3. Any remaining resources were listed above for manual deletion"
echo "4. Local temporary files have been cleaned up"

echo
echo -e "${YELLOW}Note:${NC} Some resources might take a few minutes to fully delete."
echo -e "${YELLOW}Check AWS Console to ensure all resources are removed.${NC}"

echo
echo -e "${BLUE}To re-deploy, run:${NC}"
echo "./deploy.sh"