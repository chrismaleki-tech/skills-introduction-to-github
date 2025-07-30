#!/bin/bash

# Manual End-to-End Pipeline Trigger Script
# This script allows you to manually trigger the end-to-end data pipeline

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
ENVIRONMENT="dev"
AWS_REGION="${AWS_DEFAULT_REGION:-us-east-2}"
SKIP_DEPLOYMENT="false"
VALIDATION_TIMEOUT="15"

# Function to print colored output
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

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Trigger the end-to-end data pipeline manually via GitHub Actions workflow dispatch.

OPTIONS:
    -e, --environment ENV       Environment to deploy to (dev, staging, prod) [default: dev]
    -r, --region REGION         AWS region [default: us-east-2 or AWS_DEFAULT_REGION]
    -s, --skip-deployment       Skip infrastructure deployment (use existing)
    -t, --timeout MINUTES       Data validation timeout in minutes [default: 15]
    -h, --help                  Show this help message

EXAMPLES:
    # Trigger E2E pipeline in dev environment
    $0

    # Trigger in production with existing infrastructure
    $0 --environment prod --skip-deployment

    # Trigger with custom timeout and region
    $0 --environment staging --region us-west-2 --timeout 20

PREREQUISITES:
    - GitHub CLI (gh) must be installed and authenticated
    - Repository must have GitHub Actions enabled
    - AWS credentials must be configured in GitHub secrets

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -s|--skip-deployment)
            SKIP_DEPLOYMENT="true"
            shift
            ;;
        -t|--timeout)
            VALIDATION_TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 End-to-End Pipeline Trigger${NC}"
echo -e "${BLUE}===============================${NC}\n"

# Validate environment
case $ENVIRONMENT in
    dev|staging|prod)
        print_info "Environment: $ENVIRONMENT"
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod"
        exit 1
        ;;
esac

print_info "AWS Region: $AWS_REGION"
print_info "Skip Deployment: $SKIP_DEPLOYMENT"
print_info "Validation Timeout: $VALIDATION_TIMEOUT minutes"
echo

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed. Please install it first:"
    echo "  https://cli.github.com/manual/installation"
    exit 1
fi

# Check if authenticated with GitHub
if ! gh auth status &> /dev/null; then
    print_error "Not authenticated with GitHub. Please run: gh auth login"
    exit 1
fi

print_status "GitHub CLI is installed and authenticated"

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [ -z "$REPO" ]; then
    print_error "Could not determine repository. Make sure you're in a git repository."
    exit 1
fi

print_info "Repository: $REPO"

# Confirm execution
echo -e "\n${YELLOW}About to trigger end-to-end pipeline with the following settings:${NC}"
echo "  Environment: $ENVIRONMENT"
echo "  AWS Region: $AWS_REGION"
echo "  Skip Deployment: $SKIP_DEPLOYMENT"
echo "  Validation Timeout: $VALIDATION_TIMEOUT minutes"
echo

read -p "Do you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Operation cancelled by user"
    exit 0
fi

# Trigger the workflow
print_info "Triggering end-to-end pipeline workflow..."

WORKFLOW_RUN=$(gh workflow run e2e-pipeline.yml \
    --field environment="$ENVIRONMENT" \
    --field aws-region="$AWS_REGION" \
    --field skip-deployment="$SKIP_DEPLOYMENT" \
    --field data-validation-timeout="$VALIDATION_TIMEOUT" \
    2>&1)

if [ $? -eq 0 ]; then
    print_status "End-to-end pipeline triggered successfully!"
    
    # Wait a moment for the run to appear
    sleep 3
    
    # Get the latest run
    LATEST_RUN=$(gh run list --workflow=e2e-pipeline.yml --limit=1 --json databaseId,url,status --jq '.[0]')
    
    if [ "$LATEST_RUN" != "null" ] && [ -n "$LATEST_RUN" ]; then
        RUN_URL=$(echo "$LATEST_RUN" | jq -r '.url')
        RUN_STATUS=$(echo "$LATEST_RUN" | jq -r '.status')
        
        print_info "Workflow Status: $RUN_STATUS"
        print_info "Workflow URL: $RUN_URL"
        
        echo -e "\n${GREEN}Monitor the pipeline execution at:${NC}"
        echo "  $RUN_URL"
        
        # Option to watch the run
        echo
        read -p "Do you want to watch the workflow run? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Watching workflow run..."
            gh run watch $(echo "$LATEST_RUN" | jq -r '.databaseId')
        fi
    else
        print_warning "Could not retrieve run information, but pipeline was triggered"
        print_info "Check the Actions tab in your repository to monitor progress"
    fi
else
    print_error "Failed to trigger pipeline:"
    echo "$WORKFLOW_RUN"
    exit 1
fi

echo -e "\n${GREEN}Pipeline trigger completed successfully!${NC}"
echo -e "${BLUE}The end-to-end pipeline will:${NC}"
echo "  1. Deploy infrastructure (if not skipped)"
echo "  2. Trigger the data pipeline (Lambda functions)"
echo "  3. Monitor execution and logs"
echo "  4. Validate data flow from source to analytics"
echo "  5. Generate a comprehensive report"
echo "  6. Clean up test data"