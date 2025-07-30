#!/bin/bash

# CDK Setup Verification Script
# Quick script to verify if CDK environment is properly configured

echo "🔍 CDK Setup Verification"
echo "========================="
echo ""

# Check AWS CLI
if command -v aws &> /dev/null; then
    echo "✅ AWS CLI: $(aws --version)"
else
    echo "❌ AWS CLI: Not installed"
fi

# Check CDK CLI
if command -v cdk &> /dev/null; then
    echo "✅ CDK CLI: $(cdk --version)"
else
    echo "❌ CDK CLI: Not installed"
fi

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js: Not installed"
fi

echo ""

# Check AWS credentials
if aws sts get-caller-identity &> /dev/null; then
    echo "✅ AWS Credentials: Configured"
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo "   Account: $ACCOUNT_ID"
    echo "   User: $USER_ARN"
else
    echo "❌ AWS Credentials: Not configured or invalid"
fi

echo ""

# Check CDK bootstrap status
AWS_REGION="${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null)}"
if [ -n "$AWS_REGION" ]; then
    echo "🔍 Checking CDK bootstrap status in region: $AWS_REGION"
    if aws ssm get-parameter --name "/cdk-bootstrap/hnb659fds/version" --region $AWS_REGION &> /dev/null; then
        BOOTSTRAP_VERSION=$(aws ssm get-parameter --name "/cdk-bootstrap/hnb659fds/version" --region $AWS_REGION --query 'Parameter.Value' --output text)
        echo "✅ CDK Bootstrap: Completed (version: $BOOTSTRAP_VERSION)"
    else
        echo "❌ CDK Bootstrap: Not completed"
        echo "   Run: ./fix_cdk_deployment_error.sh"
    fi
else
    echo "❌ AWS Region: Not configured"
fi

echo ""
echo "📋 Summary:"
echo "If you see any ❌ items above, run: ./fix_cdk_deployment_error.sh"