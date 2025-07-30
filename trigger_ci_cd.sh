#!/bin/bash

# Script to manually trigger CI/CD workflows
# Usage: ./trigger_ci_cd.sh [workflow_type] [environment] [aws_region]

set -e

WORKFLOW_TYPE=${1:-"deploy"}
ENVIRONMENT=${2:-"dev"}
AWS_REGION=${3:-"us-east-2"}

echo "🚀 Triggering CI/CD workflows..."
echo "Workflow Type: $WORKFLOW_TYPE"
echo "Environment: $ENVIRONMENT"
echo "AWS Region: $AWS_REGION"

# Check if we have a GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN environment variable is required"
    echo "Please set it with: export GITHUB_TOKEN=your_token"
    exit 1
fi

# Get repository info
REPO_OWNER=$(git config --get remote.origin.url | sed 's/.*github\.com[:/]\([^/]*\)\/.*/\1/')
REPO_NAME=$(git config --get remote.origin.url | sed 's/.*\/\([^/]*\)\.git$/\1/')

echo "Repository: $REPO_OWNER/$REPO_NAME"

case $WORKFLOW_TYPE in
    "deploy"|"deployment")
        echo "📦 Triggering AWS Deployment workflow..."
        curl -X POST \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/deploy-aws.yml/dispatches" \
            -d "{\"ref\":\"main\",\"inputs\":{\"environment\":\"$ENVIRONMENT\",\"aws-region\":\"$AWS_REGION\",\"trigger-e2e-pipeline\":\"true\"}}"
        ;;
    "e2e"|"pipeline")
        echo "🔄 Triggering E2E Pipeline workflow..."
        curl -X POST \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/e2e-pipeline.yml/dispatches" \
            -d "{\"ref\":\"main\",\"inputs\":{\"environment\":\"$ENVIRONMENT\",\"aws-region\":\"$AWS_REGION\",\"skip-deployment\":\"false\",\"data-validation-timeout\":\"15\"}}"
        ;;
    "both"|"all")
        echo "🚀 Triggering both workflows..."
        # First trigger deployment with E2E enabled
        curl -X POST \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/deploy-aws.yml/dispatches" \
            -d "{\"ref\":\"main\",\"inputs\":{\"environment\":\"$ENVIRONMENT\",\"aws-region\":\"$AWS_REGION\",\"trigger-e2e-pipeline\":\"true\"}}"
        ;;
    *)
        echo "❌ Unknown workflow type: $WORKFLOW_TYPE"
        echo "Available options: deploy, e2e, both"
        exit 1
        ;;
esac

echo "✅ Workflow trigger request sent!"
echo "Check the Actions tab in your GitHub repository to monitor progress."
echo "URL: https://github.com/$REPO_OWNER/$REPO_NAME/actions"

# Alternative manual trigger instructions
echo ""
echo "📝 Manual trigger alternatives:"
echo "1. Go to: https://github.com/$REPO_OWNER/$REPO_NAME/actions"
echo "2. Select the workflow you want to run"
echo "3. Click 'Run workflow' button"
echo "4. Configure parameters and run"