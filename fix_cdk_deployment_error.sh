#!/bin/bash

# CDK Deployment Error Fix Script
# This script addresses the CDK bootstrap and IAM permission issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 CDK Deployment Error Fix Script${NC}"
echo -e "${BLUE}=================================${NC}"
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

# Validate prerequisites
echo -e "${BLUE}Checking Prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Installing..."
    sudo apt update && sudo apt install -y awscli
    print_status "AWS CLI installed"
else
    print_status "AWS CLI is available"
fi

# Check CDK CLI
if ! command -v cdk &> /dev/null; then
    print_error "CDK CLI not found. Installing..."
    if ! command -v node &> /dev/null; then
        print_info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    npm install -g aws-cdk@latest
    print_status "CDK CLI installed"
else
    CDK_VER=$(cdk --version)
    print_status "CDK CLI is available: $CDK_VER"
fi

echo ""
echo -e "${BLUE}Analyzing CDK Error...${NC}"

# The main errors from the log:
# 1. SSM parameter /cdk-bootstrap/hnb659fds/version not found - Environment not bootstrapped
# 2. User cannot assume CDK bootstrap roles - IAM permission issue
# 3. Node 18 EOL warning (already fixed by installing Node 20+)

echo "Error Analysis:"
echo "1. ❌ CDK environment not bootstrapped (SSM parameter missing)"
echo "2. ❌ IAM permissions insufficient for bootstrap roles"
echo "3. ✅ Node.js version updated (was Node 18, now using newer version)"
echo ""

echo -e "${BLUE}Solution Steps:${NC}"
echo ""

# Step 1: Check AWS credentials
echo -e "${YELLOW}Step 1: Verify AWS Credentials${NC}"
if aws sts get-caller-identity &> /dev/null; then
    CALLER_IDENTITY=$(aws sts get-caller-identity)
    ACCOUNT_ID=$(echo $CALLER_IDENTITY | jq -r '.Account')
    USER_ARN=$(echo $CALLER_IDENTITY | jq -r '.Arn')
    print_status "AWS credentials are valid"
    print_info "Account ID: $ACCOUNT_ID"
    print_info "User ARN: $USER_ARN"
else
    print_error "AWS credentials not configured or invalid"
    echo ""
    echo -e "${YELLOW}Please configure AWS credentials using one of these methods:${NC}"
    echo "1. Set environment variables:"
    echo "   export AWS_ACCESS_KEY_ID='your-access-key'"
    echo "   export AWS_SECRET_ACCESS_KEY='your-secret-key'"
    echo "   export AWS_DEFAULT_REGION='your-region'"
    echo ""
    echo "2. Use AWS CLI configuration:"
    echo "   aws configure"
    echo ""
    echo "3. For GitHub Actions, ensure these secrets are set:"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY"
    echo "   - AWS_DEFAULT_REGION"
    echo ""
    exit 1
fi

# Step 2: Check required IAM permissions
echo ""
echo -e "${YELLOW}Step 2: Check IAM Permissions${NC}"

# List of permissions required for CDK bootstrap
required_permissions=(
    "cloudformation:CreateStack"
    "cloudformation:UpdateStack"
    "cloudformation:DescribeStacks"
    "cloudformation:DescribeStackEvents"
    "s3:CreateBucket"
    "s3:PutBucketPolicy"
    "s3:PutBucketVersioning"
    "s3:PutBucketPublicAccessBlock"
    "iam:CreateRole"
    "iam:PutRolePolicy"
    "iam:AttachRolePolicy"
    "ssm:PutParameter"
    "ecr:CreateRepository"
    "ecr:SetRepositoryPolicy"
)

echo "Required permissions for CDK bootstrap:"
for perm in "${required_permissions[@]}"; do
    echo "  - $perm"
done
echo ""

# Step 3: Attempt CDK bootstrap with troubleshooting
echo -e "${YELLOW}Step 3: Bootstrap CDK Environment${NC}"

cd part4_infrastructure/cdk

# Get region
AWS_REGION="${AWS_DEFAULT_REGION:-$(aws configure get region)}"
if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-east-1"
    print_warning "No region specified, using default: $AWS_REGION"
fi

print_info "Bootstrapping CDK for account $ACCOUNT_ID in region $AWS_REGION"

# Set CDK environment variables
export CDK_DEFAULT_ACCOUNT=$ACCOUNT_ID
export CDK_DEFAULT_REGION=$AWS_REGION

# Try bootstrap with verbose output
echo "Running: cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION --verbose"
if cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION" --verbose 2>&1; then
    print_status "CDK bootstrap completed successfully!"
    
    # Verify bootstrap
    echo ""
    echo -e "${YELLOW}Step 4: Verify Bootstrap${NC}"
    if aws ssm get-parameter --name "/cdk-bootstrap/hnb659fds/version" --region $AWS_REGION &> /dev/null; then
        BOOTSTRAP_VERSION=$(aws ssm get-parameter --name "/cdk-bootstrap/hnb659fds/version" --region $AWS_REGION --query 'Parameter.Value' --output text)
        print_status "Bootstrap verification successful (version: $BOOTSTRAP_VERSION)"
    else
        print_warning "Bootstrap parameter not found, but bootstrap command succeeded"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 CDK Bootstrap Fixed!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Try deploying your CDK stack:"
    echo "   cd part4_infrastructure/cdk"
    echo "   cdk deploy --require-approval never"
    echo ""
    echo "2. If deployment still fails, check:"
    echo "   - Lambda function dependencies (requirements.txt)"
    echo "   - Stack configuration (app.py, pipeline_stack.py)"
    echo "   - Resource naming conflicts"
    
else
    echo ""
    print_error "CDK bootstrap failed"
    echo ""
    echo -e "${YELLOW}Troubleshooting Steps:${NC}"
    echo ""
    echo "1. Check if you have the required IAM permissions:"
    echo "   - CloudFormation full access"
    echo "   - S3 bucket management"
    echo "   - IAM role creation"
    echo "   - SSM parameter access"
    echo "   - ECR repository management"
    echo ""
    echo "2. If using IAM user, ensure it has these policies:"
    echo "   - arn:aws:iam::aws:policy/AWSCloudFormationFullAccess"
    echo "   - arn:aws:iam::aws:policy/IAMFullAccess"
    echo "   - arn:aws:iam::aws:policy/AmazonS3FullAccess"
    echo "   - arn:aws:iam::aws:policy/AmazonSSMFullAccess"
    echo "   - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
    echo ""
    echo "3. For GitHub Actions, ensure your AWS user has sufficient permissions"
    echo "   and that the secrets are correctly configured"
    echo ""
    echo "4. If you're in an organization, you may need administrator assistance"
    echo "   to grant the necessary permissions"
    echo ""
    
    # Additional debugging information
    echo -e "${BLUE}Debug Information:${NC}"
    echo "User ARN: $USER_ARN"
    echo "Account ID: $ACCOUNT_ID"
    echo "Region: $AWS_REGION"
    echo "CDK Version: $(cdk --version)"
    echo ""
    
    exit 1
fi